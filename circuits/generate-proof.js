const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

class ProofGenerator {
    constructor() {
        this.circuitPath = path.join(__dirname, "build");
        this.zkeyPath = path.join(this.circuitPath, "randomness_0001.zkey");
        this.wasmPath = path.join(this.circuitPath, "randomness_js", "randomness.wasm");
    }

    async generateProof(inputs) {
        try {
            console.log("🔄 Generating ZK proof...");
            console.log("📊 Inputs:", JSON.stringify(inputs, null, 2));

            // Validate inputs
            this.validateInputs(inputs);

            // Generate witness
            console.log("🔍 Calculating witness...");
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                inputs,
                this.wasmPath,
                this.zkeyPath
            );

            console.log("✅ Proof generated successfully!");
            console.log("📋 Public signals:", publicSignals);

            return {
                proof,
                publicSignals,
                inputs: inputs
            };

        } catch (error) {
            console.error("❌ Error generating proof:", error);
            throw error;
        }
    }

    async verifyProof(proof, publicSignals) {
        try {
            console.log("🔍 Verifying proof...");

            const vKey = JSON.parse(
                fs.readFileSync(
                    path.join(this.circuitPath, "verification_key.json"),
                    "utf8"
                )
            );

            const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

            console.log(res ? "✅ Proof is valid!" : "❌ Proof is invalid!");
            return res;

        } catch (error) {
            console.error("❌ Error verifying proof:", error);
            throw error;
        }
    }

    validateInputs(inputs) {
        const requiredFields = ["blockHash", "nonce", "timestamp", "entropy", "salt"];

        for (const field of requiredFields) {
            if (!(field in inputs)) {
                throw new Error(`Missing required input field: ${field}`);
            }
        }

        // Validate ranges
        if (BigInt(inputs.blockHash) <= 0n) {
            throw new Error("blockHash must be positive");
        }

        if (BigInt(inputs.entropy) <= 0n) {
            throw new Error("entropy must be positive");
        }

        if (BigInt(inputs.salt) <= 0n) {
            throw new Error("salt must be positive");
        }
    }

    formatProofForSolidity(proof) {
        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    generateRandomInputs() {
        const blockHash = BigInt("0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
        const nonce = BigInt(Math.floor(Math.random() * 1000000));
        const timestamp = BigInt(Date.now());
        const entropy = BigInt(Math.floor(Math.random() * 1000000000));
        const salt = BigInt(Math.floor(Math.random() * 1000000000));

        return {
            blockHash: blockHash.toString(),
            nonce: nonce.toString(),
            timestamp: timestamp.toString(),
            entropy: entropy.toString(),
            salt: salt.toString()
        };
    }
}

// CLI usage
if (require.main === module) {
    async function main() {
        const generator = new ProofGenerator();

        try {
            // Generate random inputs for testing
            const inputs = generator.generateRandomInputs();

            // Generate proof
            const proofData = await generator.generateProof(inputs);

            // Verify proof
            const isValid = await generator.verifyProof(
                proofData.proof,
                proofData.publicSignals
            );

            if (isValid) {
                // Save proof to file
                const outputPath = path.join(__dirname, "build", "test_proof.json");
                fs.writeFileSync(outputPath, JSON.stringify({
                    ...proofData,
                    solidityProof: generator.formatProofForSolidity(proofData.proof)
                }, null, 2));

                console.log(`📁 Proof saved to: ${outputPath}`);
            }

        } catch (error) {
            console.error("❌ Error:", error.message);
            process.exit(1);
        }
    }

    main();
}

module.exports = ProofGenerator;