// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IZKRandomOracle
 * @dev Interface for ZK-based randomness oracle
 */
interface IZKRandomOracle {
  struct RandomnessRequest {
    address requester;
    uint256 requestId;
    bytes32 seed;
    uint256 timestamp;
    bool fulfilled;
    uint256 randomValue;
    bytes32 proofHash;
  }

  /**
   * @dev Request randomness with a seed
   * @param seed The seed for randomness generation
   * @return requestId Unique identifier for the request
   */
  function requestRandomness(
    bytes32 seed
  ) external payable returns (uint256 requestId);

  /**
   * @dev Get randomness for a specific request
   * @param requestId The request identifier
   * @return randomValue The generated random value
   * @return fulfilled Whether the request has been fulfilled
   */
  function getRandomness(
    uint256 requestId
  ) external view returns (uint256 randomValue, bool fulfilled);

  /**
   * @dev Get request details
   * @param requestId The request identifier
   * @return request The complete request data
   */
  function getRequest(
    uint256 requestId
  ) external view returns (RandomnessRequest memory request);

  /**
   * @dev Check if a proof has been used
   * @param proofHash Hash of the proof
   * @return used Whether the proof has been used
   */
  function isProofUsed(bytes32 proofHash) external view returns (bool used);

  /**
   * @dev Get the current request fee
   * @return fee The fee required for randomness requests
   */
  function getRequestFee() external view returns (uint256 fee);

  /**
   * @dev Event emitted when randomness is requested
   */
  event RandomnessRequested(
    uint256 indexed requestId,
    address indexed requester,
    bytes32 seed,
    uint256 fee
  );

  /**
   * @dev Event emitted when randomness is fulfilled
   */
  event RandomnessFulfilled(
    uint256 indexed requestId,
    uint256 randomValue,
    bytes32 proofHash
  );

  /**
   * @dev Event emitted when request fee is updated
   */
  event RequestFeeUpdated(uint256 oldFee, uint256 newFee);

  /**
   * @dev Event emitted when verification key is updated
   */
  event VerificationKeyUpdated(
    bytes32 indexed oldKeyHash,
    bytes32 indexed newKeyHash
  );
}

/**
 * @title IZKRandomConsumer
 * @dev Interface for contracts that consume ZK randomness
 */
interface IZKRandomConsumer {
  /**
   * @dev Callback function called when randomness is fulfilled
   * @param requestId The request identifier
   * @param randomValue The generated random value
   */
  function fulfillRandomness(uint256 requestId, uint256 randomValue) external;
}
