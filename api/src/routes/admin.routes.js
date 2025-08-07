const express = require('express');
const logger = require('../utils/logger');
const databaseService = require('../services/database.service');
const chainService = require('../services/chain.service');
const rateLimitMiddleware = require('../middleware/ratelimit.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

// Admin authentication middleware (basic)
const requireAdmin = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized'
        });
    }
    
    next();
};

// Get system statistics
router.get('/statistics',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    async (req, res) => {
        try {
            const timeRange = req.query.timeRange || '24h';
            const timeRangeMs = {
                '1h': 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000
            }[timeRange] || 24 * 60 * 60 * 1000;

            const [requestStats, proofStats, chainStats] = await Promise.all([
                databaseService.getRequestStatistics(timeRangeMs),
                databaseService.getProofStatistics(timeRangeMs),
                databaseService.getAllChains()
            ]);

            res.json({
                success: true,
                data: {
                    timeRange,
                    requests: requestStats,
                    proofs: proofStats,
                    chains: chainStats.map(chain => ({
                        chainId: chain.chainId,
                        name: chain.name,
                        healthy: chain.healthy,
                        totalRequests: chain.totalRequests,
                        fulfilledRequests: chain.fulfilledRequests,
                        failedRequests: chain.failedRequests,
                        successRate: chain.totalRequests > 0 ? 
                            (chain.fulfilledRequests / chain.totalRequests) * 100 : 0
                    }))
                }
            });

        } catch (error) {
            logger.error('Error getting system statistics', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Get pending requests
router.get('/requests/pending',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            
            const pendingRequests = await databaseService.prisma.request.findMany({
                where: {
                    status: 'pending',
                    expiresAt: { gt: new Date() }
                },
                skip: (page - 1) * limit,
                take: parseInt(limit),
                orderBy: { requestedAt: 'desc' },
                include: { proof: true }
            });

            const total = await databaseService.prisma.request.count({
                where: {
                    status: 'pending',
                    expiresAt: { gt: new Date() }
                }
            });

            res.json({
                success: true,
                data: {
                    requests: pendingRequests,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            logger.error('Error getting pending requests', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Get failed requests
router.get('/requests/failed',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            
            const failedRequests = await databaseService.prisma.request.findMany({
                where: { status: 'failed' },
                skip: (page - 1) * limit,
                take: parseInt(limit),
                orderBy: { fulfilledAt: 'desc' },
                include: { proof: true }
            });

            const total = await databaseService.prisma.request.count({
                where: { status: 'failed' }
            });

            res.json({
                success: true,
                data: {
                    requests: failedRequests,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            logger.error('Error getting failed requests', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Retry failed request
router.post('/requests/:requestId/retry',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    validationMiddleware.validateRequestStatus,
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { requestId } = req.params;
            
            const request = await databaseService.findRequest(requestId);
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Request not found'
                });
            }

            if (request.status !== 'failed') {
                return res.status(400).json({
                    success: false,
                    error: 'Request is not in failed status'
                });
            }

            // Reset request status to pending
            await databaseService.updateRequest(requestId, {
                status: 'pending',
                error: null,
                fulfilledAt: null
            });

            logger.info('Request marked for retry', { requestId });

            res.json({
                success: true,
                message: 'Request marked for retry',
                data: { requestId }
            });

        } catch (error) {
            logger.error('Error retrying request', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Update chain configuration
router.put('/chains/:chainId',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    validationMiddleware.validateChainConfig,
    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const { chainId } = req.params;
            const updateData = req.body;

            const chain = await databaseService.getChain(parseInt(chainId));
            if (!chain) {
                return res.status(404).json({
                    success: false,
                    error: 'Chain not found'
                });
            }

            await databaseService.updateChain(parseInt(chainId), updateData);

            logger.info('Chain configuration updated', { chainId, updateData });

            res.json({
                success: true,
                message: 'Chain configuration updated',
                data: { chainId }
            });

        } catch (error) {
            logger.error('Error updating chain configuration', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Get system logs (basic implementation)
router.get('/logs',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    async (req, res) => {
        try {
            const { level = 'info', limit = 100 } = req.query;
            
            // In a real implementation, you'd query actual log files
            // For now, return a placeholder
            res.json({
                success: true,
                data: {
                    logs: [],
                    message: 'Log retrieval not implemented in development'
                }
            });

        } catch (error) {
            logger.error('Error getting system logs', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// System maintenance mode
router.post('/maintenance',
    requireAdmin,
    rateLimitMiddleware.apiLimiter,
    async (req, res) => {
        try {
            const { enabled, reason } = req.body;
            
            // In a real implementation, you'd set a global maintenance flag
            logger.info('Maintenance mode updated', { enabled, reason });
            
            res.json({
                success: true,
                message: 'Maintenance mode updated',
                data: { enabled, reason }
            });

        } catch (error) {
            logger.error('Error updating maintenance mode', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

module.exports = router; 