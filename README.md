# ZKRandom Engine

A multi-chain ZK proof-based randomness oracle using Horizen's zkVerify for secure, verifiable randomness generation across EVM-compatible blockchains.

## 🌟 Features

- **Multi-Chain Support**: Base, Ethereum, Polygon, and any EVM-compatible chain
- **ZK Proof Verification**: Uses Horizen zkVerify for trustless proof verification
- **Entropy Mixing**: Combines multiple entropy sources for enhanced security
- **REST API**: Complete API for randomness requests and status monitoring
- **Real-time Monitoring**: Prometheus metrics and Grafana dashboards
- **Docker Support**: Easy deployment with containerization
- **Rate Limiting**: Built-in protection against spam and abuse

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   REST API      │    │   ZK Circuits   │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   (Circom)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Smart         │    │   Database      │    │   zkVerify      │
│   Contracts     │    │   (MongoDB)     │    │   Relayer       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- MongoDB
- Redis

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zkr-engine
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd api && npm install
   cd ../circuits && npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Compile circuits**
   ```bash
   npm run compile:circuits
   ```

5. **Deploy contracts** (optional)
   ```bash
   npm run deploy:contracts base-sepolia
   ```

6. **Start services**
   ```bash
   # Using Docker
   npm run docker:up
   
   # Or manually
   npm run api:dev  # API server
   npm run dev      # Frontend
   ```

## 📚 API Documentation

### Request Randomness

```bash
POST /api/v1/randomness/request
```

```json
{
  "chainId": 8453,
  "seed": "0x1234567890abcdef...",
  "requester": "0xYourAddress...",
  "callbackAddress": "0xOptionalCallback..." // optional
}
```

### Get Request Status

```bash
GET /api/v1/randomness/request/{requestId}
```

### Get User Requests

```bash
GET /api/v1/randomness/user/{address}?page=1&limit=20
```

### Get Statistics

```bash
GET /api/v1/randomness/statistics?timeRange=24h
```

## 🔧 Configuration

### Chain Configuration

Edit `config/chains.json` to add or modify supported chains:

```json
{
  "supportedChains": {
    "8453": {
      "name": "Base Mainnet",
      "rpcUrl": "https://mainnet.base.org",
      "zkVerifyAddress": "0x...",
      "oracleAddress": "0x...",
      "gasPrice": "0.1",
      "confirmations": 3
    }
  }
}
```

### Environment Variables

Key environment variables:

```bash
# API Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/zkrandom
REDIS_URL=redis://localhost:6379

# Blockchain
PRIVATE_KEY=your-private-key
INFURA_PROJECT_ID=your-infura-id

# zkVerify
RELAYER_API_KEY=your-zkverify-api-key
VERIFICATION_KEY_HASH=your-verification-key-hash
```

## 🔬 Circuit Development

The ZK circuits are built with Circom and implement randomness generation with entropy mixing:

```circom
template ZKRandom(n) {
    // Public inputs
    signal input blockHash;
    signal input nonce;
    signal input timestamp;
    
    // Private inputs
    signal input entropy;
    signal input salt;
    
    // Output
    signal output randomValue;
    signal output proof;
    
    // ... circuit logic
}
```

### Compiling Circuits

```bash
# Compile all circuits
npm run compile:circuits

# Generate test proof
cd circuits && node generate-proof.js

# Verify proof
cd circuits && node verify-proof.js
```

## 📊 Monitoring

Access monitoring dashboards:

- **Grafana**: http://localhost:3002 (admin/admin)
- **Prometheus**: http://localhost:9090
- **API Health**: http://localhost:3000/health

### Key Metrics

- Request volume and success rate
- Proof generation time
- Chain health status
- zkVerify job status
- Database and Redis connectivity

## 🧪 Testing

```bash
# Run all tests
npm test

# Test API endpoints
npm run test:api

# Test contracts
npm run test:contracts

# Test circuits
npm run test:circuits
```

## 📖 Smart Contract Integration

### Using ZKRandomOracle

```solidity
import "./ZKRandomConsumer.sol";

contract MyContract is ZKRandomConsumer {
    constructor(address _zkRandomOracle) 
        ZKRandomConsumer(_zkRandomOracle) {}
    
    function requestRandom() external {
        bytes32 seed = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        uint256 requestId = requestRandomness(seed);
        // Store requestId for later use
    }
    
    function _fulfillRandomness(uint256 requestId, uint256 randomValue) 
        internal override {
        // Use the random value
        uint256 result = randomValue % 100; // 0-99
    }
}
```

## 🚢 Deployment

### Using Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f zkrandom-api

# Stop services
docker-compose down
```

### Manual Deployment

1. **Deploy contracts**
   ```bash
   npm run deploy:contracts <network>
   ```

2. **Setup chain configurations**
   ```bash
   node scripts/setup-chains.js setup
   ```

3. **Register verification keys**
   ```bash
   npm run register:keys
   ```

4. **Start API server**
   ```bash
   npm run api:start
   ```

## 🛡️ Security Considerations

- **Private Key Management**: Use hardware wallets or secure key management systems
- **Rate Limiting**: Configure appropriate limits to prevent abuse
- **Circuit Auditing**: Have circuits audited before production use
- **Multi-signature**: Use multisig for contract ownership
- **Monitoring**: Set up comprehensive monitoring and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory
- **Issues**: Report bugs on GitHub Issues
- **Discord**: Join our community Discord
- **Email**: Contact support@zkrandom.io

## 🙏 Acknowledgments

- **Horizen zkVerify**: For providing the ZK proof verification infrastructure
- **Circom**: For the circuit development framework
- **OpenZeppelin**: For secure smart contract libraries

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk and conduct thorough testing before production deployment.
