import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing deployed ZKRandom system with account:", deployer.address);

    // Contract addresses from Base Sepolia deployment
    const verifierAddress = "0xE5c0812bAD2B6B84194F657411aD65b4aa1FfD1D";
    const oracleAddress = "0xdc8e6209a45C257a1a36F229D2F732C3c277E696";
    const verificationKeyHash = "0xc5f279e96577b73d26f912c8be6b615b5eebb72cda6cd62f8beaaa8bf9a56ec3";

    console.log("\n=== Testing Deployed Contracts ===");

    // Test 1: Connect to Verifier contract
    console.log("\n--- Test 1: Verifier Contract ---");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = Verifier.attach(verifierAddress);
    
    try {
        const owner = await verifier.owner();
        console.log("✅ Verifier owner:", owner);
        
        const timeout = await verifier.verificationTimeout();
        console.log("✅ Verification timeout:", timeout.toString());
        
        const maxProofSize = await verifier.maxProofSize();
        console.log("✅ Max proof size:", maxProofSize.toString());
        
        const isKeyRegistered = await verifier.isKeyRegistered(verificationKeyHash);
        console.log("✅ Verification key registered:", isKeyRegistered);
        
    } catch (error) {
        console.log("❌ Verifier test failed:", error);
    }

    // Test 2: Connect to Oracle contract
    console.log("\n--- Test 2: Oracle Contract ---");
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = ZKRandomOracle.attach(oracleAddress);
    
    try {
        const zkVerify = await oracle.zkVerify();
        console.log("✅ ZKVerify address:", zkVerify);
        
        const requestFee = await oracle.getRequestFee();
        console.log("✅ Request fee:", ethers.formatEther(requestFee), "ETH");
        
        const maxRequestsPerBlock = await oracle.maxRequestsPerBlock();
        console.log("✅ Max requests per block:", maxRequestsPerBlock.toString());
        
        const requestTimeout = await oracle.requestTimeout();
        console.log("✅ Request timeout:", requestTimeout.toString());
        
        const isRelayer = await oracle.authorizedRelayers(deployer.address);
        console.log("✅ Deployer is relayer:", isRelayer);
        
    } catch (error) {
        console.log("❌ Oracle test failed:", error);
    }

    // Test 3: Test randomness request
    console.log("\n--- Test 3: Randomness Request Test ---");
    try {
        const seed = ethers.randomBytes(32);
        console.log("📝 Requesting randomness with seed:", ethers.hexlify(seed));
        
        const fee = ethers.parseEther("0.001");
        const tx = await oracle.requestRandomness(seed, { value: fee });
        console.log("✅ Randomness request submitted, tx hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
        
        // Get the request ID from events
        const event = receipt?.logs.find(log => {
            try {
                const parsed = oracle.interface.parseLog(log);
                return parsed?.name === "RandomnessRequested";
            } catch {
                return false;
            }
        });
        
        if (event) {
            const parsed = oracle.interface.parseLog(event);
            const requestId = parsed?.args[0];
            console.log("✅ Request ID:", requestId?.toString());
        }
        
    } catch (error) {
        console.log("❌ Randomness request test failed:", error);
    }

    // Test 4: Get statistics
    console.log("\n--- Test 4: System Statistics ---");
    try {
        const [totalRequests, fulfilledRequests, pendingRequests, currentFee] = await oracle.getStats();
        console.log("📊 Total requests:", totalRequests.toString());
        console.log("📊 Fulfilled requests:", fulfilledRequests.toString());
        console.log("📊 Pending requests:", pendingRequests.toString());
        console.log("📊 Current fee:", ethers.formatEther(currentFee), "ETH");
        
    } catch (error) {
        console.log("❌ Statistics test failed:", error);
    }

    console.log("\n🎉 System testing completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Testing failed:", error);
        process.exit(1);
    }); 