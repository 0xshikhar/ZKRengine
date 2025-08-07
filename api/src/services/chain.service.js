const { ethers } = require('ethers');
const logger = require('../utils/logger');

class ChainService {
    constructor() {
        this.chains = new Map();
        this.providers = new Map();
        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            // Load chain configurations
            const chainConfigs = {
                8453: { // Base Mainnet
                    name: 'Base Mainnet',
                    rpc: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',
                    chainId: 8453,
                    currency: 'ETH',
                    blockTime: 2000, // 2 seconds
                    confirmations: 1
                },
                84532: { // Base Sepolia
                    name: 'Base Sepolia',
                    rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
                    chainId: 84532,
                    currency: 'ETH',
                    blockTime: 2000,
                    confirmations: 1
                },
                11155111: { // Ethereum Sepolia
                    name: 'Ethereum Sepolia',
                    rpc: process.env.ETHEREUM_RPC || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
                    chainId: 11155111,
                    currency: 'ETH',
                    blockTime: 12000,
                    confirmations: 2
                }
            };

            // Initialize providers and chain objects
            for (const [chainId, config] of Object.entries(chainConfigs)) {
                const provider = new ethers.JsonRpcProvider(config.rpc);
                this.providers.set(parseInt(chainId), provider);
                
                const chain = new Chain(parseInt(chainId), config, provider);
                await chain.initialize();
                this.chains.set(parseInt(chainId), chain);
            }

            this.initialized = true;
            logger.info('Chain service initialized', {
                supportedChains: Array.from(this.chains.keys())
            });

        } catch (error) {
            logger.error('Failed to initialize chain service', error);
        }
    }

    /**
     * Get chain by ID
     */
    getChain(chainId) {
        return this.chains.get(parseInt(chainId));
    }

    /**
     * Get provider by chain ID
     */
    getProvider(chainId) {
        return this.providers.get(parseInt(chainId));
    }

    /**
     * Get all supported chains
     */
    getSupportedChains() {
        return Array.from(this.chains.values()).map(chain => ({
            chainId: chain.chainId,
            name: chain.name,
            currency: chain.currency,
            isHealthy: chain.isHealthy(),
            blockNumber: chain.lastBlockNumber,
            lastUpdate: chain.lastUpdate
        }));
    }

    /**
     * Get chain statistics
     */
    async getStatistics() {
        const stats = {
            totalChains: this.chains.size,
            healthyChains: 0,
            totalRequests: 0,
            totalFulfilled: 0,
            byChain: {}
        };

        for (const [chainId, chain] of this.chains) {
            const chainStats = chain.getStatistics();
            stats.byChain[chainId] = {
                name: chain.name,
                healthy: chain.isHealthy(),
                requests: chainStats.totalRequests,
                fulfilled: chainStats.fulfilledRequests,
                lastBlock: chain.lastBlockNumber
            };

            if (chain.isHealthy()) {
                stats.healthyChains++;
            }
            stats.totalRequests += chainStats.totalRequests;
            stats.totalFulfilled += chainStats.fulfilledRequests;
        }

        return stats;
    }

    /**
     * Fulfill callback on chain
     */
    async fulfillCallback(chainId, callbackAddress, requestId, randomValue, proof) {
        try {
            const chain = this.getChain(chainId);
            if (!chain) {
                throw new Error(`Unsupported chain: ${chainId}`);
            }

            return await chain.fulfillCallback(callbackAddress, requestId, randomValue, proof);

        } catch (error) {
            logger.error('Failed to fulfill callback', error, {
                chainId,
                callbackAddress,
                requestId
            });
            throw error;
        }
    }

    /**
     * Monitor new blocks on all chains
     */
    startBlockMonitoring() {
        for (const chain of this.chains.values()) {
            chain.startBlockMonitoring();
        }
    }

    /**
     * Stop block monitoring
     */
    stopBlockMonitoring() {
        for (const chain of this.chains.values()) {
            chain.stopBlockMonitoring();
        }
    }
}

