# Akashic NFT Contracts

A Hardhat-based project for developing the Akashic NFT campaign smart contracts for supporter rewards.

## Overview

The Akashic NFT Contracts project allows campaigns to reward their supporters with unique NFTs. Each campaign can have
its own NFT collection, enabling supporters to receive digital assets as a token of appreciation for their
contributions. The project includes functionality for minting NFTs, managing campaign metadata, and tracking supporter
contributions.

## Features

- **Campaign-Specific NFTs**: Each campaign can create its own NFT collection.
- **Supporter Rewards**: Supporters receive NFTs as rewards for their contributions.
- **Metadata Management**: Manage campaign metadata and NFT attributes.
- **Event Emission**: Emit events for key actions like NFT minting and metadata updates.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (version 14.x or later)
- bun or yarn
- Hardhat

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd akashic-nft-contracts
   ```

2. Install the dependencies:

   ```bash
   bun install
   ```

3. Set up Hardhat configuration variables:

   Run the following command to set up required variables:

   ```bash
   bunx hardhat vars setup
   ```

   To set a particular value, such as a BIP-39 mnemonic variable, execute:

   ```bash
   bunx hardhat vars set MNEMONIC
   ```

   If you do not already have a mnemonic, you can generate one using [this website](https://iancoleman.io/bip39/).

### Compile

Compile the smart contracts with Hardhat:

```bash
bunx hardhat compile
```

### TypeChain

Compile the smart contracts and generate TypeChain bindings:

```bash
bunx hardhat typechain
```

### Testing

Run the tests with Hardhat:

```bash
bunx hardhat test
```

### Linting

Lint the Solidity code:

```bash
bunx hardhat lint:sol
```

Lint the TypeScript code:

```bash
bunx hardhat lint:ts
```

### Coverage

Generate the code coverage report:

```bash
bunx hardhat coverage
```

### Gas Reporting

See the gas usage per unit test and average gas per method call:

```bash
REPORT_GAS=true bunx hardhat test
```

### Clean

Delete the smart contract artifacts, coverage reports, and the Hardhat cache:

```bash
bunx hardhat clean
```

### Deployment

Deploy the contracts to the Hardhat Network:

```bash
bunx hardhat deploy:contracts
```

### Tasks

#### Deploy Akashic NFT

Deploy a new instance of the Akashic NFT contract via a task:

```bash
bunx hardhat deploy:campaign-nft
```

## Development

### Local Development with Ganache

1. Install Ganache globally:

   ```bash
   bun install -g ganache
   ```

2. Run a development blockchain:

   ```bash
   ganache -s test
   ```

   The `-s test` option passes a seed to the local chain, making it deterministic. Make sure to set the mnemonic in your
   `.env` file to match the instance running with Ganache.
