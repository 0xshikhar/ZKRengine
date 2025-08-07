const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Validation rules for randomness requests
const validateRandomnessRequest = [
    body('chainId')
        .isInt({ min: 1 })
        .withMessage('Chain ID must be a positive integer'),
    
    body('seed')
        .isString()
        .isLength({ min: 1, max: 66 })
        .withMessage('Seed must be a string between 1 and 66 characters'),
    
    body('requester')
        .isEthereumAddress()
        .withMessage('Requester must be a valid Ethereum address'),
    
    body('callbackAddress')
        .optional()
        .isEthereumAddress()
        .withMessage('Callback address must be a valid Ethereum address'),
    
    body('feePaid')
        .optional()
        .isString()
        .withMessage('Fee paid must be a string'),
    
    body('gasPrice')
        .optional()
        .isString()
        .withMessage('Gas price must be a string'),
    
    body('blockNumber')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Block number must be a non-negative integer')
];

// Validation rules for request status
const validateRequestStatus = [
    param('requestId')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Request ID must be a non-empty string')
];

// Validation rules for user requests
const validateUserRequests = [
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
        .isIn(['pending', 'processing', 'fulfilled', 'failed'])
        .withMessage('Status must be one of: pending, processing, fulfilled, failed'),
    
    query('chainId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Chain ID must be a positive integer')
];

// Validation rules for proof generation
const validateProofGeneration = [
    body('blockHash')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Block hash must be a non-empty string'),
    
    body('nonce')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Nonce must be a non-empty string'),
    
    body('timestamp')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Timestamp must be a non-empty string'),
    
    body('entropy')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Entropy must be a non-empty string'),
    
    body('salt')
        .isString()
        .isLength({ min: 1 })
        .withMessage('Salt must be a non-empty string')
];

// Validation rules for chain configuration
const validateChainConfig = [
    body('chainId')
        .isInt({ min: 1 })
        .withMessage('Chain ID must be a positive integer'),
    
    body('name')
        .isString()
        .isLength({ min: 1, max: 50 })
        .withMessage('Chain name must be between 1 and 50 characters'),
    
    body('rpcUrl')
        .isURL()
        .withMessage('RPC URL must be a valid URL'),
    
    body('currency')
        .isString()
        .isLength({ min: 1, max: 10 })
        .withMessage('Currency must be between 1 and 10 characters'),
    
    body('blockTime')
        .isInt({ min: 1 })
        .withMessage('Block time must be a positive integer'),
    
    body('confirmations')
        .isInt({ min: 1 })
        .withMessage('Confirmations must be a positive integer')
];

// Generic validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        logger.warn('Validation errors', {
            path: req.path,
            method: req.method,
            errors: errors.array()
        });
        
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    
    next();
};

// Sanitize input data
const sanitizeInput = (req, res, next) => {
    // Trim whitespace from string fields
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }
    
    // Convert chainId to integer if present
    if (req.body.chainId) {
        req.body.chainId = parseInt(req.body.chainId);
    }
    
    // Convert page and limit to integers if present
    if (req.query.page) {
        req.query.page = parseInt(req.query.page);
    }
    
    if (req.query.limit) {
        req.query.limit = parseInt(req.query.limit);
    }
    
    if (req.query.chainId) {
        req.query.chainId = parseInt(req.query.chainId);
    }
    
    next();
};

module.exports = {
    validateRandomnessRequest,
    validateRequestStatus,
    validateUserRequests,
    validateProofGeneration,
    validateChainConfig,
    handleValidationErrors,
    sanitizeInput
}; 