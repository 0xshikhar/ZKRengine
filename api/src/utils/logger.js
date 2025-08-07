const winston = require('winston');
const path = require('path');

// Define log levels and colors
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

winston.addColors(logColors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        if (stack) {
            log += `\nStack: ${stack}`;
        }

        if (Object.keys(meta).length > 0) {
            log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
        }

        return log;
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} ${level}: ${message}`;

        if (stack) {
            log += `\n${stack}`;
        }

        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return log;
    })
);

// Create transports
const transports = [];

// Console transport (always enabled)
transports.push(
    new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: consoleFormat
    })
);

// File transports (only in production or when LOG_FILES is true)
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILES === 'true') {
    // Combined log file
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            level: 'info',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );

    // Error log file
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );

    // HTTP log file
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'http.log'),
            level: 'http',
            format: logFormat,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 3,
            tailable: true
        })
    );
}

// Create logger instance
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: logFormat,
    transports,
    exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
    logger.exceptions.handle(
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3
        })
    );

    logger.rejections.handle(
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3
        })
    );
}

// Add request logging helper
logger.logRequest = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const { method, originalUrl, ip } = req;
        const { statusCode } = res;

        logger.http(`${method} ${originalUrl}`, {
            statusCode,
            duration: `${duration}ms`,
            ip,
            userAgent: req.get('User-Agent'),
            requestId: req.id
        });
    });

    if (next) next();
};

// Add structured logging helpers
logger.logError = (message, error, meta = {}) => {
    logger.error(message, {
        error: error.message,
        stack: error.stack,
        ...meta
    });
};

logger.logProofGeneration = (requestId, status, duration, meta = {}) => {
    logger.info('Proof generation', {
        requestId,
        status,
        duration: `${duration}ms`,
        ...meta
    });
};

logger.logChainOperation = (operation, chainId, txHash, status, meta = {}) => {
    logger.info(`Chain operation: ${operation}`, {
        chainId,
        txHash,
        status,
        ...meta
    });
};

logger.logZKVerifyOperation = (operation, jobId, status, meta = {}) => {
    logger.info(`zkVerify operation: ${operation}`, {
        jobId,
        status,
        ...meta
    });
};

// Performance monitoring
logger.time = (label) => {
    const start = process.hrtime.bigint();
    return {
        end: (meta = {}) => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000; // Convert to milliseconds
            logger.debug(`Timer: ${label}`, {
                duration: `${duration.toFixed(2)}ms`,
                ...meta
            });
            return duration;
        }
    };
};

// Environment info on startup
logger.info('Logger initialized', {
    environment: process.env.NODE_ENV || 'development',
    logLevel: logger.level,
    transportsCount: logger.transports.length,
    logsDirectory: process.env.NODE_ENV === 'production' || process.env.LOG_FILES === 'true' ? logsDir : 'console only'
});

module.exports = logger;