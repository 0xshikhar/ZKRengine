const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseConfig {
    constructor() {
        this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/zkrandom';
        this.options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        };
    }

    async connect() {
        try {
            logger.info('Connecting to MongoDB...');

            await mongoose.connect(this.connectionString, this.options);

            logger.info('✅ MongoDB connected successfully');

            // Connection event handlers
            mongoose.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB reconnected');
            });

            return mongoose.connection;

        } catch (error) {
            logger.error('❌ MongoDB connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed');
        } catch (error) {
            logger.error('Error closing MongoDB connection:', error);
            throw error;
        }
    }

    getConnectionState() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            state: states[mongoose.connection.readyState],
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    async healthCheck() {
        try {
            const state = this.getConnectionState();

            if (state.state !== 'connected') {
                return {
                    status: 'unhealthy',
                    message: `Database is ${state.state}`,
                    details: state
                };
            }

            // Test with a simple operation
            await mongoose.connection.db.admin().ping();

            return {
                status: 'healthy',
                message: 'Database connection is active',
                details: state
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                details: this.getConnectionState()
            };
        }
    }
}

const databaseConfig = new DatabaseConfig();

module.exports = {
    connectDatabase: () => databaseConfig.connect(),
    disconnectDatabase: () => databaseConfig.disconnect(),
    getDatabaseHealth: () => databaseConfig.healthCheck(),
    getDatabaseState: () => databaseConfig.getConnectionState()
};