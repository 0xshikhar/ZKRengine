#!/usr/bin/env node

/**
 * ZKRandom Relayer Service
 * Monitors blockchain events and fulfills randomness requests
 */

require('dotenv').config();
const logger = require('./utils/logger');
const relayerService = require('./services/relayer.service');
const databaseService = require('./services/database.service');

// Handle process termination gracefully
process.on('SIGINT', async () => {
    logger.info('🛑 Received SIGINT, shutting down gracefully...');
    await shutdown();
});

process.on('SIGTERM', async () => {
    logger.info('🛑 Received SIGTERM, shutting down gracefully...');
    await shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

async function shutdown() {
    try {
        await relayerService.stop();
        await databaseService.disconnect();
        logger.info('✅ Relayer service stopped successfully');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

async function main() {
    try {
        logger.info('🚀 Starting ZKRandom Relayer Service...');
        
        // Check required environment variables
        const requiredEnvVars = [
            'PRIVATE_KEY',
            'VERIFICATION_KEY_HASH',
            'DATABASE_URL'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Initialize database
        await databaseService.initialize();
        
        // Start the relayer service
        await relayerService.start();
        
        logger.info('✅ ZKRandom Relayer Service is running');
        logger.info('📊 Service Statistics:', relayerService.getStatistics());
        
        // Keep the process alive
        setInterval(() => {
            const stats = relayerService.getStatistics();
            logger.info('📊 Relayer Status:', {
                isRunning: stats.isRunning,
                processingQueue: stats.processingQueue,
                supportedChains: stats.supportedChains
            });
        }, 60000); // Log status every minute

    } catch (error) {
        logger.error('❌ Failed to start relayer service:', error);
        process.exit(1);
    }
}

// Start the relayer
main().catch(error => {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
});