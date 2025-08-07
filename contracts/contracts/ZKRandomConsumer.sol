// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IZKRandomOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ZKRandomConsumer
 * @dev Base contract for consuming ZK randomness from the oracle
 */
abstract contract ZKRandomConsumer is Ownable, ReentrancyGuard {
  IZKRandomOracle public immutable zkRandomOracle;

  mapping(uint256 => bool) internal pendingRequests;
  mapping(bytes32 => uint256) internal seedToRequestId;

  event RandomnessRequested(uint256 indexed requestId, bytes32 seed);
  event RandomnessReceived(uint256 indexed requestId, uint256 randomValue);

  modifier onlyOracle() {
    require(
      msg.sender == address(zkRandomOracle),
      "ZKRandomConsumer: Only oracle can call"
    );
    _;
  }

  constructor(address _zkRandomOracle) {
    require(
      _zkRandomOracle != address(0),
      "ZKRandomConsumer: Invalid oracle address"
    );
    zkRandomOracle = IZKRandomOracle(_zkRandomOracle);
  }

  /**
   * @dev Request randomness from the oracle
   * @param seed The seed for randomness generation
   * @return requestId The ID of the randomness request
   */
  function requestRandomness(
    bytes32 seed
  ) internal returns (uint256 requestId) {
    require(seedToRequestId[seed] == 0, "ZKRandomConsumer: Seed already used");

    uint256 fee = zkRandomOracle.getRequestFee();
    require(
      address(this).balance >= fee,
      "ZKRandomConsumer: Insufficient balance for fee"
    );

    requestId = zkRandomOracle.requestRandomness{value: fee}(seed);
    pendingRequests[requestId] = true;
    seedToRequestId[seed] = requestId;

    emit RandomnessRequested(requestId, seed);
    return requestId;
  }

  /**
   * @dev Callback function called by oracle when randomness is fulfilled
   * @param requestId The request ID
   * @param randomValue The generated random value
   */
  function fulfillRandomness(
    uint256 requestId,
    uint256 randomValue
  ) external onlyOracle nonReentrant {
    require(
      pendingRequests[requestId],
      "ZKRandomConsumer: Request not pending"
    );

    pendingRequests[requestId] = false;
    emit RandomnessReceived(requestId, randomValue);

    _fulfillRandomness(requestId, randomValue);
  }

  /**
   * @dev Internal function to be implemented by consuming contracts
   * @param requestId The request ID
   * @param randomValue The generated random value
   */
  function _fulfillRandomness(
    uint256 requestId,
    uint256 randomValue
  ) internal virtual;

  /**
   * @dev Check if a request is pending
   * @param requestId The request ID to check
   * @return pending True if request is pending
   */
  function isRequestPending(
    uint256 requestId
  ) external view returns (bool pending) {
    return pendingRequests[requestId];
  }

  /**
   * @dev Get request ID for a seed
   * @param seed The seed to check
   * @return requestId The associated request ID (0 if not found)
   */
  function getRequestIdForSeed(
    bytes32 seed
  ) external view returns (uint256 requestId) {
    return seedToRequestId[seed];
  }

  /**
   * @dev Fund the contract for randomness requests
   */
  function fundContract() external payable {
    // Allow funding the contract
  }

  /**
   * @dev Withdraw excess funds (only owner)
   */
  function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    require(balance > 0, "ZKRandomConsumer: No funds to withdraw");
    payable(owner()).transfer(balance);
  }

  /**
   * @dev Get contract balance
   */
  function getBalance() external view returns (uint256) {
    return address(this).balance;
  }
}

/**
 * @title ExampleRandomConsumer
 * @dev Example implementation of a randomness consumer
 */
contract ExampleRandomConsumer is ZKRandomConsumer {
  struct RandomResult {
    uint256 requestId;
    uint256 randomValue;
    uint256 timestamp;
    address requester;
  }

  mapping(uint256 => RandomResult) public results;
  mapping(address => uint256[]) public userResults;
  uint256 public totalResults;

  event RandomValueGenerated(
    uint256 indexed requestId,
    address indexed requester,
    uint256 randomValue,
    uint256 timestamp
  );

  constructor(address _zkRandomOracle) ZKRandomConsumer(_zkRandomOracle) {}

  /**
   * @dev Request a random number
   * @param seed Custom seed for the request
   * @return requestId The ID of the randomness request
   */
  function requestRandomNumber(
    bytes32 seed
  ) external payable returns (uint256 requestId) {
    requestId = requestRandomness(seed);
    return requestId;
  }

  /**
   * @dev Internal function called when randomness is fulfilled
   */
  function _fulfillRandomness(
    uint256 requestId,
    uint256 randomValue
  ) internal override {
    results[requestId] = RandomResult({
      requestId: requestId,
      randomValue: randomValue,
      timestamp: block.timestamp,
      requester: tx.origin // Note: Using tx.origin for simplicity, consider security implications
    });

    userResults[tx.origin].push(requestId);
    totalResults++;

    emit RandomValueGenerated(
      requestId,
      tx.origin,
      randomValue,
      block.timestamp
    );
  }

  /**
   * @dev Get random result by request ID
   */
  function getResult(
    uint256 requestId
  ) external view returns (RandomResult memory) {
    return results[requestId];
  }

  /**
   * @dev Get user's random results
   */
  function getUserResults(
    address user
  ) external view returns (uint256[] memory) {
    return userResults[user];
  }

  /**
   * @dev Generate random number in range [min, max)
   */
  function getRandomInRange(
    uint256 requestId,
    uint256 min,
    uint256 max
  ) external view returns (uint256) {
    require(max > min, "ExampleRandomConsumer: Invalid range");
    RandomResult memory result = results[requestId];
    require(
      result.randomValue != 0,
      "ExampleRandomConsumer: Random value not available"
    );

    return (result.randomValue % (max - min)) + min;
  }

  /**
   * @dev Generate random boolean
   */
  function getRandomBool(uint256 requestId) external view returns (bool) {
    RandomResult memory result = results[requestId];
    require(
      result.randomValue != 0,
      "ExampleRandomConsumer: Random value not available"
    );

    return result.randomValue % 2 == 0;
  }

  /**
   * @dev Generate array of random numbers from single result
   */
  function getRandomArray(
    uint256 requestId,
    uint256 length
  ) external view returns (uint256[] memory) {
    require(
      length > 0 && length <= 32,
      "ExampleRandomConsumer: Invalid array length"
    );
    RandomResult memory result = results[requestId];
    require(
      result.randomValue != 0,
      "ExampleRandomConsumer: Random value not available"
    );

    uint256[] memory randomArray = new uint256[](length);
    uint256 seed = result.randomValue;

    for (uint256 i = 0; i < length; i++) {
      randomArray[i] = uint256(keccak256(abi.encodePacked(seed, i)));
      seed = randomArray[i];
    }

    return randomArray;
  }
}
