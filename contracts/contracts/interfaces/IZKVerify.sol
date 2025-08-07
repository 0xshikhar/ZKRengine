// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IZKVerify
 * @dev Interface for Horizen zkVerify proof verification system
 */
interface IZKVerify {
  struct ProofData {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
    uint256[] publicInputs;
  }

  /**
   * @dev Verify a ZK proof using the specified verification key
   * @param verificationKeyHash Hash of the verification key
   * @param a Proof component A
   * @param b Proof component B
   * @param c Proof component C
   * @param publicInputs Public inputs for the proof
   * @return True if proof is valid, false otherwise
   */
  function verifyProof(
    bytes32 verificationKeyHash,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[] calldata publicInputs
  ) external view returns (bool);

  /**
   * @dev Submit proof for verification and cross-chain relay
   * @param proof The proof data to submit
   * @param targetChainId Chain ID where proof should be relayed
   * @return jobId Unique identifier for the verification job
   */
  function submitProof(
    ProofData calldata proof,
    uint256 targetChainId
  ) external returns (bytes32 jobId);

  /**
   * @dev Get status of a verification job
   * @param jobId The job identifier
   * @return status Current status of the job
   * @return transactionHash Transaction hash if finalized
   */
  function getJobStatus(
    bytes32 jobId
  ) external view returns (string memory status, bytes32 transactionHash);

  /**
   * @dev Register a new verification key
   * @param verificationKey The verification key to register
   * @return keyHash Hash of the registered key
   */
  function registerVerificationKey(
    bytes calldata verificationKey
  ) external returns (bytes32 keyHash);

  /**
   * @dev Event emitted when proof is submitted
   */
  event ProofSubmitted(
    bytes32 indexed jobId,
    address indexed submitter,
    uint256 targetChainId
  );

  /**
   * @dev Event emitted when proof verification is complete
   */
  event ProofVerified(
    bytes32 indexed jobId,
    bool verified,
    bytes32 transactionHash
  );

  /**
   * @dev Event emitted when verification key is registered
   */
  event VerificationKeyRegistered(
    bytes32 indexed keyHash,
    address indexed registrar
  );
}
