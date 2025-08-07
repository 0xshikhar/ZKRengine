import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import * as dotenv from "dotenv";

import "./tasks/accounts";

// Load environment variables
dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
  "optimism-mainnet": 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  sepolia: 11155111,
  celo: 42220,
  celoTestnet: 44787,
  "base-sepolia": 84532,
  "base-mainnet": 8453,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    case "bsc":
      jsonRpcUrl = "https://bsc-dataseed1.binance.org";
      break;
    case "celo":
      jsonRpcUrl = "https://rpc.celo.org";
      break;
    case "sepolia":
      // Use a reliable public RPC endpoint for Sepolia
      jsonRpcUrl = process.env.ETHEREUM_RPC || 
        "https://eth-sepolia.public.blastapi.io";
      break;
    case "base-sepolia":
      jsonRpcUrl = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
      break;
    case "base-mainnet":
      jsonRpcUrl = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";
      break;
    case "celoTestnet":
      jsonRpcUrl = "https://alfajores-forno.celo-testnet.org";
      break;
    default:
      jsonRpcUrl = "https://" + chain + ".infura.io/v3/" + (process.env.INFURA_PROJECT_ID || "");
  }
  return {
    accounts: [privateKey],
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      avalanche: process.env.SNOWTRACE_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISM_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
      },
      chainId: chainIds.hardhat,
    },
    ganache: {
      accounts: {
        mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
      },
      chainId: chainIds.ganache,
      url: "http://localhost:8545",
    },
    celo: getChainConfig("celo"),
    sepolia: getChainConfig("sepolia"),
    celoTestnet: getChainConfig("celoTestnet"),
    arbitrum: getChainConfig("arbitrum-mainnet"),
    avalanche: getChainConfig("avalanche"),
    bsc: getChainConfig("bsc"),
    mainnet: getChainConfig("mainnet"),
    optimism: getChainConfig("optimism-mainnet"),
    "polygon-mainnet": getChainConfig("polygon-mainnet"),
    "polygon-mumbai": getChainConfig("polygon-mumbai"),
    "base-sepolia": getChainConfig("base-sepolia"),
    "base-mainnet": getChainConfig("base-mainnet"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 100,
      },
      viaIR: true,
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
