const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Import models
require('../api/src/config/database.config');
const { Chain } = require('../api/src/models');
const logger = require('../api/src/utils/logger');

class ChainSetup {
    constructor() {
        this.chainsConfig = require('../config/chains.json');
        this.deploymentConfig = require('../config/deployment.json');
    }

    async setupAllChains() {
        try {
            console.log('🔗 Setting up chain configurations...');

            // Connect to database
            await this.connectDatabase();

            // Process each supported chain
            const chains = this.chainsConfig.supportedChains;
            const results = [];

            for (const [chainId, config] of Object.entries(chains)) {
                try {
                    const result = await this.setupChain(parseInt(chainId), config);
                    results.push(result);
                    console.log(`✅ Chain ${chainId} (${config.name}) configured successfully`);
                } catch (error) {
                    console.error(`❌ Failed to setup chain ${chainId}:`, error.message);
                    results.push({ chainId, success: false, error: error.message });
                }
            }

            // Summary
            const successful = results.filter(r => r.success).length;
            const total = results.length;

            console.log(`\n📊 Setup Summary: ${successful}/${total} chains configured successfully`);

            if (successful < total) {
                console.log('\n❌ Failed chains:');
                results.filter(r => !r.success).forEach(r => {
                    console.log(`  - Chain ${r.chainId}: ${r.error}`);
                });
            }

            return results;

        } catch (error) {
            console.error('💥 Chain setup failed:', error);
            throw error;
        } finally {
            await this.disconnectDatabase();
        }
    }

    async setupChain(chainId, config) {
        try {
            // Get deployed contract addresses
            const deploymentNetwork = this.getDeploymentNetworkName(chainId);
            const deployedContracts = deploymentNetwork ?
                this.deploymentConfig.networks[deploymentNetwork]?.contracts : null;

            // Prepare chain data
            const chainData = {
                chainId,
                name: config.name,
                symbol: config.symbol,
                rpcUrl: this.resolveEnvVariables(config.rpcUrl),
                fallbackRpcUrls: config.fallbackRpcUrls?.map(url => this.resolveEnvVariables(url)) || [],
                zkVerifyAddress: deployedContracts?.ZKRandomOracle?.address || config.zkVerifyAddress,
                oracleAddress: deployedContracts?.ZKRandomOracle?.address || config.oracleAddress,
                gasPrice: config.gasPrice,
                maxGasPrice: config.maxGasPrice,
                gasLimit: config.gasLimit,
                confirmations: config.confirmations,
                blockTime: config.blockTime,
                isActive: true,
                isMainnet: config.isMainnet,
                requestFee: config.requestFee,
                rateLimitPerHour: config.rateLimitPerHour,
                rateLimitPerDay: config.rateLimitPerDay,
                explorerUrl: config.explorerUrl,
                metadata: config.metadata
            };

            // Check if chain already exists
            let chain = await Chain.findOne({ chainId });

            if (chain) {
                // Update existing chain
                Object.assign(chain, chainData);
                await chain.save();
                console.log(`🔄 Updated existing chain configuration for ${config.name}`);
            } else {
                // Create new chain
                chain = new Chain(chainData);
                await chain.save();
                console.log(`🆕 Created new chain configuration for ${config.name}`);
            }

            // Perform health check
            const healthResult = await this.performHealthCheck(chain);

            return {
                chainId,
                success: true,
                action: chain.isNew ? 'created' : 'updated',
                healthStatus: healthResult.status
            };

        } catch (error) {
            logger.error(`Error setting up chain ${chainId}`, error);
            throw error;
        }
    }

