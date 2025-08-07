const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.prisma = new PrismaClient();
        this.initialized = false;
    }

    async initialize() {
        try {
            // Test database connection
            await this.prisma.$connect();
            
            // Run migrations if needed
            await this.prisma.$executeRaw`PRAGMA foreign_keys = ON`;
            
            this.initialized = true;
            logger.info('Database service initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize database service', error);
            throw error;
        }
    }

    async disconnect() {
        await this.prisma.$disconnect();
    }

    // Request methods
    async createRequest(requestData) {
        return await this.prisma.request.create({
            data: {
                requestId: requestData.requestId,
                chainId: requestData.chainId,
                seed: requestData.seed,
                requester: requestData.requester.toLowerCase(),
                callbackAddress: requestData.callbackAddress?.toLowerCase(),
                status: requestData.status || 'pending',
                feePaid: requestData.feePaid,
                expiresAt: requestData.expiresAt,
                metadata: requestData.metadata ? JSON.stringify(requestData.metadata) : null
            }
        });
    }

    async findRequest(requestId) {
        return await this.prisma.request.findUnique({
            where: { requestId },
            include: { proof: true }
        });
    }

    async updateRequest(requestId, updateData) {
        return await this.prisma.request.update({
            where: { requestId },
            data: {
                ...updateData,
                metadata: updateData.metadata ? JSON.stringify(updateData.metadata) : undefined
            }
        });
    }

    async markRequestAsProcessing(requestId) {
        return await this.prisma.request.update({
            where: { requestId },
            data: { status: 'processing' }
        });
    }

    async markRequestAsFulfilled(requestId, randomValue, proofHash, processingTime) {
        return await this.prisma.request.update({
            where: { requestId },
            data: {
                status: 'fulfilled',
                randomValue,
                proofHash,
                fulfilledAt: new Date(),
                processingTime
            }
        });
    }

    async markRequestAsFailed(requestId, error) {
        return await this.prisma.request.update({
            where: { requestId },
            data: {
                status: 'failed',
                error: error.message || error,
                fulfilledAt: new Date()
            }
        });
    }

    async getUserRequests(requester, options = {}) {
        const { page = 1, limit = 20, status, chainId } = options;
        const skip = (page - 1) * limit;
        
        const where = { requester: requester.toLowerCase() };
        if (status) where.status = status;
        if (chainId) where.chainId = parseInt(chainId);

        const [requests, total] = await Promise.all([
            this.prisma.request.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { requestedAt: 'desc' },
                include: { proof: true }
            }),
            this.prisma.request.count({ where })
        ]);

        return {
            requests,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getRequestStatistics(timeRangeMs = null) {
        const where = {};
        if (timeRangeMs) {
            where.requestedAt = {
                gte: new Date(Date.now() - timeRangeMs)
            };
        }

        const [totalRequests, fulfilledRequests, failedRequests, pendingRequests] = await Promise.all([
            this.prisma.request.count({ where }),
            this.prisma.request.count({ where: { ...where, status: 'fulfilled' } }),
            this.prisma.request.count({ where: { ...where, status: 'failed' } }),
            this.prisma.request.count({ where: { ...where, status: 'pending' } })
        ]);

        return {
            totalRequests,
            fulfilledRequests,
            failedRequests,
            pendingRequests,
            successRate: totalRequests > 0 ? (fulfilledRequests / totalRequests) * 100 : 0
        };
    }

    // Proof methods
    async createProof(proofData) {
        return await this.prisma.proof.create({
            data: {
                requestId: proofData.requestId,
                chainId: proofData.chainId,
                proofData: JSON.stringify(proofData.proofData),
                generationTime: proofData.generationTime,
                verificationKeyHash: proofData.verificationKeyHash,
                proofHash: proofData.proofHash,
                randomValue: proofData.randomValue,
                verificationStatus: proofData.verificationStatus || 'pending',
                zkVerifyStatus: proofData.zkVerifyStatus ? JSON.stringify(proofData.zkVerifyStatus) : null
            }
        });
    }

    async findProofByRequest(requestId) {
        return await this.prisma.proof.findUnique({
            where: { requestId }
        });
    }

    async findProofByJobId(jobId) {
        // Search in zkVerifyStatus JSON for jobId
        const proofs = await this.prisma.proof.findMany({
            where: {
                zkVerifyStatus: {
                    contains: jobId
                }
            }
        });
        return proofs[0]; // Return first match
    }

    async updateProof(requestId, updateData) {
        return await this.prisma.proof.update({
            where: { requestId },
            data: {
                ...updateData,
                proofData: updateData.proofData ? JSON.stringify(updateData.proofData) : undefined,
                zkVerifyStatus: updateData.zkVerifyStatus ? JSON.stringify(updateData.zkVerifyStatus) : undefined
            }
        });
    }

    async markProofAsVerified(requestId, verificationTx) {
        return await this.prisma.proof.update({
            where: { requestId },
            data: {
                verificationStatus: 'verified',
                zkVerifyStatus: JSON.stringify({
                    status: 'verified',
                    verificationTx,
                    verifiedAt: new Date()
                })
            }
        });
    }

    async markProofAsFailed(requestId, error) {
        return await this.prisma.proof.update({
            where: { requestId },
            data: {
                verificationStatus: 'failed',
                zkVerifyStatus: JSON.stringify({
                    status: 'failed',
                    error: error.message || error,
                    failedAt: new Date()
                })
            }
        });
    }

    async getProofStatistics(timeRangeMs = null) {
        const where = {};
        if (timeRangeMs) {
            where.createdAt = {
                gte: new Date(Date.now() - timeRangeMs)
            };
        }

        const [totalProofs, verifiedProofs, failedProofs, pendingProofs] = await Promise.all([
            this.prisma.proof.count({ where }),
            this.prisma.proof.count({ where: { ...where, verificationStatus: 'verified' } }),
            this.prisma.proof.count({ where: { ...where, verificationStatus: 'failed' } }),
            this.prisma.proof.count({ where: { ...where, verificationStatus: 'pending' } })
        ]);

        return {
            totalProofs,
            verifiedProofs,
            failedProofs,
            pendingProofs,
            successRate: totalProofs > 0 ? (verifiedProofs / totalProofs) * 100 : 0
        };
    }

    // Chain methods
    async createChain(chainData) {
        return await this.prisma.chain.create({
            data: {
                chainId: chainData.chainId,
                name: chainData.name,
                rpcUrl: chainData.rpcUrl,
                currency: chainData.currency,
                blockTime: chainData.blockTime,
                confirmations: chainData.confirmations
            }
        });
    }

    async updateChain(chainId, updateData) {
        return await this.prisma.chain.update({
            where: { chainId },
            data: updateData
        });
    }

    async getChain(chainId) {
        return await this.prisma.chain.findUnique({
            where: { chainId }
        });
    }

    async getAllChains() {
        return await this.prisma.chain.findMany({
            orderBy: { chainId: 'asc' }
        });
    }

    async incrementChainRequests(chainId, fulfilled = false) {
        const updateData = {
            totalRequests: { increment: 1 }
        };

        if (fulfilled) {
            updateData.fulfilledRequests = { increment: 1 };
        } else {
            updateData.failedRequests = { increment: 1 };
        }

        return await this.prisma.chain.update({
            where: { chainId },
            data: updateData
        });
    }

    // Health check
    async healthCheck() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { healthy: true };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

module.exports = new DatabaseService(); 