const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ZKRandomOracle", function () {
    async function deployZKRandomOracleFixture() {
        const [owner, relayer, user1, user2] = await ethers.getSigners();

        // Mock zkVerify contract
        const MockZKVerify = await ethers.getContractFactory("MockZKVerify");
        const mockZKVerify = await MockZKVerify.deploy();

        // Deploy ZKRandomOracle
        const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
        const verificationKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-vk"));
        const zkRandomOracle = await ZKRandomOracle.deploy(
            mockZKVerify.address,
            verificationKeyHash,
            owner.address
        );

        // Set up relayer
        await zkRandomOracle.connect(owner).setRelayerAuthorization(relayer.address, true);

        return {
            zkRandomOracle,
            mockZKVerify,
            owner,
            relayer,
            user1,
            user2,
            verificationKeyHash
        };
    }

    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            const { zkRandomOracle, mockZKVerify, owner, verificationKeyHash } = await loadFixture(
                deployZKRandomOracleFixture
            );

            expect(await zkRandomOracle.zkVerify()).to.equal(mockZKVerify.address);
            expect(await zkRandomOracle.verificationKeyHash()).to.equal(verificationKeyHash);
            expect(await zkRandomOracle.owner()).to.equal(owner.address);
            expect(await zkRandomOracle.nextRequestId()).to.equal(1);
        });

        it("Should authorize owner as relayer", async function () {
            const { zkRandomOracle, owner } = await loadFixture(deployZKRandomOracleFixture);
            expect(await zkRandomOracle.authorizedRelayers(owner.address)).to.be.true;
        });
    });

    describe("Request Randomness", function () {
        it("Should request randomness with valid parameters", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const seed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-seed"));
            const fee = await zkRandomOracle.getRequestFee();

            await expect(zkRandomOracle.connect(user1).requestRandomness(seed, { value: fee }))
                .to.emit(zkRandomOracle, "RandomnessRequested")
                .withArgs(1, user1.address, seed, fee);

            const request = await zkRandomOracle.getRequest(1);
            expect(request.requester).to.equal(user1.address);
            expect(request.seed).to.equal(seed);
            expect(request.fulfilled).to.be.false;
        });

        it("Should reject request with insufficient fee", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const seed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-seed"));
            const fee = await zkRandomOracle.getRequestFee();

            await expect(
                zkRandomOracle.connect(user1).requestRandomness(seed, { value: fee.sub(1) })
            ).to.be.revertedWith("ZKRandomOracle: Insufficient fee");
        });

        it("Should reject request with zero seed", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const seed = ethers.constants.HashZero;
            const fee = await zkRandomOracle.getRequestFee();

            await expect(
                zkRandomOracle.connect(user1).requestRandomness(seed, { value: fee })
            ).to.be.revertedWith("ZKRandomOracle: Invalid seed");
        });

        it("Should increment request ID", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const seed1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("seed1"));
            const seed2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("seed2"));
            const fee = await zkRandomOracle.getRequestFee();

            await zkRandomOracle.connect(user1).requestRandomness(seed1, { value: fee });
            await zkRandomOracle.connect(user1).requestRandomness(seed2, { value: fee });

            expect(await zkRandomOracle.nextRequestId()).to.equal(3);
        });
    });

    describe("Fulfill Randomness", function () {
        async function setupRequestFixture() {
            const fixture = await loadFixture(deployZKRandomOracleFixture);
            const { zkRandomOracle, user1 } = fixture;

            const seed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-seed"));
            const fee = await zkRandomOracle.getRequestFee();

            await zkRandomOracle.connect(user1).requestRandomness(seed, { value: fee });

            return { ...fixture, seed, requestId: 1 };
        }

        it("Should fulfill randomness with valid proof", async function () {
            const { zkRandomOracle, mockZKVerify, relayer, requestId } = await loadFixture(
                setupRequestFixture
            );

            // Mock proof data
            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("12345"), ethers.BigNumber.from("67890")]
            };

            // Set mock to return true for verification
            await mockZKVerify.setVerificationResult(true);

            await expect(zkRandomOracle.connect(relayer).fulfillRandomness(requestId, proof))
                .to.emit(zkRandomOracle, "RandomnessFulfilled");

            const request = await zkRandomOracle.getRequest(requestId);
            expect(request.fulfilled).to.be.true;
            expect(request.randomValue).to.equal(proof.publicInputs[0]);
        });

        it("Should reject fulfillment from unauthorized relayer", async function () {
            const { zkRandomOracle, user1, requestId } = await loadFixture(setupRequestFixture);

            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("12345"), ethers.BigNumber.from("67890")]
            };

            await expect(
                zkRandomOracle.connect(user1).fulfillRandomness(requestId, proof)
            ).to.be.revertedWith("ZKRandomOracle: Unauthorized relayer");
        });

        it("Should reject invalid proof", async function () {
            const { zkRandomOracle, mockZKVerify, relayer, requestId } = await loadFixture(
                setupRequestFixture
            );

            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("12345"), ethers.BigNumber.from("67890")]
            };

            // Set mock to return false for verification
            await mockZKVerify.setVerificationResult(false);

            await expect(
                zkRandomOracle.connect(relayer).fulfillRandomness(requestId, proof)
            ).to.be.revertedWith("ZKRandomOracle: Invalid proof");
        });

        it("Should reject duplicate proof", async function () {
            const { zkRandomOracle, mockZKVerify, relayer, user1, requestId } = await loadFixture(
                setupRequestFixture
            );

            const proof = {
                a: [ethers.BigNumber.from("1"), ethers.BigNumber.from("2")],
                b: [
                    [ethers.BigNumber.from("3"), ethers.BigNumber.from("4")],
                    [ethers.BigNumber.from("5"), ethers.BigNumber.from("6")]
                ],
                c: [ethers.BigNumber.from("7"), ethers.BigNumber.from("8")],
                publicInputs: [ethers.BigNumber.from("12345"), ethers.BigNumber.from("67890")]
            };

            await mockZKVerify.setVerificationResult(true);
            await zkRandomOracle.connect(relayer).fulfillRandomness(requestId, proof);

            // Create second request
            const seed2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("seed2"));
            const fee = await zkRandomOracle.getRequestFee();
            await zkRandomOracle.connect(user1).requestRandomness(seed2, { value: fee });

            // Try to use same proof
            await expect(
                zkRandomOracle.connect(relayer).fulfillRandomness(2, proof)
            ).to.be.revertedWith("ZKRandomOracle: Proof already used");
        });
    });

    describe("Admin Functions", function () {
        it("Should update verification key hash", async function () {
            const { zkRandomOracle, owner } = await loadFixture(deployZKRandomOracleFixture);

            const newKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new-vk"));

            await expect(zkRandomOracle.connect(owner).updateVerificationKey(newKeyHash))
                .to.emit(zkRandomOracle, "VerificationKeyUpdated");

            expect(await zkRandomOracle.verificationKeyHash()).to.equal(newKeyHash);
        });

        it("Should update request fee", async function () {
            const { zkRandomOracle, owner } = await loadFixture(deployZKRandomOracleFixture);

            const newFee = ethers.utils.parseEther("0.002");

            await expect(zkRandomOracle.connect(owner).updateRequestFee(newFee))
                .to.emit(zkRandomOracle, "RequestFeeUpdated");

            expect(await zkRandomOracle.getRequestFee()).to.equal(newFee);
        });

        it("Should authorize/deauthorize relayers", async function () {
            const { zkRandomOracle, owner, user1 } = await loadFixture(deployZKRandomOracleFixture);

            await expect(zkRandomOracle.connect(owner).setRelayerAuthorization(user1.address, true))
                .to.emit(zkRandomOracle, "RelayerAuthorized")
                .withArgs(user1.address, true);

            expect(await zkRandomOracle.authorizedRelayers(user1.address)).to.be.true;

            await zkRandomOracle.connect(owner).setRelayerAuthorization(user1.address, false);
            expect(await zkRandomOracle.authorizedRelayers(user1.address)).to.be.false;
        });

        it("Should reject admin calls from non-owner", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const newKeyHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("new-vk"));

            await expect(
                zkRandomOracle.connect(user1).updateVerificationKey(newKeyHash)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Statistics and Views", function () {
        it("Should return correct statistics", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const stats = await zkRandomOracle.getStats();
            expect(stats._totalRequests).to.equal(0);
            expect(stats._fulfilledRequests).to.equal(0);
            expect(stats._pendingRequests).to.equal(0);

            // Make a request
            const seed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-seed"));
            const fee = await zkRandomOracle.getRequestFee();
            await zkRandomOracle.connect(user1).requestRandomness(seed, { value: fee });

            const newStats = await zkRandomOracle.getStats();
            expect(newStats._totalRequests).to.equal(1);
            expect(newStats._pendingRequests).to.equal(1);
        });

        it("Should track user requests", async function () {
            const { zkRandomOracle, user1 } = await loadFixture(deployZKRandomOracleFixture);

            const seed1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("seed1"));
            const seed2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("seed2"));
            const fee = await zkRandomOracle.getRequestFee();

            await zkRandomOracle.connect(user1).requestRandomness(seed1, { value: fee });
            await zkRandomOracle.connect(user1).requestRandomness(seed2, { value: fee });

            const userRequests = await zkRandomOracle.getUserRequests(user1.address);
            expect(userRequests.length).to.equal(2);
            expect(userRequests[0]).to.equal(1);
            expect(userRequests[1]).to.equal(2);
        });
    });
});

// Mock zkVerify contract for testing
contract("MockZKVerify", function () {
    constructor() { }
    
    bool private verificationResult = true;

function setVerificationResult(bool _result) external {
    verificationResult = _result;
}

function verifyProof(
    bytes32,
    uint256[2]calldata,
        uint256[2][2] calldata,
            uint256[2] calldata,
                uint256[] calldata
    ) external view returns(bool) {
    return verificationResult;
}

function submitProof(
    IZKVerify.ProofData calldata,
    uint256
) external returns(bytes32) {
    return keccak256(abi.encodePacked(block.timestamp, msg.sender));
}

function getJobStatus(bytes32)
external
pure
returns(string memory, bytes32)
{
    return ("Finalized", bytes32(0));
}

function registerVerificationKey(bytes calldata)
external
pure
returns(bytes32)
{
    return bytes32(0);
}
}