const express = require('express');
const randomnessRoutes = require('./randomness.routes');
const healthRoutes = require('./health.routes');
const adminRoutes = require('./admin.routes');
const docsRoutes = require('./docs.routes');

const router = express.Router();

// API Documentation
router.use('/docs', docsRoutes);

// Health and monitoring endpoints
router.use('/health', healthRoutes);

// Main randomness API
router.use('/randomness', randomnessRoutes);

// Admin endpoints (protected)
router.use('/admin', adminRoutes);

// API info endpoint
router.get('/', (req, res) => {
    res.json({
        name: 'ZKRandom Engine API',
        version: '1.0.0',
        description: 'Multi-chain ZK proof-based randomness oracle using Horizen zkVerify',
        endpoints: {
            docs: '/api/v1/docs',
            health: '/api/v1/health',
            randomness: '/api/v1/randomness',
            admin: '/api/v1/admin'
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;