class Chain {
    constructor(chainId, config, provider) {
        this.chainId = chainId;
        this.name = config.name;
        this.rpc = config.rpc;
        this.currency = config.currency;
        this.blockTime = config.blockTime;
        this.confirmations = config.confirmations;
        this.provider = provider;
        
        this.healthy = false;
        this.lastBlockNumber = 0;
        this.lastUpdate = null;
        this.statistics = {
            totalRequests: 0,
            fulfilledRequests: 0,
            failedRequests: 0
        };
        
        this.blockMonitorInterval = null;
    }

    async initialize() {
        try {
            // Test connection and get latest block
            const network = await this.provider.getNetwork();
            const blockNumber = await this.provider.getBlockNumber();
            
            this.lastBlockNumber = blockNumber;
            this.lastUpdate = new Date();
            this.healthy = true;
            
            logger.info('Chain initialized', {
                chainId: this.chainId,
                name: this.name,
                network: network.name,
                blockNumber
            });

        } catch (error) {
            this.healthy = false;
            logger.error('Failed to initialize chain', error, {
                chainId: this.chainId,
                name: this.name
            });
        }
    }

    isHealthy() {
        // Consider chain healthy if last update was within 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return this.healthy && this.lastUpdate && this.lastUpdate > fiveMinutesAgo;
    }

    async getLatestBlock() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            const block = await this.provider.getBlock(blockNumber);
            
            this.lastBlockNumber = blockNumber;
            this.lastUpdate = new Date();
            this.healthy = true;
            
            return {
                number: blockNumber,
                hash: block.hash,
                timestamp: block.timestamp,
                parentHash: block.parentHash
            };

        } catch (error) {
            this.healthy = false;
            logger.error('Failed to get latest block', error, {
                chainId: this.chainId
            });
            throw error;
        }
    }

    async getBlockEntropy(blockNumber = null) {
        try {
            const targetBlock = blockNumber || await this.provider.getBlockNumber();
            const block = await this.provider.getBlock(targetBlock);
            
            if (!block) {
                throw new Error(`Block ${targetBlock} not found`);
            }

            return {
                blockNumber: block.number,
                blockHash: block.hash,
                timestamp: block.timestamp,
                parentHash: block.parentHash,
                nonce: block.nonce || 0,
                difficulty: block.difficulty || 0,
                gasUsed: block.gasUsed || 0
            };

        } catch (error) {
            logger.error('Failed to get block entropy', error, {
                chainId: this.chainId,
                blockNumber
            });
            throw error;
        }
    }

    async fulfillCallback(callbackAddress, requestId, randomValue, proof) {
        try {
            // This would implement the callback to consumer contracts
            // For now, we'll just log it as the contracts handle this internally
            logger.info('Callback would be executed', {
                chainId: this.chainId,
                callbackAddress,
                requestId,
                randomValue
            });

            return {
                success: true,
                transactionHash: null // Would be actual tx hash
            };

        } catch (error) {
            logger.error('Failed to execute callback', error, {
                chainId: this.chainId,
                callbackAddress,
                requestId
            });
            throw error;
        }
    }

    incrementRequests(fulfilled = false) {
        this.statistics.totalRequests++;
        if (fulfilled) {
            this.statistics.fulfilledRequests++;
        } else {
            this.statistics.failedRequests++;
        }
    }

    getStatistics() {
        return {
            ...this.statistics,
            pendingRequests: this.statistics.totalRequests - this.statistics.fulfilledRequests - this.statistics.failedRequests
        };
    }

    startBlockMonitoring() {
        if (this.blockMonitorInterval) {
            return;
        }

        this.blockMonitorInterval = setInterval(async () => {
            try {
                await this.getLatestBlock();
            } catch (error) {
                // Error already logged in getLatestBlock
            }
        }, this.blockTime);

        logger.info('Started block monitoring', {
            chainId: this.chainId,
            interval: this.blockTime
        });
    }

    stopBlockMonitoring() {
        if (this.blockMonitorInterval) {
            clearInterval(this.blockMonitorInterval);
            this.blockMonitorInterval = null;
            
            logger.info('Stopped block monitoring', {
                chainId: this.chainId
            });
        }
    }
}

module.exports = new ChainService();