// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IZKVerify.sol";
import "./interfaces/IZKRandomOracle.sol";
import "./libraries/VerifierLib.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title ZKRandomOracle
 * @dev Multi-chain ZK proof-based randomness oracle using Horizen zkVerify
 */
contract ZKRandomOracle is IZKRandomOracle, ReentrancyGuard, Pausable, Ownable {
  using VerifierLib for VerifierLib.ProofData;
  using Address for address;

  // zkVerify contract interface
  IZKVerify public immutable zkVerify;

  // Oracle configuration
  bytes32 public verificationKeyHash;
  uint256 public requestFee = 0.001 ether;
  uint256 public maxRequestsPerBlock = 10;
  uint256 public requestTimeout = 1 hours;

  // Request tracking
  mapping(uint256 => RandomnessRequest) public requests;
  mapping(bytes32 => bool) public usedProofs;
  mapping(address => bool) public authorizedRelayers;
  mapping(uint256 => uint256) public blockRequestCount;
  mapping(address => uint256[]) public userRequests;

  // State variables
  uint256 public nextRequestId = 1;
  uint256 public totalRequests;
  uint256 public fulfilledRequests;

  // Events
  event RelayerAuthorized(address indexed relayer, bool authorized);
  event MaxRequestsPerBlockUpdated(uint256 oldLimit, uint256 newLimit);
  event RequestTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);
  event ProofRejected(uint256 indexed requestId, string reason);
  event RequestExpired(uint256 indexed requestId);

  modifier onlyAuthorizedRelayer() {
    require(
      authorizedRelayers[msg.sender],
      "ZKRandomOracle: Unauthorized relayer"
    );
    _;
  }

  modifier validRequestId(uint256 requestId) {
    require(
      requestId > 0 && requestId < nextRequestId,
      "ZKRandomOracle: Invalid request ID"
    );
    _;
  }

  constructor(address _zkVerify, bytes32 _verificationKeyHash, address _owner) {
    require(
      _zkVerify != address(0),
      "ZKRandomOracle: Invalid zkVerify address"
    );
    require(
      _verificationKeyHash != bytes32(0),
      "ZKRandomOracle: Invalid verification key hash"
    );
    require(_owner != address(0), "ZKRandomOracle: Invalid owner address");

    zkVerify = IZKVerify(_zkVerify);
    verificationKeyHash = _verificationKeyHash;
    authorizedRelayers[_owner] = true;

    _transferOwnership(_owner);
  }

  /**
   * @dev Request randomness with a seed
   */
  function requestRandomness(
    bytes32 seed
  ) external payable override whenNotPaused nonReentrant returns (uint256) {
    require(msg.value >= requestFee, "ZKRandomOracle: Insufficient fee");
    require(VerifierLib.validateSeed(seed), "ZKRandomOracle: Invalid seed");
    require(
      blockRequestCount[block.number] < maxRequestsPerBlock,
      "ZKRandomOracle: Block request limit exceeded"
    );

    uint256 requestId = nextRequestId++;

    requests[requestId] = RandomnessRequest({
      requester: msg.sender,
      requestId: requestId,
      seed: seed,
      timestamp: block.timestamp,
      fulfilled: false,
      randomValue: 0,
      proofHash: bytes32(0)
    });

    userRequests[msg.sender].push(requestId);
    blockRequestCount[block.number]++;
    totalRequests++;

    emit RandomnessRequested(requestId, msg.sender, seed, msg.value);
    return requestId;
  }

  /**
   * @dev Fulfill randomness request with ZK proof
   */
  function fulfillRandomness(
    uint256 requestId,
    VerifierLib.ProofData calldata proof
  ) external onlyAuthorizedRelayer nonReentrant validRequestId(requestId) {
    RandomnessRequest storage request = requests[requestId];

    require(
      request.requester != address(0),
      "ZKRandomOracle: Request not found"
    );
    require(!request.fulfilled, "ZKRandomOracle: Request already fulfilled");
    require(
      block.timestamp <= request.timestamp + requestTimeout,
      "ZKRandomOracle: Request expired"
    );

    // Validate proof structure
    require(
      proof.validateProofStructure(),
      "ZKRandomOracle: Invalid proof structure"
    );
    require(
      VerifierLib.validateRandomnessInputs(proof.publicInputs),
      "ZKRandomOracle: Invalid public inputs"
    );

    // Check proof uniqueness
    bytes32 proofHash = proof.hashProof();
    require(!usedProofs[proofHash], "ZKRandomOracle: Proof already used");

    // Verify the ZK proof through zkVerify
    bool verified = zkVerify.verifyProof(
      verificationKeyHash,
      proof.a,
      proof.b,
      proof.c,
      proof.publicInputs
    );
    require(verified, "ZKRandomOracle: Invalid proof");

    // Extract random value
    uint256 randomValue = VerifierLib.extractRandomValue(proof.publicInputs);

    // Update request state
    request.fulfilled = true;
    request.randomValue = randomValue;
    request.proofHash = proofHash;
    usedProofs[proofHash] = true;
    fulfilledRequests++;

    emit RandomnessFulfilled(requestId, randomValue, proofHash);

    // Call callback if requester is a contract
    if (request.requester.isContract()) {
      try
        IZKRandomConsumer(request.requester).fulfillRandomness(
          requestId,
          randomValue
        )
      {
        // Callback successful
      } catch {
        // Callback failed, but randomness is still recorded
      }
    }
  }

  /**
   * @dev Get randomness for a specific request
   */
  function getRandomness(
    uint256 requestId
  ) external view override validRequestId(requestId) returns (uint256, bool) {
    RandomnessRequest memory request = requests[requestId];
    return (request.randomValue, request.fulfilled);
  }

  /**
   * @dev Get complete request details
   */
  function getRequest(
    uint256 requestId
  )
    external
    view
    override
    validRequestId(requestId)
    returns (RandomnessRequest memory)
  {
    return requests[requestId];
  }

  /**
   * @dev Check if a proof has been used
   */
  function isProofUsed(
    bytes32 proofHash
  ) external view override returns (bool) {
    return usedProofs[proofHash];
  }

  /**
   * @dev Get current request fee
   */
  function getRequestFee() external view override returns (uint256) {
    return requestFee;
  }

  /**
   * @dev Get user's request history
   */
  function getUserRequests(
    address user
  ) external view returns (uint256[] memory) {
    return userRequests[user];
  }

  /**
   * @dev Get oracle statistics
   */
  function getStats()
    external
    view
    returns (
      uint256 _totalRequests,
      uint256 _fulfilledRequests,
      uint256 _pendingRequests,
      uint256 _currentFee
    )
  {
    return (
      totalRequests,
      fulfilledRequests,
      totalRequests - fulfilledRequests,
      requestFee
    );
  }

  /**
   * @dev Expire old unfulfilled requests (anyone can call)
   */
  function expireRequest(uint256 requestId) external validRequestId(requestId) {
    RandomnessRequest storage request = requests[requestId];
    require(!request.fulfilled, "ZKRandomOracle: Request already fulfilled");
    require(
      block.timestamp > request.timestamp + requestTimeout,
      "ZKRandomOracle: Request not expired"
    );

    request.fulfilled = true; // Mark as fulfilled to prevent reuse
    emit RequestExpired(requestId);

    // Refund the requester
    payable(request.requester).transfer(requestFee);
  }

  // Admin functions

  /**
   * @dev Update verification key hash
   */
  function updateVerificationKey(bytes32 newKeyHash) external onlyOwner {
    require(newKeyHash != bytes32(0), "ZKRandomOracle: Invalid key hash");
    bytes32 oldKeyHash = verificationKeyHash;
    verificationKeyHash = newKeyHash;
    emit VerificationKeyUpdated(oldKeyHash, newKeyHash);
  }

  /**
   * @dev Set relayer authorization
   */
  function setRelayerAuthorization(
    address relayer,
    bool authorized
  ) external onlyOwner {
    require(relayer != address(0), "ZKRandomOracle: Invalid relayer address");
    authorizedRelayers[relayer] = authorized;
    emit RelayerAuthorized(relayer, authorized);
  }

  /**
   * @dev Update request fee
   */
  function updateRequestFee(uint256 newFee) external onlyOwner {
    uint256 oldFee = requestFee;
    requestFee = newFee;
    emit RequestFeeUpdated(oldFee, newFee);
  }

  /**
   * @dev Update max requests per block
   */
  function updateMaxRequestsPerBlock(uint256 newLimit) external onlyOwner {
    require(newLimit > 0, "ZKRandomOracle: Invalid limit");
    uint256 oldLimit = maxRequestsPerBlock;
    maxRequestsPerBlock = newLimit;
    emit MaxRequestsPerBlockUpdated(oldLimit, newLimit);
  }

  /**
   * @dev Update request timeout
   */
  function updateRequestTimeout(uint256 newTimeout) external onlyOwner {
    require(newTimeout > 0, "ZKRandomOracle: Invalid timeout");
    uint256 oldTimeout = requestTimeout;
    requestTimeout = newTimeout;
    emit RequestTimeoutUpdated(oldTimeout, newTimeout);
  }

  /**
   * @dev Pause the contract
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @dev Unpause the contract
   */
  function unpause() external onlyOwner {
    _unpause();
  }

  /**
   * @dev Withdraw contract balance
   */
  function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, "ZKRandomOracle: No funds to withdraw");
    payable(owner()).transfer(balance);
  }

  /**
   * @dev Emergency withdrawal of specific amount
   */
  function emergencyWithdraw(uint256 amount) external onlyOwner {
    require(
      amount <= address(this).balance,
      "ZKRandomOracle: Insufficient balance"
    );
    payable(owner()).transfer(amount);
  }
}
