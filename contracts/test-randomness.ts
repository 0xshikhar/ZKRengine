import { ethers } from "hardhat";

async function testRandomnessGeneration() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing random number generation with account:", deployer.address);

    // Contract addresses (you'll need to update these after deployment)
    const oracleAddress = "0xdc8e6209a45C257a1a36F229D2F732C3c277E696"; // Update with your deployed address
    
    console.log("\n=== Testing Random Number Generation ===");

    // Connect to Oracle contract
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = ZKRandomOracle.attach(oracleAddress);

    // Test multiple randomness requests
    const testResults = [];
    
    for (let i = 1; i <= 5; i++) {
        try {
            console.log(`\n--- Test ${i}: Randomness Request ---`);
            
            // Generate random seed
            const seed = ethers.randomBytes(32);
            console.log(`📝 Seed: ${ethers.hexlify(seed)}`);
            
            // Request randomness
            const fee = ethers.parseEther("0.001");
            const tx = await oracle.requestRandomness(seed, { value: fee });
            console.log(`✅ Transaction submitted: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Confirmed in block: ${receipt?.blockNumber}`);
            
            // Extract request ID from events
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
                console.log(`✅ Request ID: ${requestId?.toString()}`);
                
                // Get request details
                const request = await oracle.getRequest(requestId);
                console.log(`📊 Request Details:`);
                console.log(`   - Requester: ${request.requester}`);
                console.log(`   - Seed: ${request.seed}`);
                console.log(`   - Timestamp: ${request.timestamp}`);
                console.log(`   - Fulfilled: ${request.fulfilled}`);
                console.log(`   - Random Value: ${request.randomValue}`);
                
                // Check if randomness is available
                const [randomValue, fulfilled] = await oracle.getRandomness(requestId);
                console.log(`🎲 Random Value: ${randomValue.toString()}`);
                console.log(`✅ Fulfilled: ${fulfilled}`);
                
                testResults.push({
                    testId: i,
                    requestId: requestId.toString(),
                    seed: ethers.hexlify(seed),
                    randomValue: randomValue.toString(),
                    fulfilled: fulfilled,
                    blockNumber: receipt?.blockNumber
                });
                
            } else {
                console.log(`❌ Could not find RandomnessRequested event`);
            }
            
            // Wait between requests
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.log(`❌ Test ${i} failed:`, error);
            testResults.push({
                testId: i,
                error: error.message
            });
        }
    }

    // Print summary
    console.log("\n=== Test Summary ===");
    console.log(`Total tests: ${testResults.length}`);
    
    const successfulTests = testResults.filter(r => !r.error);
    console.log(`Successful tests: ${successfulTests.length}`);
    
    if (successfulTests.length > 0) {
        console.log("\n📊 Random Number Analysis:");
        successfulTests.forEach(test => {
            console.log(`Test ${test.testId}:`);
            console.log(`  - Request ID: ${test.requestId}`);
            console.log(`  - Seed: ${test.seed}`);
            console.log(`  - Random Value: ${test.randomValue}`);
            console.log(`  - Fulfilled: ${test.fulfilled}`);
            console.log(`  - Block: ${test.blockNumber}`);
            
            // Analyze the random value
            const randomNum = BigInt(test.randomValue);
            console.log(`  - Value in decimal: ${randomNum.toString()}`);
            console.log(`  - Value in hex: 0x${randomNum.toString(16)}`);
            console.log(`  - Bit length: ${randomNum.toString(2).length}`);
        });
    }

    // Get system statistics
    console.log("\n=== System Statistics ===");
    try {
        const [totalRequests, fulfilledRequests, pendingRequests, currentFee] = await oracle.getStats();
        console.log("📊 Total requests:", totalRequests.toString());
        console.log("📊 Fulfilled requests:", fulfilledRequests.toString());
        console.log("📊 Pending requests:", pendingRequests.toString());
        console.log("📊 Current fee:", ethers.formatEther(currentFee), "ETH");
        
    } catch (error) {
        console.log("❌ Statistics failed:", error);
    }

    console.log("\n🎉 Random number generation testing completed!");
    return testResults;
}

main()
    .then((results) => {
        console.log("\nTest results:", JSON.stringify(results, null, 2));
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Testing failed:", error);
        process.exit(1);
    });

async function main() {
    return await testRandomnessGeneration();
} 