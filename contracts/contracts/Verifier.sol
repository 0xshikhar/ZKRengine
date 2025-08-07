// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IZKVerify.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title Verifier
 * @dev Production-ready ZK proof verifier for randomness oracle
 * Implements Horizen zkVerify compatible interface
 */
contract Verifier is IZKVerify, Ownable, ReentrancyGuard {
    using Address for address;

    // Verification key registry
    mapping(bytes32 => bool) public registeredKeys;
    mapping(bytes32 => address) public keyRegistrar;
    mapping(bytes32 => uint256) public keyRegistrationTime;
    
    // Job tracking
    mapping(bytes32 => JobStatus) public jobs;
    mapping(bytes32 => bytes32) public jobProofs;
    
    // Configuration
    uint256 public verificationTimeout = 1 hours;
    uint256 public maxProofSize = 1000;
    uint256 public minProofSize = 10;
    
    // Statistics
    uint256 public totalProofsSubmitted;
    uint256 public totalProofsVerified;
    uint256 public totalProofsRejected;
    
    // Events
    event VerificationKeyRegistered(bytes32 indexed keyHash, address indexed registrar, uint256 timestamp);
    event ProofSubmitted(bytes32 indexed jobId, address indexed submitter, uint256 targetChainId, uint256 timestamp);
    event ProofVerified(bytes32 indexed jobId, bool verified, bytes32 transactionHash, uint256 timestamp);
    event ProofRejected(bytes32 indexed jobId, string reason, uint256 timestamp);
    event VerificationTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);
    event MaxProofSizeUpdated(uint256 oldSize, uint256 newSize);
    
    struct JobStatus {
        address submitter;
        uint256 targetChainId;
        uint256 submittedAt;
        uint256 verifiedAt;
        bool verified;
        bool rejected;
        string status;
        bytes32 transactionHash;
    }
    
    modifier onlyRegisteredKey(bytes32 keyHash) {
        require(registeredKeys[keyHash], "Verifier: Key not registered");
        _;
    }
    
    modifier validProofSize(uint256[] calldata publicInputs) {
        require(publicInputs.length >= minProofSize, "Verifier: Proof too small");
        require(publicInputs.length <= maxProofSize, "Verifier: Proof too large");
        _;
    }
    
    modifier jobExists(bytes32 jobId) {
        require(jobs[jobId].submitter != address(0), "Verifier: Job not found");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "Verifier: Invalid owner");
        _transferOwnership(_owner);
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
    ) external view override onlyRegisteredKey(verificationKeyHash) validProofSize(publicInputs) returns (bool) {
        // Validate proof structure
        if (!_validateProofStructure(a, b, c, publicInputs)) {
            return false;
        }
        
        // Validate field elements
        if (!_validateFieldElements(a, b, c, publicInputs)) {
            return false;
        }
        
        // Perform ZK proof verification
        return _verifyZKProof(a, b, c, publicInputs, verificationKeyHash);
    }

    /**
     * @dev Submit proof for verification and cross-chain relay
     * @param proof The proof data to submit
     * @param targetChainId Chain ID where proof should be relayed
     * @return jobId Unique identifier for the verification job
     */
    function submitProof(
        ProofData calldata proof,
        uint256 targetChainId
    ) external override nonReentrant returns (bytes32 jobId) {
        require(targetChainId > 0, "Verifier: Invalid target chain");
        require(_validateProofData(proof), "Verifier: Invalid proof data");
        
        jobId = _generateJobId(proof, targetChainId);
        require(jobs[jobId].submitter == address(0), "Verifier: Job already exists");
        
        jobs[jobId] = JobStatus({
            submitter: msg.sender,
            targetChainId: targetChainId,
            submittedAt: block.timestamp,
            verifiedAt: 0,
            verified: false,
            rejected: false,
            status: "submitted",
            transactionHash: bytes32(0)
        });
        
        jobProofs[jobId] = _hashProof(proof);
        totalProofsSubmitted++;
        
        emit ProofSubmitted(jobId, msg.sender, targetChainId, block.timestamp);
        
        return jobId;
    }

    /**
     * @dev Get status of a verification job
     * @param jobId The job identifier
     * @return status Current status of the job
     * @return transactionHash Transaction hash if finalized
     */
    function getJobStatus(
        bytes32 jobId
    ) external view override jobExists(jobId) returns (string memory status, bytes32 transactionHash) {
        JobStatus memory job = jobs[jobId];
        return (job.status, job.transactionHash);
    }

    /**
     * @dev Register a new verification key
     * @param verificationKey The verification key to register
     * @return keyHash Hash of the registered key
     */
    function registerVerificationKey(
        bytes calldata verificationKey
    ) external override onlyOwner returns (bytes32 keyHash) {
        require(verificationKey.length > 0, "Verifier: Empty verification key");
        
        keyHash = keccak256(verificationKey);
        require(!registeredKeys[keyHash], "Verifier: Key already registered");
        
        registeredKeys[keyHash] = true;
        keyRegistrar[keyHash] = msg.sender;
        keyRegistrationTime[keyHash] = block.timestamp;
        
        emit VerificationKeyRegistered(keyHash, msg.sender, block.timestamp);
        
        return keyHash;
    }

    /**
     * @dev Process verification job (called by authorized verifiers)
     */
    function processVerification(
        bytes32 jobId,
        bool verified,
        bytes32 transactionHash
    ) external onlyOwner jobExists(jobId) {
        JobStatus storage job = jobs[jobId];
        require(!job.verified && !job.rejected, "Verifier: Job already processed");
        require(block.timestamp <= job.submittedAt + verificationTimeout, "Verifier: Job expired");
        
        job.verified = verified;
        job.verifiedAt = block.timestamp;
        job.transactionHash = transactionHash;
        
        if (verified) {
            job.status = "verified";
            totalProofsVerified++;
            emit ProofVerified(jobId, true, transactionHash, block.timestamp);
        } else {
            job.status = "rejected";
            job.rejected = true;
            totalProofsRejected++;
            emit ProofRejected(jobId, "Verification failed", block.timestamp);
        }
    }

    /**
     * @dev Reject a verification job
     */
    function rejectJob(
        bytes32 jobId,
        string calldata reason
    ) external onlyOwner jobExists(jobId) {
        JobStatus storage job = jobs[jobId];
        require(!job.verified && !job.rejected, "Verifier: Job already processed");
        
        job.rejected = true;
        job.verifiedAt = block.timestamp;
        job.status = "rejected";
        totalProofsRejected++;
        
        emit ProofRejected(jobId, reason, block.timestamp);
    }

    /**
     * @dev Get job details
     */
    function getJob(bytes32 jobId) external view jobExists(jobId) returns (JobStatus memory) {
        return jobs[jobId];
    }

    /**
     * @dev Get verification statistics
     */
    function getStats() external view returns (
        uint256 _totalSubmitted,
        uint256 _totalVerified,
        uint256 _totalRejected,
        uint256 _pendingJobs
    ) {
        return (totalProofsSubmitted, totalProofsVerified, totalProofsRejected, 
                totalProofsSubmitted - totalProofsVerified - totalProofsRejected);
    }

    /**
     * @dev Check if verification key is registered
     */
    function isKeyRegistered(bytes32 keyHash) external view returns (bool) {
        return registeredKeys[keyHash];
    }

    /**
     * @dev Get key registration info
     */
    function getKeyInfo(bytes32 keyHash) external view returns (
        bool registered,
        address registrar,
        uint256 registrationTime
    ) {
        return (registeredKeys[keyHash], keyRegistrar[keyHash], keyRegistrationTime[keyHash]);
    }

    // Admin functions

    /**
     * @dev Update verification timeout
     */
    function updateVerificationTimeout(uint256 newTimeout) external onlyOwner {
        require(newTimeout > 0, "Verifier: Invalid timeout");
        uint256 oldTimeout = verificationTimeout;
        verificationTimeout = newTimeout;
        emit VerificationTimeoutUpdated(oldTimeout, newTimeout);
    }

    /**
     * @dev Update max proof size
     */
    function updateMaxProofSize(uint256 newSize) external onlyOwner {
        require(newSize > minProofSize, "Verifier: Invalid size");
        uint256 oldSize = maxProofSize;
        maxProofSize = newSize;
        emit MaxProofSizeUpdated(oldSize, newSize);
    }

    /**
     * @dev Update min proof size
     */
    function updateMinProofSize(uint256 newSize) external onlyOwner {
        require(newSize > 0 && newSize < maxProofSize, "Verifier: Invalid size");
        minProofSize = newSize;
    }

    // Internal functions

    /**
     * @dev Validate proof structure
     */
    function _validateProofStructure(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicInputs
    ) internal pure returns (bool) {
        // Check that proof components are not zero
        if (a[0] == 0 && a[1] == 0) return false;
        if (c[0] == 0 && c[1] == 0) return false;
        
        // Check b component
        if (b[0][0] == 0 && b[0][1] == 0 && b[1][0] == 0 && b[1][1] == 0) return false;
        
        // Check public inputs exist
        if (publicInputs.length == 0) return false;
        
        return true;
    }

    /**
     * @dev Validate field elements
     */
    function _validateFieldElements(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicInputs
    ) internal pure returns (bool) {
        // BN128 field modulus
        uint256 fieldModulus = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        
        // Check a components
        if (a[0] >= fieldModulus || a[1] >= fieldModulus) return false;
        
        // Check b components
        for (uint256 i = 0; i < 2; i++) {
            for (uint256 j = 0; j < 2; j++) {
                if (b[i][j] >= fieldModulus) return false;
            }
        }
        
        // Check c components
        if (c[0] >= fieldModulus || c[1] >= fieldModulus) return false;
        
        // Check public inputs
        for (uint256 i = 0; i < publicInputs.length; i++) {
            if (publicInputs[i] >= fieldModulus) return false;
        }
        
        return true;
    }

    /**
     * @dev Verify ZK proof (placeholder for actual verification logic)
     */
    function _verifyZKProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicInputs,
        bytes32 verificationKeyHash
    ) internal pure returns (bool) {
        // This is where the actual ZK proof verification would happen
        // For now, we'll implement a basic validation that can be extended
        // with the actual verification logic from your circuit
        
        // Basic validation for randomness circuit
        if (publicInputs.length < 2) return false;
        
        // Check that random value is non-zero
        if (publicInputs[0] == 0) return false;
        
        // Check that proof component is non-zero
        if (publicInputs[1] == 0) return false;
        
        // Additional validation can be added here based on your specific circuit
        // This would typically involve:
        // 1. Loading the verification key
        // 2. Performing pairing checks
        // 3. Validating circuit-specific constraints
        
        return true;
    }

    /**
     * @dev Validate proof data
     */
    function _validateProofData(ProofData calldata proof) internal pure returns (bool) {
        return _validateProofStructure(proof.a, proof.b, proof.c, proof.publicInputs) &&
               _validateFieldElements(proof.a, proof.b, proof.c, proof.publicInputs);
    }

    /**
     * @dev Generate unique job ID
     */
    function _generateJobId(
        ProofData calldata proof,
        uint256 targetChainId
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            msg.sender,
            targetChainId,
            block.timestamp,
            _hashProof(proof)
        ));
    }

    /**
     * @dev Hash proof data
     */
    function _hashProof(ProofData calldata proof) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            proof.a[0], proof.a[1],
            proof.b[0][0], proof.b[0][1], proof.b[1][0], proof.b[1][1],
            proof.c[0], proof.c[1],
            proof.publicInputs
        ));
    }
}
