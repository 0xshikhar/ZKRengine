const logger = require('../utils/logger');

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

/**
 * Global error handler
 */
const errorHandler = (error, req, res, next) => {
    // Log error details
    logger.logError('API Error', error, {
        requestId: req.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method !== 'GET' ? req.body : undefined
    });

    // Determine status code
    let statusCode = error.status || error.statusCode || 500;

    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
    } else if (error.name === 'CastError') {
        statusCode = 400;
    } else if (error.code === 11000) {
        // MongoDB duplicate key error
        statusCode = 409;
    } else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
    } else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
    }

    // Prepare error response
    const errorResponse = {
        success: false,
        error: getErrorMessage(error, statusCode),
        requestId: req.id,
        timestamp: new Date().toISOString()
    };

    // Add additional details in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...(error.details && { details: error.details })
        };
    }

    // Add validation errors if present
    if (error.errors) {
        errorResponse.validationErrors = formatValidationErrors(error.errors);
    }

    res.status(statusCode).json(errorResponse);
};

/**
 * Get user-friendly error message
 */
function getErrorMessage(error, statusCode) {
    switch (statusCode) {
        case 400:
            if (error.name === 'ValidationError') {
                return 'Validation failed';
            }
            if (error.name === 'CastError') {
                return 'Invalid data format';
            }
            return 'Bad request';

        case 401:
            return 'Unauthorized';

        case 403:
            return 'Forbidden';

        case 404:
            return 'Not found';

        case 409:
            if (error.code === 11000) {
                return 'Resource already exists';
            }
            return 'Conflict';

        case 429:
            return 'Too many requests';

        case 500:
            return 'Internal server error';

        case 502:
            return 'Bad gateway';

        case 503:
            return 'Service unavailable';

        case 504:
            return 'Gateway timeout';

        default:
            return error.message || 'An error occurred';
    }
}

/**
 * Format validation errors for response
 */
function formatValidationErrors(errors) {
    if (Array.isArray(errors)) {
        return errors.map(err => ({
            field: err.path || err.param,
            message: err.message || err.msg,
            value: err.value
        }));
    }

    // Handle Mongoose validation errors
    if (typeof errors === 'object') {
        return Object.keys(errors).map(key => ({
            field: key,
            message: errors[key].message,
            value: errors[key].value
        }));
    }

    return errors;
}

/**
 * Async error handler wrapper
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Custom error class for API errors
 */
class APIError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Custom error class for rate limit errors
 */
class RateLimitError extends Error {
    constructor(message = 'Rate limit exceeded', resetTime = null) {
        super(message);
        this.name = 'RateLimitError';
        this.statusCode = 429;
        this.resetTime = resetTime;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error handler for specific error types
 */
const handleSpecificErrors = {
    // MongoDB errors
    MongoError: (error) => {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return new APIError(`${field} already exists`, 409);
        }
        return new APIError('Database error', 500);
    },

    // JSON parsing errors
    SyntaxError: (error) => {
        if (error.message.includes('JSON')) {
            return new APIError('Invalid JSON format', 400);
        }
        return new APIError('Syntax error', 400);
    },

    // Network errors
    ECONNREFUSED: () => new APIError('Service unavailable', 503),
    ETIMEDOUT: () => new APIError('Request timeout', 504),
    ENOTFOUND: () => new APIError('Service not found', 502)
};

/**
 * Enhanced error handler with specific error handling
 */
const enhancedErrorHandler = (error, req, res, next) => {
    // Handle specific error types
    if (handleSpecificErrors[error.name]) {
        error = handleSpecificErrors[error.name](error);
    } else if (handleSpecificErrors[error.code]) {
        error = handleSpecificErrors[error.code](error);
    }

    // Pass to main error handler
    errorHandler(error, req, res, next);
};

module.exports = {
    notFound,
    errorHandler,
    enhancedErrorHandler,
    asyncHandler,
    APIError,
    ValidationError,
    RateLimitError
};