    async performHealthCheck(chain) {
        try {
            console.log(`🏥 Performing health check for ${chain.name}...`);

            const { ethers } = require('ethers');

            // Create provider
            const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);

            // Test basic connectivity
            const blockNumber = await provider.getBlockNumber();
            const block = await provider.getBlock(blockNumber);

            // Update chain health
            await chain.updateHealthStatus('healthy', {
                responseTime: Date.now() - new Date(block.timestamp * 1000),
                blockNumber: blockNumber,
                blockHash: block.hash
            });

            console.log(`✅ Health check passed for ${chain.name} (block: ${blockNumber})`);

            return { status: 'healthy', blockNumber };

        } catch (error) {
            console.warn(`⚠️  Health check failed for ${chain.name}:`, error.message);

            // Update chain as unhealthy
            await chain.updateHealthStatus('unhealthy', {
                error: error.message
            });

            return { status: 'unhealthy', error: error.message };
        }
    }

    getDeploymentNetworkName(chainId) {
        const networkMap = {
            8453: 'base-mainnet',
            84532: 'base-sepolia',
            1: 'ethereum',
            137: 'polygon'
        };
        return networkMap[chainId];
    }

    resolveEnvVariables(str) {
        if (typeof str !== 'string') return str;

        return str.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
            return process.env[envVar] || match;
        });
    }

    async connectDatabase() {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zkrandom';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('📊 Connected to database');
    }

    async disconnectDatabase() {
        await mongoose.disconnect();
        console.log('📊 Disconnected from database');
    }

    async listChains() {
        try {
            await this.connectDatabase();

            const chains = await Chain.find({}).sort({ chainId: 1 });

            console.log('\n🔗 Configured Chains:');
            console.log('─'.repeat(80));

            chains.forEach(chain => {
                const status = chain.isActive ?
                    (chain.healthStatus === 'healthy' ? '🟢' : '🟡') : '🔴';

                console.log(`${status} ${chain.chainId.toString().padEnd(6)} ${chain.name.padEnd(20)} ${chain.healthStatus.padEnd(10)} ${chain.successRate.toFixed(1)}%`);
            });

            console.log('─'.repeat(80));
            console.log(`Total: ${chains.length} chains`);

            return chains;

        } finally {
            await this.disconnectDatabase();
        }
    }

    async updateChainStatus(chainId, isActive) {
        try {
            await this.connectDatabase();

            const chain = await Chain.findOne({ chainId });
            if (!chain) {
                throw new Error(`Chain ${chainId} not found`);
            }

            chain.isActive = isActive;
            await chain.save();

            console.log(`✅ Chain ${chainId} (${chain.name}) ${isActive ? 'activated' : 'deactivated'}`);

        } finally {
            await this.disconnectDatabase();
        }
    }

    async resetChainStats(chainId) {
        try {
            await this.connectDatabase();

            const chain = await Chain.findOne({ chainId });
            if (!chain) {
                throw new Error(`Chain ${chainId} not found`);
            }

            await chain.resetStatistics();

            console.log(`✅ Statistics reset for chain ${chainId} (${chain.name})`);

        } finally {
            await this.disconnectDatabase();
        }
    }
}

// CLI execution
async function main() {
    const command = process.argv[2];
    const chainSetup = new ChainSetup();

    try {
        switch (command) {
            case 'setup':
                await chainSetup.setupAllChains();
                break;

            case 'list':
                await chainSetup.listChains();
                break;

            case 'activate':
                const activateChainId = parseInt(process.argv[3]);
                if (!activateChainId) {
                    throw new Error('Please provide chain ID');
                }
                await chainSetup.updateChainStatus(activateChainId, true);
                break;

            case 'deactivate':
                const deactivateChainId = parseInt(process.argv[3]);
                if (!deactivateChainId) {
                    throw new Error('Please provide chain ID');
                }
                await chainSetup.updateChainStatus(deactivateChainId, false);
                break;

            case 'reset-stats':
                const resetChainId = parseInt(process.argv[3]);
                if (!resetChainId) {
                    throw new Error('Please provide chain ID');
                }
                await chainSetup.resetChainStats(resetChainId);
                break;

            default:
                console.log('ZKRandom Chain Setup Tool');
                console.log('');
                console.log('Usage:');
                console.log('  node scripts/setup-chains.js setup           - Setup all chains from config');
                console.log('  node scripts/setup-chains.js list            - List configured chains');
                console.log('  node scripts/setup-chains.js activate <id>   - Activate a chain');
                console.log('  node scripts/setup-chains.js deactivate <id> - Deactivate a chain');
                console.log('  node scripts/setup-chains.js reset-stats <id>- Reset chain statistics');
                break;
        }

    } catch (error) {
        console.error('❌ Command failed:', error.message);
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = ChainSetup;

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}