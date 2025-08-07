const axios = require('axios');
const logger = require('../utils/logger');

class ZKVerifyService {
    constructor() {
        this.baseUrl = process.env.RELAYER_BASE_URL || 'https://relayer.zkverify.io';
        this.apiKey = process.env.RELAYER_API_KEY;
        this.timeout = parseInt(process.env.RELAYER_TIMEOUT) || 30000;
        this.retries = parseInt(process.env.RELAYER_RETRIES) || 3;

        if (!this.apiKey) {
            logger.warn('RELAYER_API_KEY not set - zkVerify service may not work properly');
        }

        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ZKRandom-Engine/1.0.0'
            }
        });

        // Add request interceptor for authentication
        this.client.interceptors.request.use(
            (config) => {
                if (this.apiKey) {
                    config.headers.Authorization = `Bearer ${this.apiKey}`;
                }

                logger.debug('zkVerify API request', {
                    method: config.method,
                    url: config.url,
                    hasAuth: !!this.apiKey
                });

                return config;
            },
            (error) => {
                logger.error('zkVerify request interceptor error', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => {
                logger.debug('zkVerify API response', {
                    status: response.status,
                    url: response.config.url
                });
                return response;
            },
            (error) => {
                logger.error('zkVerify API error', {
                    status: error.response?.status,
                    message: error.response?.data?.message || error.message,
                    url: error.config?.url
                });
                return Promise.reject(error);
            }
        );
    }

    /**
     * Submit proof to zkVerify for verification
     */
    async submitProof(proofData, chainId) {
        const timer = logger.time('zkVerifySubmitProof');

        try {
            logger.info('Submitting proof to zkVerify', {
                chainId,
                proofSize: JSON.stringify(proofData).length
            });

            const payload = {
                proof: {
                    a: proofData.proof.pi_a.slice(0, 2), // Remove the third element for zkVerify
                    b: proofData.proof.pi_b.slice(0, 2).map(row => row.slice(0, 2)), // 2x2 matrix
                    c: proofData.proof.pi_c.slice(0, 2) // Remove the third element
                },
                publicSignals: proofData.publicSignals,
                chainId: chainId,
                verificationKey: process.env.VERIFICATION_KEY_HASH,
                metadata: {
                    circuit: 'randomness',
                    version: '1.0.0',
                    timestamp: Date.now()
                }
            };

            const response = await this.retryRequest(async () => {
                return await this.client.post('/submit-proof', payload);
            });

            const duration = timer.end();

            logger.logZKVerifyOperation('submit', response.data.jobId, 'success', {
                chainId,
                duration: `${duration}ms`,
                jobId: response.data.jobId
            });

            return {
                jobId: response.data.jobId,
                status: response.data.status,
                transactionHash: response.data.transactionHash,
                estimatedTime: response.data.estimatedTime
            };

        } catch (error) {
            timer.end();

            const errorDetails = {
                message: error.response?.data?.message || error.message,
                status: error.response?.status,
                code: error.response?.data?.code || error.code
            };

            logger.logZKVerifyOperation('submit', null, 'failed', {
                chainId,
                error: errorDetails
            });

            throw new Error(`zkVerify submission failed: ${errorDetails.message}`);
        }
    }

    /**
     * Get job status from zkVerify
     */
    async getJobStatus(jobId) {
        const timer = logger.time('zkVerifyJobStatus');

        try {
            logger.debug('Getting job status from zkVerify', { jobId });

            const response = await this.retryRequest(async () => {
                return await this.client.get(`/job/${jobId}`);
            });

            const duration = timer.end();

            logger.debug('zkVerify job status retrieved', {
                jobId,
                status: response.data.state,
                duration: `${duration}ms`
            });

            return {
                jobId,
                state: response.data.state,
                transactionHash: response.data.transactionHash,
                blockNumber: response.data.blockNumber,
                gasUsed: response.data.gasUsed,
                error: response.data.error,
                createdAt: response.data.createdAt,
                updatedAt: response.data.updatedAt
            };

        } catch (error) {
            timer.end();

            logger.error('Failed to get job status from zkVerify', error, { jobId });

            // Return a failed status instead of throwing
            return {
                jobId,
                state: 'Failed',
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Register verification key with zkVerify
     */
    async registerVerificationKey(verificationKey, chainId) {
        const timer = logger.time('zkVerifyRegisterVK');

        try {
            logger.info('Registering verification key with zkVerify', {
                chainId,
                keySize: verificationKey.length
            });

            const response = await this.retryRequest(async () => {
                return await this.client.post('/register-vk', {
                    verificationKey,
                    chainId,
                    metadata: {
                        circuit: 'randomness',
                        version: '1.0.0',
                        registeredAt: Date.now()
                    }
                });
            });

            const duration = timer.end();

            logger.info('Verification key registered successfully', {
                chainId,
                keyHash: response.data.keyHash,
                duration: `${duration}ms`
            });

            return {
                keyHash: response.data.keyHash,
                status: response.data.status,
                transactionHash: response.data.transactionHash
            };

        } catch (error) {
            timer.end();

            logger.error('Failed to register verification key', error, { chainId });
            throw new Error(`Verification key registration failed: ${error.message}`);
        }
    }

    /**
     * Get zkVerify service health
     */
    async getHealth() {
        try {
            const response = await this.client.get('/health', { timeout: 5000 });

            return {
                status: 'healthy',
                version: response.data.version,
                uptime: response.data.uptime,
                chains: response.data.supportedChains
            };

        } catch (error) {
            logger.error('zkVerify health check failed', error);

            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Get supported chains from zkVerify
     */
    async getSupportedChains() {
        try {
            const response = await this.client.get('/chains');

            return response.data.chains || [];

        } catch (error) {
            logger.error('Failed to get supported chains from zkVerify', error);
            return [];
        }
    }

    /**
     * Get zkVerify statistics
     */
    async getStatistics(timeRange = '24h') {
        try {
            const response = await this.client.get('/statistics', {
                params: { timeRange }
            });

            return {
                totalJobs: response.data.totalJobs,
                successfulJobs: response.data.successfulJobs,
                failedJobs: response.data.failedJobs,
                avgProcessingTime: response.data.avgProcessingTime,
                byChain: response.data.byChain
            };

        } catch (error) {
            logger.error('Failed to get zkVerify statistics', error);
            return null;
        }
    }

    /**
     * Retry request with exponential backoff
     */
    async retryRequest(requestFn, maxRetries = this.retries) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;

                if (attempt === maxRetries) {
                    break;
                }

                // Don't retry on client errors (4xx)
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    break;
                }

                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);

                logger.warn('zkVerify request failed, retrying', {
                    attempt,
                    maxRetries,
                    delay: `${delay}ms`,
                    error: error.message
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Validate proof format for zkVerify
     */
    validateProofFormat(proofData) {
        if (!proofData || !proofData.proof) {
            return { valid: false, error: 'Missing proof data' };
        }

        const { proof, publicSignals } = proofData;

        if (!proof.pi_a || !Array.isArray(proof.pi_a) || proof.pi_a.length < 2) {
            return { valid: false, error: 'Invalid pi_a format' };
        }

        if (!proof.pi_b || !Array.isArray(proof.pi_b) || proof.pi_b.length < 2) {
            return { valid: false, error: 'Invalid pi_b format' };
        }

        if (!proof.pi_c || !Array.isArray(proof.pi_c) || proof.pi_c.length < 2) {
            return { valid: false, error: 'Invalid pi_c format' };
        }

        if (!publicSignals || !Array.isArray(publicSignals) || publicSignals.length === 0) {
            return { valid: false, error: 'Invalid public signals format' };
        }

        return { valid: true };
    }
}

module.exports = new ZKVerifyService();