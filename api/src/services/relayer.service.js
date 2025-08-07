const { ethers } = require('ethers');
const proofService = require('./proof.service');
const zkverifyService = require('./zkverify.service');
const chainService = require('./chain.service');
const entropyService = require('./entropy.service');
const logger = require('../utils/logger');
const databaseService = require('./database.service');

class RelayerService {
    constructor() {
        this.isRunning = false;
        this.eventListeners = new Map();
        this.processingQueue = new Map();
        this.contracts = new Map();
        this.wallets = new Map();
        this.initialized = false;
        
        // Configuration
        this.config = {
            maxConcurrentRequests: 5,
            requestTimeout: 10 * 60 * 1000, // 10 minutes
            blockConfirmations: 2,
            retryAttempts: 3,
            retryDelay: 5000
        };
    }

    async initialize() {
        try {
            logger.info('Initializing relayer service...');

            // Wait for chain service to be ready
            while (!chainService.initialized) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Initialize wallets and contracts for each chain
            await this.initializeChainConnections();
            
            this.initialized = true;
            logger.info('Relayer service initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize relayer service', error);
            throw error;
        }
    }

    async initializeChainConnections() {
        const supportedChains = chainService.getSupportedChains();
        
        for (const chainInfo of supportedChains) {
            try {
                const provider = chainService.getProvider(chainInfo.chainId);
                
                // Create wallet for this chain
                const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                this.wallets.set(chainInfo.chainId, wallet);
                
                // Get contract addresses from environment
                const oracleAddress = this.getOracleAddress(chainInfo.chainId);
                if (!oracleAddress) {
                    logger.warn('No oracle address configured for chain', { chainId: chainInfo.chainId });
                    continue;
                }

                // Create contract instance
                const oracleContract = new ethers.Contract(
                    oracleAddress,
                    this.getOracleABI(),
                    wallet
                );
                
                this.contracts.set(chainInfo.chainId, {
                    oracle: oracleContract,
                    address: oracleAddress
                });

                logger.info('Chain connection initialized', {
                    chainId: chainInfo.chainId,
                    oracleAddress,
                    walletAddress: wallet.address
                });

            } catch (error) {
                logger.error('Failed to initialize chain connection', error, {
                    chainId: chainInfo.chainId
                });
            }
        }
    }

    getOracleAddress(chainId) {
        // Get oracle address based on chain ID
        switch (chainId) {
            case 84532: // Base Sepolia
                return process.env.BASE_SEPOLIA_ORACLE_ADDRESS || '0x09dDF8f56981deC60e468e2B85194102a3e2E124';
            case 11155111: // Ethereum Sepolia  
                return process.env.SEPOLIA_ORACLE_ADDRESS || '0x469445050449551213fd0b3aC9Ca33fc7cC55d1C';
            case 8453: // Base Mainnet
                return process.env.BASE_MAINNET_ORACLE_ADDRESS;
            default:
                return null;
        }
    }

    getOracleABI() {
        return [
            'event RandomnessRequested(uint256 indexed requestId, address indexed requester, bytes32 seed, uint256 fee)',
            'event RandomnessFulfilled(uint256 indexed requestId, uint256 randomValue, bytes32 proofHash)',
            'function fulfillRandomness(uint256 requestId, tuple(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] publicInputs) proof) external',
            'function getRequest(uint256 requestId) external view returns (tuple(address requester, uint256 requestId, bytes32 seed, uint256 timestamp, bool fulfilled, uint256 randomValue, bytes32 proofHash))',
            'function getStats() external view returns (uint256 totalRequests, uint256 fulfilledRequests, uint256 pendingRequests, uint256 currentFee)'
        ];
    }

