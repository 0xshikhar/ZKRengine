const mongoose = require('mongoose');

const chainSchema = new mongoose.Schema({
    // Chain identification
    chainId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    symbol: {
        type: String,
        trim: true
    },

    // Network configuration
    rpcUrl: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'RPC URL must be a valid HTTP/HTTPS URL'
        }
    },

    fallbackRpcUrls: [{
        type: String,
        validate: {
            validator: function (v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Fallback RPC URL must be a valid HTTP/HTTPS URL'
        }
    }],

    // Contract addresses
    zkVerifyAddress: {
        type: String,
        required: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: 'zkVerify address must be a valid Ethereum address'
        }
    },

    oracleAddress: {
        type: String,
        required: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: 'Oracle address must be a valid Ethereum address'
        }
    },

    // Gas configuration
    gasPrice: {
        type: String, // in gwei
        default: '20'
    },

    maxGasPrice: {
        type: String, // in gwei
        default: '100'
    },

    gasLimit: {
        type: Number,
        default: 500000
    },

    // Confirmation requirements
    confirmations: {
        type: Number,
        default: 12,
        min: 1
    },

    // Block time (in seconds)
    blockTime: {
        type: Number,
        default: 12,
        min: 1
    },

    // Status and health
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    isMainnet: {
        type: Boolean,
        default: false
    },

    // Health monitoring
    lastHealthCheck: {
        type: Date,
        default: Date.now
    },

    healthStatus: {
        type: String,
        enum: ['healthy', 'degraded', 'unhealthy'],
        default: 'healthy',
        index: true
    },

    lastBlockNumber: {
        type: Number,
        min: 0
    },

    lastBlockHash: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Block hash must be a valid hex string'
        }
    },

    // Performance metrics
    avgResponseTime: {
        type: Number, // in milliseconds
        min: 0
    },

    successRate: {
        type: Number, // percentage
        min: 0,
        max: 100,
        default: 100
    },

    // Request statistics
    totalRequests: {
        type: Number,
        default: 0,
        min: 0
    },

    successfulRequests: {
        type: Number,
        default: 0,
        min: 0
    },

    failedRequests: {
        type: Number,
        default: 0,
        min: 0
    },

    // Fee configuration
    requestFee: {
        type: String, // in wei
        default: '1000000000000000' // 0.001 ETH
    },

    // Rate limiting
    rateLimitPerHour: {
        type: Number,
        default: 1000,
        min: 1
    },

    rateLimitPerDay: {
        type: Number,
        default: 10000,
        min: 1
    },

    // Explorer configuration
    explorerUrl: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Explorer URL must be a valid HTTP/HTTPS URL'
        }
    },

    // Additional metadata
    metadata: {
        nativeCurrency: {
            name: String,
            symbol: String,
            decimals: {
                type: Number,
                default: 18
            }
        },
        description: String,
        website: String,
        documentation: String
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes
chainSchema.index({ isActive: 1, healthStatus: 1 });
chainSchema.index({ lastHealthCheck: 1 });

// Virtual for success rate calculation
chainSchema.virtual('calculatedSuccessRate').get(function () {
    if (this.totalRequests === 0) return 100;
    return (this.successfulRequests / this.totalRequests) * 100;
});

// Virtual for failure rate
chainSchema.virtual('failureRate').get(function () {
    return 100 - this.calculatedSuccessRate;
});

// Instance methods
chainSchema.methods.updateHealthStatus = function (status, metrics = {}) {
    this.healthStatus = status;
    this.lastHealthCheck = new Date();

    if (metrics.responseTime) {
        this.avgResponseTime = metrics.responseTime;
    }

    if (metrics.blockNumber) {
        this.lastBlockNumber = metrics.blockNumber;
    }

    if (metrics.blockHash) {
        this.lastBlockHash = metrics.blockHash;
    }

    return this.save();
};

chainSchema.methods.incrementRequests = function (success = true) {
    this.totalRequests += 1;

    if (success) {
        this.successfulRequests += 1;
    } else {
        this.failedRequests += 1;
    }

    this.successRate = this.calculatedSuccessRate;
    return this.save();
};

chainSchema.methods.resetStatistics = function () {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.successRate = 100;
    return this.save();
};

chainSchema.methods.isHealthy = function () {
    return this.isActive && this.healthStatus === 'healthy';
};

chainSchema.methods.getExplorerTxUrl = function (txHash) {
    if (!this.explorerUrl || !txHash) return null;
    return `${this.explorerUrl}/tx/${txHash}`;
};

chainSchema.methods.getExplorerAddressUrl = function (address) {
    if (!this.explorerUrl || !address) return null;
    return `${this.explorerUrl}/address/${address}`;
};

// Static methods
chainSchema.statics.findActive = function () {
    return this.find({ isActive: true, healthStatus: { $ne: 'unhealthy' } });
};

chainSchema.statics.findByChainId = function (chainId) {
    return this.findOne({ chainId });
};

chainSchema.statics.findHealthy = function () {
    return this.find({
        isActive: true,
        healthStatus: 'healthy'
    });
};

chainSchema.statics.findUnhealthy = function () {
    return this.find({
        $or: [
            { isActive: false },
            { healthStatus: { $in: ['degraded', 'unhealthy'] } }
        ]
    });
};

chainSchema.statics.getStatistics = function () {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalChains: { $sum: 1 },
                activeChains: {
                    $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                },
                healthyChains: {
                    $sum: { $cond: [{ $eq: ['$healthStatus', 'healthy'] }, 1, 0] }
                },
                totalRequests: { $sum: '$totalRequests' },
                totalSuccessfulRequests: { $sum: '$successfulRequests' },
                avgSuccessRate: { $avg: '$successRate' }
            }
        }
    ]);
};

// Pre-save middleware
chainSchema.pre('save', function (next) {
    // Normalize addresses
    if (this.zkVerifyAddress) {
        this.zkVerifyAddress = this.zkVerifyAddress.toLowerCase();
    }
    if (this.oracleAddress) {
        this.oracleAddress = this.oracleAddress.toLowerCase();
    }

    // Calculate success rate
    if (this.totalRequests > 0) {
        this.successRate = (this.successfulRequests / this.totalRequests) * 100;
    }

    next();
});

// Post-save middleware for logging
chainSchema.post('save', function (doc) {
    const logger = require('../utils/logger');
    logger.debug('Chain configuration updated', {
        chainId: doc.chainId,
        name: doc.name,
        isActive: doc.isActive,
        healthStatus: doc.healthStatus
    });
});

module.exports = mongoose.model('Chain', chainSchema);