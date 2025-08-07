const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class ProofService {
    constructor() {
        this.circuitPath = path.join(__dirname, '../../../circuits/build');
        this.zkeyPath = path.join(this.circuitPath, 'randomness_0001.zkey');
        this.wasmPath = path.join(this.circuitPath, 'randomness_js', 'randomness.wasm');
        this.vKeyPath = path.join(this.circuitPath, 'verification_key.json');

        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        try {
            // Check if circuit files exist
            const requiredFiles = [this.zkeyPath, this.wasmPath, this.vKeyPath];
            const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

            if (missingFiles.length > 0) {
                logger.warn('Circuit files not found, proof generation will be disabled', {
                    missingFiles: missingFiles.map(f => path.basename(f))
                });
                return;
            }

            logger.info('Proof service initialized successfully', {
                circuitPath: this.circuitPath,
                filesFound: requiredFiles.length
            });

            this.initialized = true;

        } catch (error) {
            logger.error('Failed to initialize proof service', error);
        }
    }

    /**
     * Generate ZK proof for randomness
     */
    async generateProof(inputs) {
        const timer = logger.time('generateProof');

        try {
            if (!this.initialized) {
                throw new Error('Proof service not initialized - circuit files missing');
            }

            logger.info('Generating ZK proof', {
                inputKeys: Object.keys(inputs),
                circuitPath: this.circuitPath
            });

            // Validate inputs
            this.validateInputs(inputs);

            // Convert inputs to proper format
            const formattedInputs = this.formatInputs(inputs);

            logger.debug('Formatted inputs for circuit', {
                blockHash: formattedInputs.blockHash,
                nonce: formattedInputs.nonce,
                timestamp: formattedInputs.timestamp,
                // Don't log entropy and salt for security
                hasEntropy: !!formattedInputs.entropy,
                hasSalt: !!formattedInputs.salt
            });

            // Generate witness and proof
            const witnessTimer = logger.time('generateWitness');
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                formattedInputs,
                this.wasmPath,
                this.zkeyPath
            );
            const witnessDuration = witnessTimer.end();

            const totalDuration = timer.end();

            logger.info('ZK proof generated successfully', {
                publicSignalsCount: publicSignals.length,
                randomValue: publicSignals[0],
                witnessDuration: `${witnessDuration}ms`,
                totalDuration: `${totalDuration}ms`
            });

            return {
                proof,
                publicSignals,
                inputs: formattedInputs,
                metadata: {
                    circuit: 'randomness',
                    version: '1.0.0',
                    generatedAt: Date.now(),
                    generationTime: totalDuration,
                    witnessTime: witnessDuration
                }
            };

        } catch (error) {
            timer.end();
            logger.error('Failed to generate ZK proof', error, {
                inputKeys: Object.keys(inputs || {})
            });
            throw new Error(`Proof generation failed: ${error.message}`);
        }
    }

    /**
     * Verify ZK proof locally
     */
    async verifyProof(proof, publicSignals) {
        const timer = logger.time('verifyProof');

        try {
            if (!this.initialized) {
                throw new Error('Proof service not initialized');
            }

            logger.debug('Verifying ZK proof locally', {
                publicSignalsCount: publicSignals?.length
            });

            // Load verification key
            const vKey = JSON.parse(fs.readFileSync(this.vKeyPath, 'utf8'));

            // Verify proof
            const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

            const duration = timer.end();

            logger.info('ZK proof verification completed', {
                isValid,
                duration: `${duration}ms`,
                randomValue: publicSignals?.[0]
            });

            return {
                isValid,
                verificationTime: duration,
                randomValue: publicSignals?.[0],
                proofValue: publicSignals?.[1]
            };

        } catch (error) {
            timer.end();
            logger.error('Failed to verify ZK proof', error);
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    /**
     * Format proof for Solidity contracts
     */
    formatProofForSolidity(proof) {
        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    /**
     * Validate circuit inputs
     */
    validateInputs(inputs) {
        const requiredFields = ['blockHash', 'nonce', 'timestamp', 'entropy', 'salt'];

        for (const field of requiredFields) {
            if (!(field in inputs)) {
                throw new Error(`Missing required input field: ${field}`);
            }
        }

        // Validate ranges and formats
        if (!this.isValidHex(inputs.blockHash) || inputs.blockHash.length !== 66) {
            throw new Error('blockHash must be a valid 32-byte hex string');
        }

        if (BigInt(inputs.entropy) <= 0n) {
            throw new Error('entropy must be positive');
        }

        if (BigInt(inputs.salt) <= 0n) {
            throw new Error('salt must be positive');
        }

        if (BigInt(inputs.nonce) < 0n) {
            throw new Error('nonce must be non-negative');
        }

        if (BigInt(inputs.timestamp) <= 0n) {
            throw new Error('timestamp must be positive');
        }
    }

    /**
     * Format inputs for circuit
     */
    formatInputs(inputs) {
        return {
            blockHash: this.hexToBigInt(inputs.blockHash).toString(),
            nonce: BigInt(inputs.nonce).toString(),
            timestamp: BigInt(inputs.timestamp).toString(),
            entropy: BigInt(inputs.entropy).toString(),
            salt: BigInt(inputs.salt).toString()
        };
    }

    /**
     * Generate random test inputs
     */
    generateRandomInputs(seed = null) {
        const crypto = require('crypto');

        // Use provided seed or generate random
        const seedValue = seed || crypto.randomBytes(32).toString('hex');

        return {
            blockHash: '0x' + crypto.randomBytes(32).toString('hex'),
            nonce: Math.floor(Math.random() * 1000000).toString(),
            timestamp: Date.now().toString(),
            entropy: crypto.randomBytes(16).toString('hex'),
            salt: Math.floor(Math.random() * 1000000000).toString()
        };
    }

    /**
     * Get verification key hash
     */
    getVerificationKeyHash() {
        try {
            if (!fs.existsSync(this.vKeyPath)) {
                throw new Error('Verification key file not found');
            }

            const vKey = fs.readFileSync(this.vKeyPath, 'utf8');
            const crypto = require('crypto');

            return '0x' + crypto.createHash('sha256').update(vKey).digest('hex');

        } catch (error) {
            logger.error('Failed to get verification key hash', error);
            return null;
        }
    }

    /**
     * Get circuit statistics
     */
    getCircuitInfo() {
        try {
            const stats = {
                initialized: this.initialized,
                circuitPath: this.circuitPath,
                files: {
                    zkey: fs.existsSync(this.zkeyPath),
                    wasm: fs.existsSync(this.wasmPath),
                    vkey: fs.existsSync(this.vKeyPath)
                }
            };

            if (stats.files.zkey) {
                stats.zkeySize = fs.statSync(this.zkeyPath).size;
            }

            if (stats.files.wasm) {
                stats.wasmSize = fs.statSync(this.wasmPath).size;
            }

            if (stats.files.vkey) {
                const vKey = JSON.parse(fs.readFileSync(this.vKeyPath, 'utf8'));
                stats.vkeyHash = this.getVerificationKeyHash();
                stats.curve = vKey.curve;
                stats.protocol = vKey.protocol;
            }

            return stats;

        } catch (error) {
            logger.error('Failed to get circuit info', error);
            return { initialized: false, error: error.message };
        }
    }

    // Utility methods

    isValidHex(str) {
        return /^0x[a-fA-F0-9]+$/.test(str);
    }

    hexToBigInt(hex) {
        return BigInt(hex);
    }

    bigIntToHex(bigint) {
        return '0x' + bigint.toString(16);
    }

    /**
     * Batch generate proofs (for testing)
     */
    async batchGenerateProofs(inputsArray) {
        const results = [];

        for (let i = 0; i < inputsArray.length; i++) {
            try {
                const result = await this.generateProof(inputsArray[i]);
                results.push({ index: i, success: true, result });
            } catch (error) {
                results.push({ index: i, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Test proof generation with random inputs
     */
    async testProofGeneration() {
        try {
            const inputs = this.generateRandomInputs();
            const proofData = await this.generateProof(inputs);
            const verification = await this.verifyProof(proofData.proof, proofData.publicSignals);

            return {
                success: true,
                proofGenerated: true,
                verificationResult: verification,
                randomValue: proofData.publicSignals[0]
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new ProofService();