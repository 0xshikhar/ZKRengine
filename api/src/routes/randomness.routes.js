const express = require('express');
const { body, param, query } = require('express-validator');
const randomnessController = require('../controllers/randomness.controller');
const rateLimitMiddleware = require('../middleware/ratelimit.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

// Request randomness
router.post('/request',
    // Rate limiting
    rateLimitMiddleware.randomnessRequest,

    // Input validation
    [
        body('chainId')
            .isInt({ min: 1 })
            .withMessage('Chain ID must be a positive integer'),

        body('seed')
            .matches(/^0x[a-fA-F0-9]{64}$/)
            .withMessage('Seed must be a valid 32-byte hex string'),

        body('requester')
            .matches(/^0x[a-fA-F0-9]{40}$/)
            .withMessage('Requester must be a valid Ethereum address'),

        body('callbackAddress')
            .optional()
            .matches(/^0x[a-fA-F0-9]{40}$/)
            .withMessage('Callback address must be a valid Ethereum address'),

        body('feePaid')
            .optional()
            .isNumeric()
            .withMessage('Fee paid must be a number'),

        body('gasPrice')
            .optional()
            .isNumeric()
            .withMessage('Gas price must be a number'),

        body('blockNumber')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Block number must be a non-negative integer')
    ],

    // Validation error handler
    validationMiddleware.handleValidationErrors,

    // Controller
    randomnessController.requestRandomness
);

// Get request status
router.get('/request/:requestId',
    // Input validation
    [
        param('requestId')
            .matches(/^req_[0-9]+_[a-z0-9]+$/)
            .withMessage('Invalid request ID format')
    ],

    validationMiddleware.handleValidationErrors,
    randomnessController.getRequestStatus
);

// Get user requests
router.get('/user/:address',
    // Rate limiting
    rateLimitMiddleware.userRequests,

    // Input validation
    [
        param('address')
            .matches(/^0x[a-fA-F0-9]{40}$/)
            .withMessage('Address must be a valid Ethereum address'),

        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),

        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),

        query('status')
            .optional()
            .isIn(['pending', 'processing', 'fulfilled', 'failed', 'expired'])
            .withMessage('Invalid status value'),

        query('chainId')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Chain ID must be a positive integer')
    ],

    validationMiddleware.handleValidationErrors,
    randomnessController.getUserRequests
);

// Get statistics
router.get('/statistics',
    // Rate limiting
    rateLimitMiddleware.statistics,

    // Input validation
    [
        query('timeRange')
            .optional()
            .isIn(['1h', '24h', '7d', '30d'])
            .withMessage('Time range must be one of: 1h, 24h, 7d, 30d')
    ],

    validationMiddleware.handleValidationErrors,
    randomnessController.getStatistics
);

// Get supported chains
router.get('/chains',
    rateLimitMiddleware.general,
    async (req, res) => {
        try {
            const chainService = require('../services/chain.service');
            const chains = await chainService.getSupportedChains();

            res.json({
                success: true,
                data: chains.map(chain => ({
                    chainId: chain.chainId,
                    name: chain.name,
                    symbol: chain.symbol,
                    isActive: chain.isActive,
                    healthStatus: chain.healthStatus,
                    requestFee: chain.requestFee,
                    confirmations: chain.confirmations,
                    blockTime: chain.blockTime
                }))
            });

        } catch (error) {
            const logger = require('../utils/logger');
            logger.error('Error getting supported chains', error);

            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Get chain info
router.get('/chains/:chainId',
    [
        param('chainId')
            .isInt({ min: 1 })
            .withMessage('Chain ID must be a positive integer')
    ],

    validationMiddleware.handleValidationErrors,
    async (req, res) => {
        try {
            const chainService = require('../services/chain.service');
            const chain = await chainService.getChain(parseInt(req.params.chainId));

            if (!chain) {
                return res.status(404).json({
                    success: false,
                    error: 'Chain not found'
                });
            }

            res.json({
                success: true,
                data: {
                    chainId: chain.chainId,
                    name: chain.name,
                    symbol: chain.symbol,
                    isActive: chain.isActive,
                    isMainnet: chain.isMainnet,
                    healthStatus: chain.healthStatus,
                    requestFee: chain.requestFee,
                    gasPrice: chain.gasPrice,
                    confirmations: chain.confirmations,
                    blockTime: chain.blockTime,
                    totalRequests: chain.totalRequests,
                    successRate: chain.successRate,
                    lastHealthCheck: chain.lastHealthCheck,
                    explorerUrl: chain.explorerUrl
                }
            });

        } catch (error) {
            const logger = require('../utils/logger');
            logger.error('Error getting chain info', error);

            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
);

// Test randomness generation (development only)
if (process.env.NODE_ENV === 'development') {
    router.post('/test',
        rateLimitMiddleware.test,
        async (req, res) => {
            try {
                const proofService = require('../services/proof.service');
                const result = await proofService.testProofGeneration();

                res.json({
                    success: true,
                    data: result,
                    message: 'Test proof generation completed'
                });

            } catch (error) {
                const logger = require('../utils/logger');
                logger.error('Test proof generation failed', error);

                res.status(500).json({
                    success: false,
                    error: 'Test failed',
                    details: error.message
                });
            }
        }
    );
}

module.exports = router;