    /**
     * Start the relayer service
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Relayer service is already running');
            return;
        }

        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Start event listeners for each chain
            await this.startEventListeners();
            
            // Start processing existing pending requests
            this.startPendingRequestsProcessor();
            
            this.isRunning = true;
            logger.info('🚀 Relayer service started successfully');

        } catch (error) {
            logger.error('Failed to start relayer service', error);
            throw error;
        }
    }

    /**
     * Stop the relayer service
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        logger.info('Stopping relayer service...');
        
        // Stop event listeners
        for (const [chainId, listener] of this.eventListeners) {
            try {
                await listener.removeAllListeners();
                logger.info('Stopped event listener', { chainId });
            } catch (error) {
                logger.error('Error stopping event listener', error, { chainId });
            }
        }
        
        this.eventListeners.clear();
        this.isRunning = false;
        
        logger.info('✅ Relayer service stopped');
    }

    /**
     * Start event listeners for all chains
     */
    async startEventListeners() {
        for (const [chainId, contracts] of this.contracts) {
            try {
                const oracle = contracts.oracle;
                
                // Listen for RandomnessRequested events
                oracle.on('RandomnessRequested', async (requestId, requester, seed, fee, event) => {
                    try {
                        logger.info('New randomness request detected', {
                            chainId,
                            requestId: requestId.toString(),
                            requester,
                            seed,
                            fee: ethers.formatEther(fee),
                            blockNumber: event.blockNumber,
                            transactionHash: event.transactionHash
                        });

                        await this.handleRandomnessRequest({
                            chainId,
                            requestId: requestId.toString(),
                            requester,
                            seed,
                            fee: fee.toString(),
                            blockNumber: event.blockNumber,
                            transactionHash: event.transactionHash
                        });

                    } catch (error) {
                        logger.error('Error handling randomness request event', error, {
                            chainId,
                            requestId: requestId.toString()
                        });
                    }
                });

                this.eventListeners.set(chainId, oracle);
                logger.info('Event listener started', { 
                    chainId, 
                    oracleAddress: contracts.address 
                });

            } catch (error) {
                logger.error('Failed to start event listener', error, { chainId });
            }
        }
    }

    /**
     * Handle new randomness request
     */
    async handleRandomnessRequest(eventData) {
        const { chainId, requestId, requester, seed } = eventData;
        const processingKey = `${chainId}-${requestId}`;

        // Check if already processing
        if (this.processingQueue.has(processingKey)) {
            logger.warn('Request already being processed', { chainId, requestId });
            return;
        }

        // Add to processing queue
        this.processingQueue.set(processingKey, {
            ...eventData,
            startedAt: Date.now(),
            status: 'processing'
        });

        try {
            // Wait for block confirmations
            await this.waitForConfirmations(chainId, eventData.blockNumber);

            // Create or update request in database
            await this.createOrUpdateRequest(eventData);

            // Generate and submit proof
            await this.processRandomnessRequest(eventData);

        } catch (error) {
            logger.error('Failed to process randomness request', error, {
                chainId,
                requestId
            });
            
            // Update processing status
            const queueItem = this.processingQueue.get(processingKey);
            if (queueItem) {
                queueItem.status = 'failed';
                queueItem.error = error.message;
            }
        }
    }

