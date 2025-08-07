// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VerifierLib
 * @dev Library for ZK proof verification utilities
 */
library VerifierLib {
  struct ProofData {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
    uint256[] publicInputs;
  }

  /**
   * @dev Validate proof structure
   * @param proof The proof to validate
   * @return valid True if proof structure is valid
   */
  function validateProofStructure(
    ProofData memory proof
  ) internal pure returns (bool valid) {
    // Check that proof components are not zero
    if (proof.a[0] == 0 && proof.a[1] == 0) return false;
    if (proof.c[0] == 0 && proof.c[1] == 0) return false;

    // Check b component
    if (
      proof.b[0][0] == 0 &&
      proof.b[0][1] == 0 &&
      proof.b[1][0] == 0 &&
      proof.b[1][1] == 0
    ) return false;

    // Check public inputs exist
    if (proof.publicInputs.length == 0) return false;

    return true;
  }

  /**
   * @dev Hash proof components for uniqueness check
   * @param proof The proof to hash
   * @return proofHash Unique hash of the proof
   */
  function hashProof(
    ProofData memory proof
  ) internal pure returns (bytes32 proofHash) {
    return
      keccak256(
        abi.encodePacked(
          proof.a[0],
          proof.a[1],
          proof.b[0][0],
          proof.b[0][1],
          proof.b[1][0],
          proof.b[1][1],
          proof.c[0],
          proof.c[1],
          proof.publicInputs
        )
      );
  }

  /**
   * @dev Validate public inputs for randomness circuit
   * @param publicInputs Array of public inputs
   * @return valid True if inputs are valid
   */
  function validateRandomnessInputs(
    uint256[] memory publicInputs
  ) internal pure returns (bool valid) {
    // Expect exactly 2 public outputs: randomValue and proof
    if (publicInputs.length != 2) return false;

    // Random value should be non-zero
    if (publicInputs[0] == 0) return false;

    // Proof component should be non-zero
    if (publicInputs[1] == 0) return false;

    return true;
  }

  /**
   * @dev Extract random value from public inputs
   * @param publicInputs Array of public inputs
   * @return randomValue The extracted random value
   */
  function extractRandomValue(
    uint256[] memory publicInputs
  ) internal pure returns (uint256 randomValue) {
    require(publicInputs.length >= 1, "Invalid public inputs");
    return publicInputs[0];
  }

  /**
   * @dev Validate seed format
   * @param seed The seed to validate
   * @return valid True if seed is valid
   */
  function validateSeed(bytes32 seed) internal pure returns (bool valid) {
    return seed != bytes32(0);
  }

  /**
   * @dev Generate request hash for tracking
   * @param requester Address of the requester
   * @param seed The seed used
   * @param timestamp Request timestamp
   * @return requestHash Unique hash for the request
   */
  function generateRequestHash(
    address requester,
    bytes32 seed,
    uint256 timestamp
  ) internal pure returns (bytes32 requestHash) {
    return keccak256(abi.encodePacked(requester, seed, timestamp));
  }

  /**
   * @dev Check if value is within valid field range
   * @param value The value to check
   * @return valid True if value is valid
   */
  function isValidFieldElement(
    uint256 value
  ) internal pure returns (bool valid) {
    // BN128 field modulus
    uint256 fieldModulus = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    return value < fieldModulus;
  }

  /**
   * @dev Normalize random value to specific range
   * @param randomValue The random value to normalize
   * @param min Minimum value (inclusive)
   * @param max Maximum value (exclusive)
   * @return normalized The normalized value
   */
  function normalizeToRange(
    uint256 randomValue,
    uint256 min,
    uint256 max
  ) internal pure returns (uint256 normalized) {
    require(max > min, "Invalid range");
    return (randomValue % (max - min)) + min;
  }

  /**
   * @dev Convert random value to boolean
   * @param randomValue The random value
   * @return result True if even, false if odd
   */
  function randomToBool(
    uint256 randomValue
  ) internal pure returns (bool result) {
    return randomValue % 2 == 0;
  }

  /**
   * @dev Generate multiple random values from single proof
   * @param randomValue Base random value
   * @param count Number of values to generate
   * @return values Array of random values
   */
  function expandRandomness(
    uint256 randomValue,
    uint256 count
  ) internal pure returns (uint256[] memory values) {
    require(count > 0 && count <= 32, "Invalid count");

    values = new uint256[](count);
    uint256 current = randomValue;

    for (uint256 i = 0; i < count; i++) {
      values[i] = uint256(keccak256(abi.encodePacked(current, i)));
      current = values[i];
    }

    return values;
  }
}
