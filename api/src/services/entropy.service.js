const crypto = require('crypto');
const chainService = require('./chain.service');
const logger = require('../utils/logger');

class EntropyService {
    constructor() {
        this.entropyPool = new Map();
        this.lastEntropyUpdate = new Map();
        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            // Initialize entropy pools for supported chains
            const supportedChains = chainService.getSupportedChains();
            
            for (const chain of supportedChains) {
                this.entropyPool.set(chain.chainId, []);
                this.lastEntropyUpdate.set(chain.chainId, null);
            }

            this.initialized = true;
            logger.info('Entropy service initialized', {
                supportedChains: supportedChains.map(c => c.chainId)
            });

        } catch (error) {
            logger.error('Failed to initialize entropy service', error);
        }
    }

    /**
     * Generate entropy for randomness generation
     */
    async generateEntropy(seed, chainId) {
        const timer = logger.time('generateEntropy');

        try {
            logger.info('Generating entropy', { seed, chainId });

            // Get blockchain entropy
            const blockEntropy = await this.getBlockchainEntropy(chainId);
            
            // Get system entropy
            const systemEntropy = this.getSystemEntropy();
            
            // Get external entropy sources
            const externalEntropy = await this.getExternalEntropy();
            
            // Combine all entropy sources
            const combinedEntropy = this.combineEntropySources({
                seed,
                blockchain: blockEntropy,
                system: systemEntropy,
                external: externalEntropy,
                timestamp: Date.now()
            });

            const duration = timer.end();

            logger.info('Entropy generated successfully', {
                chainId,
                entropyHash: this.hashEntropy(combinedEntropy),
                duration: `${duration}ms`
            });

            return combinedEntropy;

        } catch (error) {
            timer.end();
            logger.error('Failed to generate entropy', error, { seed, chainId });
            throw new Error(`Entropy generation failed: ${error.message}`);
        }
    }

    /**
     * Get blockchain-based entropy
     */
    async getBlockchainEntropy(chainId) {
        try {
            const chain = chainService.getChain(chainId);
            if (!chain) {
                throw new Error(`Unsupported chain: ${chainId}`);
            }

            // Get latest block data
            const blockData = await chain.getBlockEntropy();
            
            // Get previous block for additional entropy
            let prevBlockData = null;
            if (blockData.blockNumber > 0) {
                try {
                    prevBlockData = await chain.getBlockEntropy(blockData.blockNumber - 1);
                } catch (error) {
                    // Previous block might not be available, continue without it
                    logger.warn('Could not fetch previous block', { chainId, blockNumber: blockData.blockNumber - 1 });
                }
            }

            return {
                currentBlock: blockData,
                previousBlock: prevBlockData,
                chainId,
                extractedAt: Date.now()
            };

        } catch (error) {
            logger.error('Failed to get blockchain entropy', error, { chainId });
            
            // Return fallback entropy if blockchain is unavailable
            return {
                currentBlock: {
                    blockNumber: Date.now(),
                    blockHash: crypto.randomBytes(32).toString('hex'),
                    timestamp: Math.floor(Date.now() / 1000),
                    nonce: crypto.randomInt(0, 1000000)
                },
                previousBlock: null,
                chainId,
                extractedAt: Date.now(),
                fallback: true
            };
        }
    }

    /**
     * Get system-based entropy
     */
    getSystemEntropy() {
        const systemInfo = {
            timestamp: Date.now(),
            hrtime: process.hrtime.bigint().toString(),
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            pid: process.pid,
            platform: process.platform,
            arch: process.arch,
            version: process.version
        };

        // Add some randomness
        const randomData = {
            random1: crypto.randomBytes(32),
            random2: crypto.randomBytes(16),
            random3: Math.random(),
            random4: crypto.randomInt(0, Number.MAX_SAFE_INTEGER)
        };

        return {
            system: systemInfo,
            random: randomData,
            extractedAt: Date.now()
        };
    }

    /**
     * Get external entropy sources
     */
    async getExternalEntropy() {
        const entropy = {
            extractedAt: Date.now()
        };

        try {
            // Try to get some external randomness (with timeout)
            const randomOrgPromise = this.getRandomOrgEntropy();
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2000));
            
            const randomOrgData = await Promise.race([randomOrgPromise, timeoutPromise]);
            if (randomOrgData) {
                entropy.randomOrg = randomOrgData;
            }

        } catch (error) {
            logger.warn('External entropy source failed', error);
        }

        // Always include local crypto randomness as fallback
        entropy.localRandom = {
            bytes32: crypto.randomBytes(32),
            bytes16: crypto.randomBytes(16),
            uuid: crypto.randomUUID(),
            timestamp: Date.now()
        };

        return entropy;
    }

    /**
     * Get entropy from random.org (with proper error handling)
     */
    async getRandomOrgEntropy() {
        try {
            // This would normally make an HTTP request to random.org
            // For now, we'll simulate it with local randomness
            return {
                source: 'random.org.simulation',
                data: crypto.randomBytes(32).toString('hex'),
                timestamp: Date.now()
            };

        } catch (error) {
            logger.debug('Random.org entropy failed', error);
            return null;
        }
    }

    /**
     * Combine all entropy sources into a single entropy object
     */
    combineEntropySources(sources) {
        // Create a deterministic but unpredictable combination
        const combined = {
            // Core inputs
            seed: sources.seed,
            timestamp: sources.timestamp,
            
            // Blockchain entropy
            blockHash: sources.blockchain.currentBlock.blockHash,
            blockNumber: sources.blockchain.currentBlock.blockNumber,
            blockTimestamp: sources.blockchain.currentBlock.timestamp,
            nonce: sources.blockchain.currentBlock.nonce || 0,
            
            // Previous block if available
            parentHash: sources.blockchain.currentBlock.parentHash || '0x0',
            prevBlockHash: sources.blockchain.previousBlock?.blockHash || '0x0',
            
            // System entropy
            hrtime: sources.system.random.random1.toString('hex'),
            memory: JSON.stringify(sources.system.system.memory),
            uptime: sources.system.system.uptime,
            
            // External entropy
            externalRandom: sources.external.localRandom.bytes32.toString('hex'),
            uuid: sources.external.localRandom.uuid,
            
            // Additional randomness
            salt: crypto.randomInt(1, Number.MAX_SAFE_INTEGER),
            
            // Metadata
            chainId: sources.blockchain.chainId,
            generatedAt: Date.now()
        };

        // Create final entropy hash
        const entropyString = JSON.stringify(combined);
        const entropyHash = crypto.createHash('sha256').update(entropyString).digest('hex');
        
        // Convert hash to BigInt for circuit input
        const entropyValue = BigInt('0x' + entropyHash);

        return {
            // Raw entropy data
            raw: combined,
            
            // Processed values for circuit
            value: entropyValue.toString(),
            blockHash: sources.blockchain.currentBlock.blockHash,
            nonce: (sources.blockchain.currentBlock.nonce || 0).toString(),
            timestamp: sources.blockchain.currentBlock.timestamp.toString(),
            salt: combined.salt.toString(),
            
            // Metadata
            hash: entropyHash,
            sources: Object.keys(sources),
            generatedAt: combined.generatedAt
        };
    }

    /**
     * Hash entropy for logging/verification
     */
    hashEntropy(entropy) {
        const entropyString = JSON.stringify(entropy.raw || entropy);
        return crypto.createHash('sha256').update(entropyString).digest('hex').substring(0, 16);
    }

    /**
     * Validate entropy quality
     */
    validateEntropy(entropy) {
        const checks = {
            hasBlockHash: !!entropy.blockHash,
            hasNonce: !!entropy.nonce,
            hasTimestamp: !!entropy.timestamp,
            hasValue: !!entropy.value,
            hasSalt: !!entropy.salt,
            isRecent: entropy.generatedAt && (Date.now() - entropy.generatedAt < 60000) // Within 1 minute
        };

        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        
        return {
            valid: passed >= total - 1, // Allow one check to fail
            score: passed / total,
            checks,
            details: `${passed}/${total} checks passed`
        };
    }

    /**
     * Get entropy statistics
     */
    getStatistics() {
        return {
            initialized: this.initialized,
            supportedChains: Array.from(this.entropyPool.keys()),
            poolSizes: Object.fromEntries(
                Array.from(this.entropyPool.entries()).map(([chainId, pool]) => [chainId, pool.length])
            ),
            lastUpdates: Object.fromEntries(this.lastEntropyUpdate.entries())
        };
    }
}

module.exports = new EntropyService();