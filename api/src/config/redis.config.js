const redis = require('redis');
const logger = require('../utils/logger');

class RedisConfig {
    constructor() {
        this.client = null;
        this.connectionString = process.env.REDIS_URL || 'redis://localhost:6379';
        this.options = {
            url: this.connectionString,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    logger.error('Redis server refused connection');
                    return new Error('Redis server connection refused');
                }

                if (options.total_retry_time > 1000 * 60 * 60) {
                    logger.error('Redis retry time exhausted');
                    return new Error('Retry time exhausted');
                }

                if (options.attempt > 10) {
                    logger.error('Redis max retry attempts reached');
                    return undefined;
                }

                // Exponential backoff
                return Math.min(options.attempt * 100, 3000);
            }
        };
    }

    async connect() {
        try {
            logger.info('Connecting to Redis...');

            this.client = redis.createClient(this.options);

            // Event handlers
            this.client.on('error', (error) => {
                logger.error('Redis client error:', error);
            });

            this.client.on('connect', () => {
                logger.info('Redis client connected');
            });

            this.client.on('ready', () => {
                logger.info('✅ Redis client ready');
            });

            this.client.on('end', () => {
                logger.warn('Redis client disconnected');
            });

            this.client.on('reconnecting', () => {
                logger.info('Redis client reconnecting...');
            });

            await this.client.connect();

            return this.client;

        } catch (error) {
            logger.error('❌ Redis connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.quit();
                this.client = null;
                logger.info('Redis connection closed');
            }
        } catch (error) {
            logger.error('Error closing Redis connection:', error);
            throw error;
        }
    }

    getClient() {
        return this.client;
    }

    async healthCheck() {
        try {
            if (!this.client || !this.client.isReady) {
                return {
                    status: 'unhealthy',
                    message: 'Redis client not ready'
                };
            }

            // Test with ping
            const pong = await this.client.ping();

            if (pong === 'PONG') {
                return {
                    status: 'healthy',
                    message: 'Redis connection is active',
                    details: {
                        ready: this.client.isReady,
                        open: this.client.isOpen
                    }
                };
            } else {
                return {
                    status: 'unhealthy',
                    message: 'Redis ping failed'
                };
            }

        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message
            };
        }
    }

    // Cache utilities
    async set(key, value, ttl = 3600) {
        try {
            if (!this.client || !this.client.isReady) {
                logger.warn('Redis not available for SET operation');
                return false;
            }

            const serialized = JSON.stringify(value);
            await this.client.setEx(key, ttl, serialized);
            return true;

        } catch (error) {
            logger.error('Redis SET error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            if (!this.client || !this.client.isReady) {
                logger.warn('Redis not available for GET operation');
                return null;
            }

            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;

        } catch (error) {
            logger.error('Redis GET error:', error);
            return null;
        }
    }

    async del(key) {
        try {
            if (!this.client || !this.client.isReady) {
                logger.warn('Redis not available for DEL operation');
                return false;
            }

            await this.client.del(key);
            return true;

        } catch (error) {
            logger.error('Redis DEL error:', error);
            return false;
        }
    }

    async exists(key) {
        try {
            if (!this.client || !this.client.isReady) {
                return false;
            }

            const exists = await this.client.exists(key);
            return exists === 1;

        } catch (error) {
            logger.error('Redis EXISTS error:', error);
            return false;
        }
    }

    async increment(key, ttl = 3600) {
        try {
            if (!this.client || !this.client.isReady) {
                return 0;
            }

            const value = await this.client.incr(key);
            if (value === 1) {
                await this.client.expire(key, ttl);
            }

            return value;

        } catch (error) {
            logger.error('Redis INCR error:', error);
            return 0;
        }
    }
}

const redisConfig = new RedisConfig();

module.exports = {
    connectRedis: () => redisConfig.connect(),
    disconnectRedis: () => redisConfig.disconnect(),
    getRedisClient: () => redisConfig.getClient(),
    getRedisHealth: () => redisConfig.healthCheck(),

    // Cache utilities
    setCache: (key, value, ttl) => redisConfig.set(key, value, ttl),
    getCache: (key) => redisConfig.get(key),
    delCache: (key) => redisConfig.del(key),
    existsCache: (key) => redisConfig.exists(key),
    incrementCache: (key, ttl) => redisConfig.increment(key, ttl)
};