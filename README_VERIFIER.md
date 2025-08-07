# ZK Verifier System - Production Guide

## Overview

The ZK Verifier system provides production-ready zero-knowledge proof verification for the ZKRandom oracle. It implements secure, efficient, and scalable proof verification with support for cross-chain relay capabilities.

## Quick Start

### 1. Deploy the Verifier Contract

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY="your_private_key"
export NETWORK="base-sepolia"

# Deploy verifier
npx hardhat run deploy/deploy-verifier.ts --network $NETWORK
```

### 2. Compile and Generate Verification Key

```bash
# Navigate to circuits directory
cd circuits

# Compile the randomness circuit
circom randomness.circom --r1cs --wasm --sym --c

# Generate verification key
node generate-verification-key.js generate
```

### 3. Register Verification Key

```bash
# Set verifier address
export VERIFIER_ADDRESS="deployed_verifier_address"

# Register the verification key
node generate-verification-key.js register
```

### 4. Configure Oracle with Verifier

```bash
# Deploy oracle with verifier address
npx hardhat run deploy/deploy-oracle.ts --network $NETWORK
```

## System Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ZKRandomOracle│    │     Verifier    │    │   VerifierLib   │
│                 │    │                 │    │                 │
│ • Request Mgmt  │◄──►│ • Proof Verify  │◄──►│ • Utilities     │
│ • Fulfillment   │    │ • Job Mgmt      │    │ • Validation    │
│ • Callbacks     │    │ • Key Registry  │    │ • Extraction    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow

1. **User Request**: User calls `requestRandomness(seed)` on oracle
2. **Proof Generation**: Relayer generates ZK proof off-chain
3. **Proof Submission**: Relayer submits proof to verifier
4. **Verification**: Verifier validates proof structure and field elements
5. **Fulfillment**: Oracle extracts random value and fulfills request

## Production Deployment

### Prerequisites

- Node.js 16+
- Hardhat
- Circom compiler
- Access to target blockchain network

### Environment Setup

```bash
# Install dependencies
npm install

# Set environment variables
export DEPLOYER_PRIVATE_KEY="your_private_key"
export NETWORK="base-sepolia"
export ETHERSCAN_API_KEY="your_api_key"
export VERIFIER_ADDRESS="deployed_address"
```

### Deployment Steps

1. **Deploy Verifier**
   ```bash
   npx hardhat run deploy/deploy-verifier.ts --network $NETWORK
   ```

2. **Compile Circuit**
   ```bash
   cd circuits
   circom randomness.circom --r1cs --wasm --sym --c
   ```

3. **Generate Verification Key**
   ```bash
   node generate-verification-key.js generate
   ```

4. **Register Key**
   ```bash
   node generate-verification-key.js register
   ```

5. **Deploy Oracle**
   ```bash
   npx hardhat run deploy/deploy-oracle.ts --network $NETWORK
   ```

### Configuration

#### Verifier Settings

```solidity
// Default configuration
verificationTimeout = 1 hours
maxProofSize = 1000
minProofSize = 10
```

#### Oracle Settings

```solidity
// Default configuration
requestFee = 0.001 ether
maxRequestsPerBlock = 10
requestTimeout = 1 hours
```

## API Reference

### Verifier Contract

#### Core Functions

```solidity
// Verify a ZK proof
function verifyProof(
    bytes32 verificationKeyHash,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[] calldata publicInputs
) external view returns (bool);

// Submit proof for verification
function submitProof(
    ProofData calldata proof,
    uint256 targetChainId
) external returns (bytes32 jobId);

// Register verification key
function registerVerificationKey(
    bytes calldata verificationKey
) external returns (bytes32 keyHash);
```

#### Admin Functions

```solidity
// Update verification timeout
function updateVerificationTimeout(uint256 newTimeout) external onlyOwner;

// Update proof size limits
function updateMaxProofSize(uint256 newSize) external onlyOwner;
function updateMinProofSize(uint256 newSize) external onlyOwner;

// Process verification job
function processVerification(
    bytes32 jobId,
    bool verified,
    bytes32 transactionHash
) external onlyOwner;
```

### Oracle Contract

#### User Functions

```solidity
// Request randomness
function requestRandomness(bytes32 seed) external payable returns (uint256);

// Get randomness for request
function getRandomness(uint256 requestId) external view returns (uint256, bool);

// Get request details
function getRequest(uint256 requestId) external view returns (RandomnessRequest memory);
```

#### Relayer Functions

```solidity
// Fulfill randomness request
function fulfillRandomness(
    uint256 requestId,
    VerifierLib.ProofData calldata proof
) external onlyAuthorizedRelayer;
```

## Testing

### Run Tests

```bash
# Run all tests
npx hardhat test

# Run verifier tests only
npx hardhat test test/Verifier.test.ts

# Run with coverage
npx hardhat coverage
```

### Test Coverage

- ✅ Deployment and initialization
- ✅ Verification key management
- ✅ Proof verification (valid/invalid)
- ✅ Job submission and processing
- ✅ Admin functions and access control
- ✅ Statistics and monitoring
- ✅ Error handling and edge cases

## Monitoring and Maintenance

### Health Checks

```bash
# Check contract status
npx hardhat run scripts/health-check.js --network $NETWORK

# Monitor job queue
npx hardhat run scripts/monitor-jobs.js --network $NETWORK