    /**
     * Wait for block confirmations
     */
    async waitForConfirmations(chainId, blockNumber) {
        const provider = chainService.getProvider(chainId);
        const requiredConfirmations = this.config.blockConfirmations;

        while (true) {
            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - blockNumber;
            
            if (confirmations >= requiredConfirmations) {
                logger.debug('Block confirmations received', {
                    chainId,
                    blockNumber,
                    confirmations,
                    required: requiredConfirmations
                });
                break;
            }

            // Wait for next block
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    /**
     * Create or update request in database
     */
    async createOrUpdateRequest(eventData) {
        const { chainId, requestId, requester, seed, fee, transactionHash } = eventData;

        try {
            // Check if request already exists
            let request = await databaseService.findRequest(`${chainId}-${requestId}`);

            if (!request) {
                // Create new request
                request = await databaseService.createRequest({
                    requestId: `${chainId}-${requestId}`,
                    chainId,
                    seed,
                    requester: requester.toLowerCase(),
                    status: 'processing',
                    feePaid: fee,
                    metadata: {
                        onChainRequestId: requestId,
                        transactionHash,
                        detectedAt: new Date()
                    },
                    expiresAt: new Date(Date.now() + this.config.requestTimeout)
                });

                logger.info('Request created in database', {
                    requestId: request.requestId,
                    chainId
                });
            } else {
                // Update existing request
                await databaseService.updateRequest(request.requestId, {
                    status: 'processing',
                    metadata: {
                        ...JSON.parse(request.metadata || '{}'),
                        transactionHash,
                        reprocessedAt: new Date()
                    }
                });

                logger.info('Request updated in database', {
                    requestId: request.requestId,
                    chainId
                });
            }

            return request;

        } catch (error) {
            logger.error('Failed to create/update request in database', error, {
                chainId,
                requestId
            });
            throw error;
        }
    }

    /**
     * Process randomness request (generate proof and fulfill)
     */
    async processRandomnessRequest(eventData) {
        const { chainId, requestId } = eventData;
        const fullRequestId = `${chainId}-${requestId}`;

        try {
            logger.info('Processing randomness request', { chainId, requestId });

            // Generate entropy
            const entropy = await entropyService.generateEntropy(eventData.seed, chainId);
            
            // Generate ZK proof
            const proofData = await proofService.generateProof({
                blockHash: entropy.blockHash,
                nonce: entropy.nonce,
                timestamp: entropy.timestamp,
                entropy: entropy.value,
                salt: entropy.salt
            });

            // Create proof record
            const proof = await databaseService.createProof({
                requestId: fullRequestId,
                chainId,
                proofData: JSON.stringify(proofData),
                verificationKeyHash: process.env.VERIFICATION_KEY_HASH
            });

            logger.info('Proof generated', {
                requestId: fullRequestId,
                proofId: proof.proofId,
                randomValue: proofData.publicSignals[0]
            });

            // Submit proof to blockchain
            await this.fulfillOnChain(chainId, requestId, proofData);

            // Update request as fulfilled
            await databaseService.markRequestAsFulfilled(
                fullRequestId,
                proofData.publicSignals[0],
                proof.proofHash,
                Date.now() - this.processingQueue.get(`${chainId}-${requestId}`).startedAt
            );

            // Remove from processing queue
            this.processingQueue.delete(`${chainId}-${requestId}`);

            logger.info('✅ Randomness request fulfilled', {
                chainId,
                requestId,
                randomValue: proofData.publicSignals[0]
            });

        } catch (error) {
            logger.error('Failed to process randomness request', error, {
                chainId,
                requestId
            });

            // Mark request as failed
            await databaseService.markRequestAsFailed(fullRequestId, error.message);

            throw error;
        }
    }

    /**
     * Fulfill randomness on blockchain
     */
    async fulfillOnChain(chainId, requestId, proofData) {
        try {
            const contracts = this.contracts.get(chainId);
            if (!contracts) {
                throw new Error(`No contract found for chain ${chainId}`);
            }

            const oracle = contracts.oracle;
            
            // Format proof for Solidity
            const solidityProof = {
                a: [proofData.proof.pi_a[0], proofData.proof.pi_a[1]],
                b: [
                    [proofData.proof.pi_b[0][1], proofData.proof.pi_b[0][0]],
                    [proofData.proof.pi_b[1][1], proofData.proof.pi_b[1][0]]
                ],
                c: [proofData.proof.pi_c[0], proofData.proof.pi_c[1]],
                publicInputs: proofData.publicSignals
            };

            // Estimate gas
            const gasEstimate = await oracle.fulfillRandomness.estimateGas(requestId, solidityProof);
            const gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer

            // Submit transaction
            const tx = await oracle.fulfillRandomness(requestId, solidityProof, {
                gasLimit
            });

            logger.info('Fulfillment transaction submitted', {
                chainId,
                requestId,
                transactionHash: tx.hash,
                gasLimit: gasLimit.toString()
            });

            // Wait for confirmation
            const receipt = await tx.wait();
            
            logger.info('Fulfillment transaction confirmed', {
                chainId,
                requestId,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            });

            return receipt;

        } catch (error) {
            logger.error('Failed to fulfill on chain', error, {
                chainId,
                requestId
            });
            throw error;
        }
    }

    /**
     * Start processor for existing pending requests
     */
    startPendingRequestsProcessor() {
        setInterval(async () => {
            try {
                await this.processPendingRequests();
            } catch (error) {
                logger.error('Error processing pending requests', error);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Process pending requests from database
     */
    async processPendingRequests() {
        try {
            const pendingRequests = await databaseService.prisma.request.findMany({
                where: {
                    status: 'pending',
                    expiresAt: { gt: new Date() }
                },
                take: 10
            });

            for (const request of pendingRequests) {
                const processingKey = `${request.chainId}-${request.metadata?.onChainRequestId}`;
                
                if (!this.processingQueue.has(processingKey)) {
                    logger.info('Processing pending request', {
                        requestId: request.requestId,
                        chainId: request.chainId
                    });

                    // Convert to event format and process
                    const eventData = {
                        chainId: request.chainId,
                        requestId: request.metadata?.onChainRequestId || request.requestId.split('-')[1],
                        requester: request.requester,
                        seed: request.seed,
                        fee: request.feePaid,
                        blockNumber: 0 // Will skip confirmation wait
                    };

                    await this.handleRandomnessRequest(eventData);
                }
            }

        } catch (error) {
            logger.error('Failed to process pending requests', error);
        }
    }

    /**
     * Get relayer statistics
     */
    getStatistics() {
        return {
            isRunning: this.isRunning,
            initialized: this.initialized,
            supportedChains: Array.from(this.contracts.keys()),
            activeListeners: this.eventListeners.size,
            processingQueue: this.processingQueue.size,
            queueItems: Array.from(this.processingQueue.values()).map(item => ({
                key: `${item.chainId}-${item.requestId}`,
                status: item.status,
                startedAt: item.startedAt,
                duration: Date.now() - item.startedAt
            }))
        };
    }
}

module.exports = new RelayerService();