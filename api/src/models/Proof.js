const mongoose = require('mongoose');

const proofSchema = new mongoose.Schema({
    // Proof identification
    proofId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Associated request
    requestId: {
        type: String,
        required: true,
        ref: 'Request',
        index: true
    },

    // Proof data
    proofData: {
        // Groth16 proof components
        proof: {
            pi_a: {
                type: [String],
                required: true,
                validate: {
                    validator: function (v) {
                        return Array.isArray(v) && v.length === 3;
                    },
                    message: 'pi_a must be an array of 3 elements'
                }
            },
            pi_b: {
                type: [[String]],
                required: true,
                validate: {
                    validator: function (v) {
                        return Array.isArray(v) && v.length === 3 &&
                            v.every(row => Array.isArray(row) && row.length === 2);
                    },
                    message: 'pi_b must be a 3x2 array'
                }
            },
            pi_c: {
                type: [String],
                required: true,
                validate: {
                    validator: function (v) {
                        return Array.isArray(v) && v.length === 3;
                    },
                    message: 'pi_c must be an array of 3 elements'
                }
            },
            protocol: {
                type: String,
                default: 'groth16'
            },
            curve: {
                type: String,
                default: 'bn128'
            }
        },

        // Public signals/inputs
        publicSignals: {
            type: [String],
            required: true,
            validate: {
                validator: function (v) {
                    return Array.isArray(v) && v.length >= 1;
                },
                message: 'Public signals must be a non-empty array'
            }
        },

        // Circuit inputs used for proof generation
        inputs: {
            blockHash: String,
            nonce: String,
            timestamp: String,
            entropy: String,
            salt: String
        }
    },

    // Proof verification status
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'failed', 'invalid'],
        default: 'pending',
        index: true
    },

    // zkVerify submission information
    zkVerifySubmission: {
        jobId: String,
        submissionTx: String,
        submittedAt: Date,
        status: {
            type: String,
            enum: ['pending', 'submitted', 'aggregated', 'finalized', 'failed']
        },
        verificationTx: String,
        verifiedAt: Date,
        error: String
    },

    // Proof hash for uniqueness
    proofHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Proof hash must be a valid hex string'
        }
    },

    // Chain information
    chainId: {
        type: Number,
        required: true,
        index: true
    },

    // Generation metadata
    generationTime: {
        type: Number, // in milliseconds
        min: 0
    },

    circuitName: {
        type: String,
        default: 'randomness'
    },

    verificationKeyHash: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Verification key hash must be a valid hex string'
        }
    },

    // Size information
    proofSize: {
        type: Number,
        min: 0
    },

    // Validation flags
    isValid: {
        type: Boolean,
        default: null
    },

    // Error information
    error: {
        message: String,
        code: String,
        stage: {
            type: String,
            enum: ['generation', 'verification', 'submission', 'finalization']
        },
        details: mongoose.Schema.Types.Mixed
    },

    // Performance metrics
    metrics: {
        witnessGenerationTime: Number,
        proofGenerationTime: Number,
        verificationTime: Number,
        submissionTime: Number,
        totalTime: Number
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes for efficient queries
proofSchema.index({ requestId: 1, chainId: 1 });
proofSchema.index({ verificationStatus: 1, createdAt: 1 });
proofSchema.index({ 'zkVerifySubmission.jobId': 1 }, { sparse: true });
proofSchema.index({ 'zkVerifySubmission.status': 1 });

// Virtual for Solidity-formatted proof
proofSchema.virtual('solidityProof').get(function () {
    if (!this.proofData?.proof) return null;

    return {
        a: [this.proofData.proof.pi_a[0], this.proofData.proof.pi_a[1]],
        b: [
            [this.proofData.proof.pi_b[0][1], this.proofData.proof.pi_b[0][0]],
            [this.proofData.proof.pi_b[1][1], this.proofData.proof.pi_b[1][0]]
        ],
        c: [this.proofData.proof.pi_c[0], this.proofData.proof.pi_c[1]],
        publicInputs: this.proofData.publicSignals
    };
});

// Virtual for random value extraction
proofSchema.virtual('randomValue').get(function () {
    return this.proofData?.publicSignals?.[0] || null;
});

// Instance methods
proofSchema.methods.markAsVerified = function (isValid = true) {
    this.verificationStatus = isValid ? 'verified' : 'invalid';
    this.isValid = isValid;

    if (this.createdAt) {
        this.metrics = this.metrics || {};
        this.metrics.verificationTime = Date.now() - this.createdAt.getTime();
    }

    return this.save();
};

proofSchema.methods.markAsFailed = function (error, stage = 'generation') {
    this.verificationStatus = 'failed';
    this.error = {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        stage: stage,
        details: error.details || null
    };
    return this.save();
};

proofSchema.methods.updateZKVerifyStatus = function (status, data = {}) {
    this.zkVerifySubmission = this.zkVerifySubmission || {};
    this.zkVerifySubmission.status = status;

    if (data.jobId) {
        this.zkVerifySubmission.jobId = data.jobId;
    }

    if (data.submissionTx) {
        this.zkVerifySubmission.submissionTx = data.submissionTx;
        this.zkVerifySubmission.submittedAt = new Date();
    }

    if (data.verificationTx) {
        this.zkVerifySubmission.verificationTx = data.verificationTx;
        this.zkVerifySubmission.verifiedAt = new Date();
    }

    if (data.error) {
        this.zkVerifySubmission.error = data.error;
    }

    return this.save();
};

proofSchema.methods.calculateMetrics = function () {
    if (!this.createdAt) return;

    this.metrics = this.metrics || {};
    this.metrics.totalTime = Date.now() - this.createdAt.getTime();

    return this.save();
};

// Static methods
proofSchema.statics.findByRequest = function (requestId) {
    return this.findOne({ requestId });
};

proofSchema.statics.findPendingVerifications = function () {
    return this.find({
        verificationStatus: 'pending',
        'zkVerifySubmission.status': { $in: ['pending', 'submitted'] }
    }).sort({ createdAt: 1 });
};

proofSchema.statics.findByJobId = function (jobId) {
    return this.findOne({ 'zkVerifySubmission.jobId': jobId });
};

proofSchema.statics.getStatistics = function (chainId, timeRange = 24 * 60 * 60 * 1000) {
    const since = new Date(Date.now() - timeRange);
    const query = { createdAt: { $gte: since } };

    if (chainId) {
        query.chainId = chainId;
    }

    return this.aggregate([
        { $match: query },
        {
            $group: {
                _id: '$verificationStatus',
                count: { $sum: 1 },
                avgGenerationTime: { $avg: '$generationTime' },
                avgTotalTime: { $avg: '$metrics.totalTime' }
            }
        }
    ]);
};

proofSchema.statics.findDuplicateProofs = function () {
    return this.aggregate([
        {
            $group: {
                _id: '$proofHash',
                count: { $sum: 1 },
                proofs: { $push: '$_id' }
            }
        },
        {
            $match: {
                count: { $gt: 1 }
            }
        }
    ]);
};

// Pre-save middleware
proofSchema.pre('save', function (next) {
    // Generate proof hash if not set
    if (!this.proofHash && this.proofData?.proof) {
        const crypto = require('crypto');
        const proofString = JSON.stringify({
            a: this.proofData.proof.pi_a,
            b: this.proofData.proof.pi_b,
            c: this.proofData.proof.pi_c
        });
        this.proofHash = '0x' + crypto.createHash('sha256').update(proofString).digest('hex');
    }

    // Generate proof ID if not set
    if (!this.proofId) {
        this.proofId = `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Calculate proof size
    if (this.proofData && !this.proofSize) {
        this.proofSize = JSON.stringify(this.proofData).length;
    }

    next();
});

// Post-save middleware for logging
proofSchema.post('save', function (doc) {
    const logger = require('../utils/logger');
    logger.debug('Proof saved', {
        proofId: doc.proofId,
        requestId: doc.requestId,
        status: doc.verificationStatus,
        chainId: doc.chainId
    });
});

module.exports = mongoose.model('Proof', proofSchema);