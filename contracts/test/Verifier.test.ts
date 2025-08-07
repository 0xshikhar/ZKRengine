import { expect } from "chai";
import { ethers } from "hardhat";
import { Verifier } from "../typechain-types";
import { SignerWithAddress } from "@ethersproject/contracts";

describe("Verifier", function () {
    let verifier: Verifier;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        const Verifier = await ethers.getContractFactory("Verifier");
        verifier = await Verifier.deploy(owner.address);
        await verifier.deployed();
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await verifier.owner()).to.equal(owner.address);
        });

        it("Should have correct initial configuration", async function () {
            expect(await verifier.verificationTimeout()).to.equal(3600); // 1 hour
            expect(await verifier.maxProofSize()).to.equal(1000);
            expect(await verifier.minProofSize()).to.equal(10);
        });
    });

    describe("Verification Key Management", function () {
        const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        it("Should allow owner to register verification key", async function () {
            const keyHash = await verifier.registerVerificationKey(testKey);
            expect(await verifier.isKeyRegistered(keyHash)).to.be.true;
        });

        it("Should not allow non-owner to register key", async function () {
            await expect(
                verifier.connect(user1).registerVerificationKey(testKey)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not allow duplicate key registration", async function () {
            await verifier.registerVerificationKey(testKey);
            await expect(
                verifier.registerVerificationKey(testKey)
            ).to.be.revertedWith("Verifier: Key already registered");
        });

        it("Should not allow empty key registration", async function () {
            await expect(
                verifier.registerVerificationKey("0x")
            ).to.be.revertedWith("Verifier: Empty verification key");
        });

        it("Should return correct key info", async function () {
            const keyHash = await verifier.registerVerificationKey(testKey);
            const [registered, registrar, registrationTime] = await verifier.getKeyInfo(keyHash);

            expect(registered).to.be.true;
            expect(registrar).to.equal(owner.address);
            expect(registrationTime).to.be.gt(0);
        });
    });

    describe("Proof Verification", function () {
        let keyHash: string;
        const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async function () {
            keyHash = await verifier.registerVerificationKey(testKey);
        });

        it("Should verify valid proof", async function () {
            const a = [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")];
            const b = [
                [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
            ];
            const c = [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")];
            const publicInputs = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];

            const result = await verifier.verifyProof(keyHash, a, b, c, publicInputs);
            expect(result).to.be.true;
        });

        it("Should reject proof with unregistered key", async function () {
            const unregisteredKey = ethers.utils.keccak256("unregistered");
            const a = [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")];
            const b = [
                [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
            ];
            const c = [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")];
            const publicInputs = [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")];

            await expect(
                verifier.verifyProof(unregisteredKey, a, b, c, publicInputs)
            ).to.be.revertedWith("Verifier: Key not registered");
        });

        it("Should reject proof with invalid structure", async function () {
            const a = [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")];
            const b = [
                [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")],
                [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")]
            ];
            const c = [ethers.BigNumber.from("0"), ethers.BigNumber.from("0")];
            const publicInputs: ethers.BigNumber[] = [];

            const result = await verifier.verifyProof(keyHash, a, b, c, publicInputs);
            expect(result).to.be.false;
        });

        it("Should reject proof with too few public inputs", async function () {
            const a = [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")];
            const b = [
                [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
            ];
            const c = [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")];
            const publicInputs = [ethers.BigNumber.from("100")]; // Only 1 input

            const result = await verifier.verifyProof(keyHash, a, b, c, publicInputs);
            expect(result).to.be.false;
        });

        it("Should reject proof with zero random value", async function () {
            const a = [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")];
            const b = [
                [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
            ];
            const c = [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")];
            const publicInputs = [ethers.BigNumber.from("0"), ethers.BigNumber.from("200")]; // Zero random value

            const result = await verifier.verifyProof(keyHash, a, b, c, publicInputs);
            expect(result).to.be.false;
        });
    });

    describe("Proof Submission", function () {
        let keyHash: string;
        const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async function () {
            keyHash = await verifier.registerVerificationKey(testKey);
        });

        it("Should submit proof successfully", async function () {
            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")]
            };

            const jobId = await verifier.connect(user1).submitProof(proof, 1);
            expect(jobId).to.not.equal(ethers.constants.HashZero);

            const [status, txHash] = await verifier.getJobStatus(jobId);
            expect(status).to.equal("submitted");
            expect(txHash).to.equal(ethers.constants.HashZero);
        });

        it("Should reject submission with invalid target chain", async function () {
            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")]
            };

            await expect(
                verifier.connect(user1).submitProof(proof, 0)
            ).to.be.revertedWith("Verifier: Invalid target chain");
        });

        it("Should reject duplicate job submission", async function () {
            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")]
            };

            await verifier.connect(user1).submitProof(proof, 1);
            await expect(
                verifier.connect(user1).submitProof(proof, 1)
            ).to.be.revertedWith("Verifier: Job already exists");
        });
    });

    describe("Job Processing", function () {
        let keyHash: string;
        let jobId: string;
        const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async function () {
            keyHash = await verifier.registerVerificationKey(testKey);

            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")]
            };

            jobId = await verifier.connect(user1).submitProof(proof, 1);
        });

        it("Should process verification successfully", async function () {
            const txHash = ethers.utils.keccak256("test");
            await verifier.processVerification(jobId, true, txHash);

            const [status, returnedTxHash] = await verifier.getJobStatus(jobId);
            expect(status).to.equal("verified");
            expect(returnedTxHash).to.equal(txHash);
        });

        it("Should reject verification", async function () {
            await verifier.processVerification(jobId, false, ethers.constants.HashZero);

            const [status, txHash] = await verifier.getJobStatus(jobId);
            expect(status).to.equal("rejected");
            expect(txHash).to.equal(ethers.constants.HashZero);
        });

        it("Should not allow non-owner to process verification", async function () {
            await expect(
                verifier.connect(user1).processVerification(jobId, true, ethers.constants.HashZero)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not allow processing already processed job", async function () {
            await verifier.processVerification(jobId, true, ethers.constants.HashZero);

            await expect(
                verifier.processVerification(jobId, true, ethers.constants.HashZero)
            ).to.be.revertedWith("Verifier: Job already processed");
        });

        it("Should reject expired job", async function () {
            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [3601]); // 1 hour + 1 second
            await ethers.provider.send("evm_mine", []);

            await expect(
                verifier.processVerification(jobId, true, ethers.constants.HashZero)
            ).to.be.revertedWith("Verifier: Job expired");
        });
    });

    describe("Statistics", function () {
        let keyHash: string;
        const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

        beforeEach(async function () {
            keyHash = await verifier.registerVerificationKey(testKey);
        });

        it("Should track statistics correctly", async function () {
            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("100"), ethers.BigNumber.from("200")]
            };

            // Submit proof
            const jobId = await verifier.connect(user1).submitProof(proof, 1);

            let [totalSubmitted, totalVerified, totalRejected, pendingJobs] = await verifier.getStats();
            expect(totalSubmitted).to.equal(1);
            expect(totalVerified).to.equal(0);
            expect(totalRejected).to.equal(0);
            expect(pendingJobs).to.equal(1);

            // Process verification
            await verifier.processVerification(jobId, true, ethers.constants.HashZero);

            [totalSubmitted, totalVerified, totalRejected, pendingJobs] = await verifier.getStats();
            expect(totalSubmitted).to.equal(1);
            expect(totalVerified).to.equal(1);
            expect(totalRejected).to.equal(0);
            expect(pendingJobs).to.equal(0);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to update verification timeout", async function () {
            await verifier.updateVerificationTimeout(7200); // 2 hours
            expect(await verifier.verificationTimeout()).to.equal(7200);
        });

        it("Should not allow non-owner to update timeout", async function () {
            await expect(
                verifier.connect(user1).updateVerificationTimeout(7200)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow owner to update max proof size", async function () {
            await verifier.updateMaxProofSize(2000);
            expect(await verifier.maxProofSize()).to.equal(2000);
        });

        it("Should not allow invalid max proof size", async function () {
            await expect(
                verifier.updateMaxProofSize(5) // Less than min proof size
            ).to.be.revertedWith("Verifier: Invalid size");
        });

        it("Should allow owner to update min proof size", async function () {
            await verifier.updateMinProofSize(20);
            expect(await verifier.minProofSize()).to.equal(20);
        });

        it("Should not allow invalid min proof size", async function () {
            await expect(
                verifier.updateMinProofSize(2000) // Greater than max proof size
            ).to.be.revertedWith("Verifier: Invalid size");
        });
    });
}); 