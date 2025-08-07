const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Create rate limiters
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            error: 'Rate limit exceeded',
            message: message || 'Too many requests, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: message || 'Too many requests, please try again later.',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
    });
};

// General API rate limiter
const apiLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'API rate limit exceeded'
);

// Randomness request rate limiter (more restrictive)
const randomnessLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    10, // 10 requests per hour
    'Randomness request rate limit exceeded'
);

// Proof generation rate limiter
const proofLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    5, // 5 proof generations per hour
    'Proof generation rate limit exceeded'
);

// IP-based rate limiter for security
const securityLimiter = createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    50, // 50 requests per 5 minutes
    'Security rate limit exceeded'
);

module.exports = {
    apiLimiter,
    randomnessLimiter,
    proofLimiter,
    securityLimiter,
    createRateLimiter
}; 