# Check statistics
npx hardhat run scripts/get-stats.js --network $NETWORK
```

### Key Metrics

- **Total Proofs Submitted**: Number of proofs submitted for verification
- **Total Proofs Verified**: Number of successfully verified proofs
- **Total Proofs Rejected**: Number of rejected proofs
- **Pending Jobs**: Number of jobs awaiting processing
- **Average Processing Time**: Time to process verification jobs

### Maintenance Tasks

1. **Regular Key Updates**: Register new verification keys as needed
2. **Configuration Tuning**: Adjust timeouts and limits based on usage
3. **Performance Monitoring**: Track gas usage and optimize
4. **Security Audits**: Regular security reviews

## Security Considerations

### Access Control

- Only contract owner can register verification keys
- Only authorized relayers can fulfill randomness requests
- Admin functions are protected with `onlyOwner` modifier

### Input Validation

- All proof components are validated for structure
- Field elements are checked against BN128 field modulus
- Public inputs are validated for circuit-specific constraints

### Reentrancy Protection

- All external calls are protected with `ReentrancyGuard`
- State changes are made before external calls

### Gas Optimization

- Efficient data structures for storage
- Optimized proof validation algorithms
- Configurable limits to prevent DoS attacks

## Troubleshooting

### Common Issues

#### Proof Rejection
```
Error: Verifier: Invalid proof structure
```
**Solution**: Check that proof components are non-zero and properly formatted

#### Job Timeout
```
Error: Verifier: Job expired
```
**Solution**: Process jobs within the configured timeout period

#### Gas Failures
```
Error: out of gas
```
**Solution**: Optimize proof size or increase gas limit

#### Key Issues
```
Error: Verifier: Key not registered
```
**Solution**: Ensure verification key is properly registered

### Debugging Tools

```bash
# Check job status
npx hardhat run scripts/check-job.js --network $NETWORK --job-id <job_id>

# Verify proof structure
npx hardhat run scripts/validate-proof.js --network $NETWORK

# Monitor events
npx hardhat run scripts/monitor-events.js --network $NETWORK
```

## Performance Optimization

### Gas Optimization

1. **Efficient Storage**: Use packed structs and optimized data types
2. **Batch Operations**: Process multiple proofs in single transaction
3. **Lazy Loading**: Load verification keys only when needed
4. **Memory Management**: Minimize memory allocations

### Scalability Features

1. **Asynchronous Processing**: Non-blocking proof verification
2. **Cross-Chain Support**: Multi-chain proof relay
3. **Configurable Limits**: Adjustable parameters for different use cases
4. **Monitoring**: Real-time performance tracking

## Integration Examples

### Basic Integration

```javascript
const { ethers } = require('hardhat');

async function requestRandomness() {
    const oracle = await ethers.getContract('ZKRandomOracle');
    const seed = ethers.utils.randomBytes(32);
    
    const tx = await oracle.requestRandomness(seed, { value: ethers.utils.parseEther('0.001') });
    const receipt = await tx.wait();
    
    // Extract request ID from events
    const event = receipt.events.find(e => e.event === 'RandomnessRequested');
    const requestId = event.args.requestId;
    
    return requestId;
}
```

### Proof Submission

```javascript
async function submitProof(requestId, proof) {
    const verifier = await ethers.getContract('Verifier');
    
    const jobId = await verifier.submitProof(proof, 1); // targetChainId = 1
    
    // Monitor job status
    const [status, txHash] = await verifier.getJobStatus(jobId);
    
    return { jobId, status, txHash };
}
```

### Fulfillment

```javascript
async function fulfillRandomness(requestId, proof) {
    const oracle = await ethers.getContract('ZKRandomOracle');
    
    const tx = await oracle.fulfillRandomness(requestId, proof);
    const receipt = await tx.wait();
    
    // Extract random value from events
    const event = receipt.events.find(e => e.event === 'RandomnessFulfilled');
    const randomValue = event.args.randomValue;
    
    return randomValue;
}
```

## Advanced Features

### Cross-Chain Relay

The verifier supports cross-chain proof relay:

```javascript
// Submit proof for relay to different chain
const jobId = await verifier.submitProof(proof, targetChainId);

// Monitor relay status
const [status, txHash] = await verifier.getJobStatus(jobId);
```

### Batch Processing

Process multiple proofs efficiently:

```javascript
// Submit multiple proofs
const jobIds = [];
for (const proof of proofs) {
    const jobId = await verifier.submitProof(proof, 1);
    jobIds.push(jobId);
}

// Process all jobs
for (const jobId of jobIds) {
    await verifier.processVerification(jobId, true, ethers.constants.HashZero);
}
```

### Custom Circuit Support

The verifier can be extended to support custom circuits:

```solidity
// Register verification key for custom circuit
bytes32 customKeyHash = verifier.registerVerificationKey(customVerificationKey);

// Verify proof with custom circuit
bool verified = verifier.verifyProof(customKeyHash, a, b, c, publicInputs);
```

## Support and Resources

### Documentation

- [System Architecture](docs/VERIFIER_SYSTEM.md)
- [API Reference](docs/API_REFERENCE.md)
- [Security Guide](docs/SECURITY.md)

### Community

- GitHub Issues: [Report bugs and feature requests](https://github.com/your-repo/issues)
- Discord: [Join our community](https://discord.gg/your-server)
- Twitter: [Follow for updates](https://twitter.com/your-handle)

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details. 