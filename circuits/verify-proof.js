const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

class ProofVerifier {
    constructor() {
        this.circuitPath = path.join(__dirname, "build");
        this.vKeyPath = path.join(this.circuitPath, "verification_key.json");
    }

    async verifyProof(proof, publicSignals) {
        try {
            console.log("🔍 Verifying ZK proof...");

            if (!fs.existsSync(this.vKeyPath)) {
                throw new Error("Verification key not found. Please compile circuits first.");
            }

            const vKey = JSON.parse(fs.readFileSync(this.vKeyPath, "utf8"));
            const result = await snarkjs.groth16.verify(vKey, publicSignals, proof);

            console.log(`${result ? "✅" : "❌"} Proof verification: ${result ? "VALID" : "INVALID"}`);
            return result;

        } catch (error) {
            console.error("❌ Error verifying proof:", error);
            throw error;
        }
    }

    async verifyProofFromFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`Proof file not found: ${filePath}`);
            }

            const proofData = JSON.parse(fs.readFileSync(filePath, "utf8"));

            if (!proofData.proof || !proofData.publicSignals) {
                throw new Error("Invalid proof file format");
            }

            return await this.verifyProof(proofData.proof, proofData.publicSignals);

        } catch (error) {
            console.error("❌ Error verifying proof from file:", error);
            throw error;
        }
    }

    validatePublicSignals(publicSignals, expectedCount = 2) {
        if (!Array.isArray(publicSignals)) {
            throw new Error("Public signals must be an array");
        }

        if (publicSignals.length !== expectedCount) {
            throw new Error(`Expected ${expectedCount} public signals, got ${publicSignals.length}`);
        }

        // Validate that signals are valid field elements
        for (let i = 0; i < publicSignals.length; i++) {
            const signal = BigInt(publicSignals[i]);
            if (signal < 0n) {
                throw new Error(`Public signal ${i} must be non-negative`);
            }
        }

        return true;
    }

    formatProofForVerification(solidityProof) {
        // Convert from Solidity format back to snarkjs format
        return {
            pi_a: [solidityProof.a[0], solidityProof.a[1], "1"],
            pi_b: [
                [solidityProof.b[0][1], solidityProof.b[0][0]],
                [solidityProof.b[1][1], solidityProof.b[1][0]],
                ["1", "0"]
            ],
            pi_c: [solidityProof.c[0], solidityProof.c[1], "1"],
            protocol: "groth16",
            curve: "bn128"
        };
    }

    async batchVerify(proofs) {
        console.log(`🔄 Batch verifying ${proofs.length} proofs...`);

        const results = [];
        let validCount = 0;

        for (let i = 0; i < proofs.length; i++) {
            try {
                const isValid = await this.verifyProof(
                    proofs[i].proof,
                    proofs[i].publicSignals
                );

                results.push({
                    index: i,
                    valid: isValid,
                    randomValue: proofs[i].publicSignals[0]
                });

                if (isValid) validCount++;

            } catch (error) {
                console.error(`❌ Error verifying proof ${i}:`, error.message);
                results.push({
                    index: i,
                    valid: false,
                    error: error.message
                });
            }
        }

        console.log(`📊 Batch verification complete: ${validCount}/${proofs.length} valid`);
        return results;
    }

    getVerificationKey() {
        if (!fs.existsSync(this.vKeyPath)) {
            throw new Error("Verification key not found");
        }

        return JSON.parse(fs.readFileSync(this.vKeyPath, "utf8"));
    }

    exportVerificationKeyHash() {
        const vKey = this.getVerificationKey();
        const vKeyString = JSON.stringify(vKey);
        const crypto = require("crypto");
        return crypto.createHash("sha256").update(vKeyString).digest("hex");
    }
}

// CLI usage
if (require.main === module) {
    async function main() {
        const args = process.argv.slice(2);
        const verifier = new ProofVerifier();

        try {
            if (args.length === 0) {
                // Try to verify test proof
                const testProofPath = path.join(__dirname, "build", "test_proof.json");
                if (fs.existsSync(testProofPath)) {
                    await verifier.verifyProofFromFile(testProofPath);
                } else {
                    console.log("No test proof found. Generate one first with generate-proof.js");
                }
            } else {
                // Verify proof from specified file
                await verifier.verifyProofFromFile(args[0]);
            }

            // Print verification key hash
            console.log("🔑 Verification key hash:", verifier.exportVerificationKeyHash());

        } catch (error) {
            console.error("❌ Error:", error.message);
            process.exit(1);
        }
    }

    main();
}

module.exports = ProofVerifier;