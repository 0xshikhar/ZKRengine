const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    // Request identification
    requestId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Chain information
    chainId: {
        type: Number,
        required: true,
        index: true
    },

    // Request parameters
    seed: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Seed must be a valid hex string (32 bytes)'
        }
    },

    requester: {
        type: String,
        required: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: 'Requester must be a valid Ethereum address'
        }
    },

    callbackAddress: {
        type: String,
        lowercase: true,
        validate: {
            validator: function (v) {
                return !v || /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: 'Callback address must be a valid Ethereum address'
        }
    },

    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'processing', 'fulfilled', 'failed', 'expired'],
        default: 'pending',
        index: true
    },

    // Randomness result
    randomValue: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^[0-9]+$/.test(v);
            },
            message: 'Random value must be a valid number string'
        }
    },

    // Proof information
    proofHash: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Proof hash must be a valid hex string'
        }
    },

    // Transaction information
    requestTx: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Request transaction hash must be valid'
        }
    },

    fulfillmentTx: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Fulfillment transaction hash must be valid'
        }
    },

    // Timing information
    requestedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    processedAt: {
        type: Date
    },

    fulfilledAt: {
        type: Date
    },

    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    },

    // Error information
    error: {
        message: String,
        code: String,
        details: mongoose.Schema.Types.Mixed
    },

    // Processing metadata
    processingTime: {
        type: Number, // in milliseconds
        min: 0
    },

    retryCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Fee information
    feePaid: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^[0-9]+$/.test(v);
            },
            message: 'Fee paid must be a valid number string'
        }
    },

    // Additional metadata
    metadata: {
        userAgent: String,
        ip: String,
        gasPrice: String,
        gasUsed: String,
        blockNumber: Number,
        entropy: {
            blockHash: String,
            nonce: String,
            timestamp: String,
            salt: String
        }
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes for efficient queries
requestSchema.index({ requester: 1, requestedAt: -1 });
requestSchema.index({ chainId: 1, status: 1 });
requestSchema.index({ status: 1, requestedAt: 1 });
requestSchema.index({ expiresAt: 1 }, { sparse: true });

// Virtual for processing duration
requestSchema.virtual('processingDuration').get(function () {
    if (this.processedAt && this.requestedAt) {
        return this.processedAt - this.requestedAt;
    }
    return null;
});

// Virtual for fulfillment duration
requestSchema.virtual('fulfillmentDuration').get(function () {
    if (this.fulfilledAt && this.requestedAt) {
        return this.fulfilledAt - this.requestedAt;
    }
    return null;
});

// Instance methods
requestSchema.methods.markAsProcessing = function () {
    this.status = 'processing';
    this.processedAt = new Date();
    return this.save();
};

requestSchema.methods.markAsFulfilled = function (randomValue, proofHash, fulfillmentTx) {
    this.status = 'fulfilled';
    this.randomValue = randomValue;
    this.proofHash = proofHash;
    this.fulfillmentTx = fulfillmentTx;
    this.fulfilledAt = new Date();

    if (this.requestedAt) {
        this.processingTime = Date.now() - this.requestedAt.getTime();
    }

    return this.save();
};

requestSchema.methods.markAsFailed = function (error) {
    this.status = 'failed';
    this.error = {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        details: error.details || null
    };
    this.processedAt = new Date();
    return this.save();
};

requestSchema.methods.markAsExpired = function () {
    this.status = 'expired';
    this.processedAt = new Date();
    return this.save();
};

requestSchema.methods.incrementRetry = function () {
    this.retryCount += 1;
    return this.save();
};

// Static methods
requestSchema.statics.findByRequester = function (requester, options = {}) {
    const query = { requester: requester.toLowerCase() };

    return this.find(query)
        .sort({ requestedAt: -1 })
        .limit(options.limit || 100)
        .skip(options.skip || 0);
};

requestSchema.statics.findPendingRequests = function (chainId) {
    const query = { status: 'pending' };
    if (chainId) {
        query.chainId = chainId;
    }

    return this.find(query).sort({ requestedAt: 1 });
};

requestSchema.statics.findExpiredRequests = function () {
    return this.find({
        status: { $in: ['pending', 'processing'] },
        expiresAt: { $lt: new Date() }
    });
};

requestSchema.statics.getStatistics = function (chainId, timeRange = 24 * 60 * 60 * 1000) {
    const since = new Date(Date.now() - timeRange);
    const query = { requestedAt: { $gte: since } };

    if (chainId) {
        query.chainId = chainId;
    }

    return this.aggregate([
        { $match: query },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgProcessingTime: { $avg: '$processingTime' }
            }
        }
    ]);
};

// Pre-save middleware
requestSchema.pre('save', function (next) {
    // Set expiration time if not set
    if (!this.expiresAt && this.status === 'pending') {
        this.expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    }

    // Normalize addresses
    if (this.requester) {
        this.requester = this.requester.toLowerCase();
    }
    if (this.callbackAddress) {
        this.callbackAddress = this.callbackAddress.toLowerCase();
    }

    next();
});

// Post-save middleware for logging
requestSchema.post('save', function (doc) {
    const logger = require('../utils/logger');
    logger.debug('Request saved', {
        requestId: doc.requestId,
        status: doc.status,
        chainId: doc.chainId
    });
});

module.exports = mongoose.model('Request', requestSchema);