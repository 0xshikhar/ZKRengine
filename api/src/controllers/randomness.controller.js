const proofService = require('../services/proof.service');
const zkverifyService = require('../services/zkverify.service');
const chainService = require('../services/chain.service');
const entropyService = require('../services/entropy.service');
const databaseService = require('../services/database.service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class RandomnessController {
    /**
     * Request randomness generation
     */
    async requestRandomness(req, res) {
        const timer = logger.time('requestRandomness');

        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { chainId, seed, callbackAddress, requester } = req.body;

            // Validate chain support
            const chain = await chainService.getChain(chainId);
            if (!chain || !chain.isHealthy()) {
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported or unhealthy chain',
                    chainId
                });
            }

            // Check rate limits
            const rateLimitCheck = await this.checkRateLimit(requester, chainId);
            if (!rateLimitCheck.allowed) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    details: rateLimitCheck
                });
            }

            // Generate unique request ID
            const requestId = this.generateRequestId();

            // Create request record
            const request = await databaseService.createRequest({
                requestId,
                chainId,
                seed,
                requester: requester.toLowerCase(),
                callbackAddress: callbackAddress?.toLowerCase(),
                status: 'pending',
                feePaid: req.body.feePaid,
                metadata: {
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                    gasPrice: req.body.gasPrice,
                    blockNumber: req.body.blockNumber
                },
                expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
            });

            logger.info('Randomness request created', {
                requestId,
                chainId,
                requester,
                seed
            });

            // Process request asynchronously
            this.processRandomnessRequest(requestId).catch(error => {
                logger.error('Error processing randomness request', error, { requestId });
            });

            const duration = timer.end();

            res.json({
                success: true,
                data: {
                    requestId,
                    status: 'pending',
                    estimatedTime: '30-60 seconds',
                    expiresAt: request.expiresAt
                },
                meta: {
                    processingTime: `${duration.toFixed(2)}ms`,
                    chainId,
                    requestedAt: request.requestedAt
                }
            });

        } catch (error) {
            timer.end();
            logger.logError('Error in requestRandomness', error, {
                body: req.body,
                ip: req.ip
            });

            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get request status and result
     */
    async getRequestStatus(req, res) {
        const timer = logger.time('getRequestStatus');

        try {
            const { requestId } = req.params;

            const request = await Request.findOne({ requestId });
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Request not found',
                    requestId
                });
            }

            // Get associated proof if exists
            let proof = null;
            if (request.status === 'fulfilled' || request.status === 'processing') {
                proof = await Proof.findByRequest(requestId);
            }

            const duration = timer.end();

            res.json({
                success: true,
                data: {
                    requestId: request.requestId,
                    status: request.status,
                    chainId: request.chainId,
                    requester: request.requester,
                    seed: request.seed,
                    randomValue: request.randomValue,
                    proofHash: request.proofHash,
                    requestedAt: request.requestedAt,
                    fulfilledAt: request.fulfilledAt,
                    processingTime: request.processingTime,
                    expiresAt: request.expiresAt,
                    error: request.error,
                    proof: proof ? {
                        proofId: proof.proofId,
                        verificationStatus: proof.verificationStatus,
                        zkVerifyStatus: proof.zkVerifySubmission?.status,
                        jobId: proof.zkVerifySubmission?.jobId
                    } : null
                },
                meta: {
                    queryTime: `${duration.toFixed(2)}ms`
                }
            });

        } catch (error) {
            timer.end();
            logger.logError('Error in getRequestStatus', error, {
                requestId: req.params.requestId
            });

            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get user's request history
     */
    async getUserRequests(req, res) {
        const timer = logger.time('getUserRequests');

        try {
            const { address } = req.params;
            const { page = 1, limit = 20, status, chainId } = req.query;

            if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format'
                });
            }

            const query = { requester: address.toLowerCase() };
            if (status) query.status = status;
            if (chainId) query.chainId = parseInt(chainId);

            const skip = (page - 1) * limit;
            const requests = await Request.find(query)
                .sort({ requestedAt: -1 })
                .limit(parseInt(limit))
                .skip(skip)
                .select('-metadata -error.details');

            const total = await Request.countDocuments(query);

            const duration = timer.end();

            res.json({
                success: true,
                data: requests,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                },
                meta: {
                    queryTime: `${duration.toFixed(2)}ms`
                }
            });

        } catch (error) {
            timer.end();
            logger.logError('Error in getUserRequests', error, {
                address: req.params.address
            });

            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get system statistics
     */
    async getStatistics(req, res) {
        const timer = logger.time('getStatistics');

        try {
            const { timeRange = '24h' } = req.query;
            const timeRangeMs = this.parseTimeRange(timeRange);

            // Get request statistics
            const requestStats = await Request.getStatistics(null, timeRangeMs);

            // Get proof statistics  
            const proofStats = await Proof.getStatistics(null, timeRangeMs);

            // Get chain statistics
            const chainStats = await chainService.getStatistics();

            const duration = timer.end();

            res.json({
                success: true,
                data: {
                    timeRange,
                    requests: requestStats,
                    proofs: proofStats,
                    chains: chainStats,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                },
                meta: {
                    queryTime: `${duration.toFixed(2)}ms`
                }
            });

        } catch (error) {
            timer.end();
            logger.logError('Error in getStatistics', error);

            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Process randomness request (internal method)
     */
    async processRandomnessRequest(requestId) {
        const processingTimer = logger.time(`processRequest_${requestId}`);

        try {
            const request = await Request.findOne({ requestId });
            if (!request || request.status !== 'pending') {
                logger.warn('Request not found or not pending', { requestId });
                return;
            }

            // Mark as processing
            await request.markAsProcessing();

            logger.info('Processing randomness request', {
                requestId,
                chainId: request.chainId
            });

            // Generate entropy
            const entropy = await entropyService.generateEntropy(request.seed, request.chainId);

            // Store entropy in request metadata
            request.metadata.entropy = entropy;
            await request.save();

            // Generate ZK proof
            const proofTimer = logger.time(`generateProof_${requestId}`);
            const proofData = await proofService.generateProof({
                blockHash: entropy.blockHash,
                nonce: entropy.nonce,
                timestamp: entropy.timestamp,
                entropy: entropy.value,
                salt: entropy.salt
            });
            const proofDuration = proofTimer.end();

            // Create proof record
            const proof = await Proof.create({
                requestId,
                chainId: request.chainId,
                proofData,
                generationTime: proofDuration,
                verificationKeyHash: process.env.VERIFICATION_KEY_HASH
            });

            logger.logProofGeneration(requestId, 'generated', proofDuration, {
                proofId: proof.proofId,
                chainId: request.chainId
            });

            // Submit to zkVerify
            const submissionResult = await zkverifyService.submitProof(
                proofData,
                request.chainId
            );

            // Update proof with submission info
            await proof.updateZKVerifyStatus('submitted', {
                jobId: submissionResult.jobId,
                submissionTx: submissionResult.transactionHash
            });

            logger.logZKVerifyOperation('submit', submissionResult.jobId, 'submitted', {
                requestId,
                chainId: request.chainId
            });

            // Monitor verification status
            this.monitorProofVerification(requestId, submissionResult.jobId)
                .catch(error => {
                    logger.error('Error monitoring proof verification', error, {
                        requestId,
                        jobId: submissionResult.jobId
                    });
                });

            processingTimer.end({ status: 'proof_submitted' });

        } catch (error) {
            processingTimer.end({ status: 'failed' });

            logger.logError('Error processing randomness request', error, { requestId });

            // Mark request as failed
            const request = await Request.findOne({ requestId });
            if (request) {
                await request.markAsFailed(error);
            }
        }
    }

    /**
     * Monitor proof verification status
     */
    async monitorProofVerification(requestId, jobId) {
        const maxAttempts = 60; // 10 minutes with 10-second intervals
        let attempts = 0;

        const checkStatus = async () => {
            try {
                attempts++;

                const status = await zkverifyService.getJobStatus(jobId);
                const proof = await Proof.findByJobId(jobId);

                if (!proof) {
                    logger.error('Proof not found for job monitoring', { jobId, requestId });
                    return;
                }

                logger.debug('Monitoring proof verification', {
                    requestId,
                    jobId,
                    status: status.state,
                    attempt: attempts
                });

                if (status.state === 'Finalized' || status.state === 'Aggregated') {
                    await this.fulfillRandomness(requestId, status);
                } else if (status.state === 'Failed') {
                    await this.handleVerificationFailure(requestId, status.error);
                } else if (attempts < maxAttempts) {
                    // Continue monitoring
                    setTimeout(checkStatus, 10000); // Check every 10 seconds
                } else {
                    // Timeout
                    await this.handleVerificationTimeout(requestId);
                }

            } catch (error) {
                logger.error('Error monitoring proof verification', error, {
                    requestId,
                    jobId,
                    attempt: attempts
                });

                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, 10000);
                } else {
                    await this.handleVerificationTimeout(requestId);
                }
            }
        };

        // Start monitoring
        setTimeout(checkStatus, 5000); // Initial delay of 5 seconds
    }

    /**
     * Fulfill randomness request
     */
    async fulfillRandomness(requestId, verificationResult) {
        const fulfillmentTimer = logger.time(`fulfillRandomness_${requestId}`);

        try {
            const request = await Request.findOne({ requestId });
            const proof = await Proof.findByRequest(requestId);

            if (!request || !proof) {
                throw new Error('Request or proof not found');
            }

            // Extract random value from proof
            const randomValue = proof.randomValue;

            // Update proof status
            await proof.updateZKVerifyStatus('finalized', {
                verificationTx: verificationResult.transactionHash
            });
            await proof.markAsVerified(true);

            // Update request status
            await request.markAsFulfilled(
                randomValue,
                proof.proofHash,
                verificationResult.transactionHash
            );

            // Update chain statistics
            const chain = await chainService.getChain(request.chainId);
            if (chain) {
                await chain.incrementRequests(true);
            }

            const fulfillmentDuration = fulfillmentTimer.end();

            logger.info('Randomness fulfilled', {
                requestId,
                randomValue,
                chainId: request.chainId,
                processingTime: request.processingTime,
                fulfillmentTime: fulfillmentDuration
            });

            // Call callback if specified
            if (request.callbackAddress) {
                try {
                    await chainService.fulfillCallback(
                        request.chainId,
                        request.callbackAddress,
                        requestId,
                        randomValue,
                        proof.solidityProof
                    );
                } catch (callbackError) {
                    logger.error('Callback execution failed', callbackError, {
                        requestId,
                        callbackAddress: request.callbackAddress
                    });
                }
            }

        } catch (error) {
            fulfillmentTimer.end({ status: 'failed' });
            logger.logError('Error fulfilling randomness', error, { requestId });

            // Mark as failed
            const request = await Request.findOne({ requestId });
            if (request) {
                await request.markAsFailed(error);
            }
        }
    }

    /**
     * Handle verification failure
     */
    async handleVerificationFailure(requestId, error) {
        try {
            const request = await Request.findOne({ requestId });
            const proof = await Proof.findByRequest(requestId);

            if (proof) {
                await proof.markAsFailed(new Error(error || 'Verification failed'), 'verification');
            }

            if (request) {
                await request.markAsFailed(new Error(error || 'Proof verification failed'));
            }

            logger.error('Proof verification failed', { requestId, error });

        } catch (err) {
            logger.error('Error handling verification failure', err, { requestId });
        }
    }

    /**
     * Handle verification timeout
     */
    async handleVerificationTimeout(requestId) {
        try {
            const request = await Request.findOne({ requestId });

            if (request) {
                await request.markAsFailed(new Error('Verification timeout'));
            }

            logger.error('Proof verification timeout', { requestId });

        } catch (error) {
            logger.error('Error handling verification timeout', error, { requestId });
        }
    }

    // Utility methods

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async checkRateLimit(requester, chainId) {
        // Implementation would depend on Redis-based rate limiting
        // For now, return allowed
        return { allowed: true };
    }

    parseTimeRange(timeRange) {
        const timeRanges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };

        return timeRanges[timeRange] || timeRanges['24h'];
    }
}

module.exports = new RandomnessController();