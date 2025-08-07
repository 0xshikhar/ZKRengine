const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database.config');
const { connectRedis } = require('./config/redis.config');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/error.middleware');

class ZKRandomAPI {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production'
                ? process.env.ALLOWED_ORIGINS?.split(',') || []
                : true,
            credentials: true,
        }));

        // Compression and logging
        this.app.use(compression());
        this.app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = Math.random().toString(36).substr(2, 9);
            res.setHeader('X-Request-ID', req.id);
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                requestId: req.id,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                uptime: process.uptime()
            });
        });

        // API routes
        this.app.use('/api/v1', routes);

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'ZKRandom Engine API',
                version: process.env.npm_package_version || '1.0.0',
                description: 'Multi-chain ZK proof-based randomness oracle using Horizen zkVerify',
                endpoints: {
                    health: '/health',
                    api: '/api/v1',
                    docs: '/api/v1/docs'
                }
            });
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use(notFound);

        // Global error handler
        this.app.use(errorHandler);

        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown();
        });

        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            this.gracefulShutdown();
        });

        // SIGTERM signal
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            this.gracefulShutdown();
        });

        // SIGINT signal (Ctrl+C)
        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down gracefully');
            this.gracefulShutdown();
        });
    }

    async start() {
        try {
            // Connect to databases
            await connectDatabase();
            await connectRedis();

            // Start server
            this.server = this.app.listen(this.port, () => {
                logger.info(`🚀 ZKRandom API server started on port ${this.port}`);
                logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
                logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
                logger.info(`📚 API docs: http://localhost:${this.port}/api/v1/docs`);
            });

            // Handle server errors
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    logger.error(`Port ${this.port} is already in use`);
                } else {
                    logger.error('Server error:', error);
                }
                process.exit(1);
            });

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async gracefulShutdown() {
        logger.info('Starting graceful shutdown...');

        if (this.server) {
            this.server.close(() => {
                logger.info('HTTP server closed');
            });
        }

        // Close database connections
        try {
            const mongoose = require('mongoose');
            await mongoose.connection.close();
            logger.info('Database connection closed');
        } catch (error) {
            logger.error('Error closing database:', error);
        }

        // Close Redis connection
        try {
            const { getRedisClient } = require('./config/redis.config');
            const redisClient = getRedisClient();
            if (redisClient) {
                await redisClient.quit();
                logger.info('Redis connection closed');
            }
        } catch (error) {
            logger.error('Error closing Redis:', error);
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const api = new ZKRandomAPI();
    api.start();
}

module.exports = ZKRandomAPI;