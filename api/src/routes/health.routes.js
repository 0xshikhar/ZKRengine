const express = require('express');
const logger = require('../utils/logger');
const databaseService = require('../services/database.service');
const proofService = require('../services/proof.service');
const chainService = require('../services/chain.service');

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            services: {}
        };

        // Check database health
        try {
            const dbHealth = await databaseService.healthCheck();
            health.services.database = dbHealth;
        } catch (error) {
            health.services.database = { healthy: false, error: error.message };
            health.status = 'degraded';
        }

        // Check proof service health
        try {
            health.services.proof = {
                healthy: proofService.initialized,
                circuitPath: proofService.circuitPath,
                filesFound: proofService.filesFound
            };
        } catch (error) {
            health.services.proof = { healthy: false, error: error.message };
            health.status = 'degraded';
        }

        // Check chain service health
        try {
            const chains = chainService.getSupportedChains();
            health.services.chains = {
                healthy: chainService.initialized,
                supportedChains: chains.length,
                chains: chains.map(chain => ({
                    chainId: chain.chainId,
                    name: chain.name,
                    healthy: chain.healthy
                }))
            };
        } catch (error) {
            health.services.chains = { healthy: false, error: error.message };
            health.status = 'degraded';
        }

        // Check system resources
        const memUsage = process.memoryUsage();
        health.system = {
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            },
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform
        };

        // Determine overall status
        const allHealthy = Object.values(health.services).every(service => service.healthy);
        if (!allHealthy) {
            health.status = 'degraded';
        }

        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);

    } catch (error) {
        logger.error('Health check failed', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            details: error.message
        });
    }
});

// Readiness probe
router.get('/ready', async (req, res) => {
    try {
        // Check if all critical services are ready
        const checks = {
            database: await databaseService.healthCheck(),
            proof: proofService.initialized,
            chains: chainService.initialized
        };

        const allReady = Object.values(checks).every(check => 
            typeof check === 'boolean' ? check : check.healthy
        );

        if (allReady) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                checks
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                checks
            });
        }

    } catch (error) {
        logger.error('Readiness check failed', error);
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: 'Readiness check failed'
        });
    }
});

// Liveness probe
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Metrics endpoint (for Prometheus)
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: Date.now(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: await databaseService.getRequestStatistics(),
            proofs: await databaseService.getProofStatistics()
        };

        // Format as Prometheus metrics
        const prometheusMetrics = [
            `# HELP zkrandom_uptime_seconds Uptime in seconds`,
            `# TYPE zkrandom_uptime_seconds gauge`,
            `zkrandom_uptime_seconds ${metrics.uptime}`,
            '',
            `# HELP zkrandom_memory_bytes Memory usage in bytes`,
            `# TYPE zkrandom_memory_bytes gauge`,
            `zkrandom_memory_bytes{type="rss"} ${metrics.memory.rss}`,
            `zkrandom_memory_bytes{type="heapTotal"} ${metrics.memory.heapTotal}`,
            `zkrandom_memory_bytes{type="heapUsed"} ${metrics.memory.heapUsed}`,
            `zkrandom_memory_bytes{type="external"} ${metrics.memory.external}`,
            '',
            `# HELP zkrandom_requests_total Total number of requests`,
            `# TYPE zkrandom_requests_total counter`,
            `zkrandom_requests_total{status="total"} ${metrics.database.totalRequests}`,
            `zkrandom_requests_total{status="fulfilled"} ${metrics.database.fulfilledRequests}`,
            `zkrandom_requests_total{status="failed"} ${metrics.database.failedRequests}`,
            `zkrandom_requests_total{status="pending"} ${metrics.database.pendingRequests}`,
            '',
            `# HELP zkrandom_proofs_total Total number of proofs`,
            `# TYPE zkrandom_proofs_total counter`,
            `zkrandom_proofs_total{status="total"} ${metrics.proofs.totalProofs}`,
            `zkrandom_proofs_total{status="verified"} ${metrics.proofs.verifiedProofs}`,
            `zkrandom_proofs_total{status="failed"} ${metrics.proofs.failedProofs}`,
            `zkrandom_proofs_total{status="pending"} ${metrics.proofs.pendingProofs}`,
            '',
            `# HELP zkrandom_success_rate Success rate percentage`,
            `# TYPE zkrandom_success_rate gauge`,
            `zkrandom_success_rate{type="requests"} ${metrics.database.successRate}`,
            `zkrandom_success_rate{type="proofs"} ${metrics.proofs.successRate}`
        ].join('\n');

        res.set('Content-Type', 'text/plain');
        res.send(prometheusMetrics);

    } catch (error) {
        logger.error('Metrics collection failed', error);
        res.status(500).json({
            error: 'Metrics collection failed',
            details: error.message
        });
    }
});

module.exports = router; 