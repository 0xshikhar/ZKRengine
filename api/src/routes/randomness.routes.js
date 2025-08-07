const express = require('express');
const { body, param, query } = require('express-validator');
const randomnessController = require('../controllers/randomness.controller');
const rateLimitMiddleware = require('../middleware/ratelimit.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

// Request randomness
router.post('/request',
    // Rate limiting
    rateLimitMiddleware.randomnessLimiter,

    // Input validation
    validationMiddleware.validateRandomnessRequest,
    validationMiddleware.handleValidationErrors,

    // Controller
    randomnessController.requestRandomness
);

// Get request status
router.get('/request/:requestId',
    // Input validation
    validationMiddleware.validateRequestStatus,
    validationMiddleware.handleValidationErrors,
    randomnessController.getRequestStatus
);

// Get user requests
router.get('/user/:address',
    // Rate limiting
    rateLimitMiddleware.apiLimiter,

    // Input validation
    validationMiddleware.validateUserRequests,
    validationMiddleware.handleValidationErrors,
    randomnessController.getUserRequests
);

// Get statistics
router.get('/statistics',
    // Rate limiting
    rateLimitMiddleware.apiLimiter,

    // Input validation
    validationMiddleware.handleValidationErrors,
    randomnessController.getStatistics
);

// Get supported chains
router.get('/chains',
    rateLimitMiddleware.apiLimiter,
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
        rateLimitMiddleware.proofLimiter,
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