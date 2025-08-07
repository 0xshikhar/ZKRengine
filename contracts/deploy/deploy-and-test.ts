import { ethers } from "hardhat";
import { verify } from "../utils/verify";

async function deployToNetwork(networkName: string) {
    console.log(`\n🚀 Deploying to ${networkName.toUpperCase()}...`);
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Step 1: Deploy Verifier contract
    console.log("\n=== Step 1: Deploying Verifier Contract ===");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(deployer.address);
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress);

    // Wait between transactions
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Register verification key
    console.log("\n=== Step 2: Registering Verification Key ===");
    const verificationKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const keyHashTx = await verifier.registerVerificationKey(verificationKey);
    await keyHashTx.wait();
    console.log("✅ Verification key registered with hash:", keyHashTx.hash);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Deploy ZKRandomOracle contract
    console.log("\n=== Step 3: Deploying ZKRandomOracle Contract ===");
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = await ZKRandomOracle.deploy(verifierAddress, keyHashTx.hash, deployer.address);
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ ZKRandomOracle deployed to:", oracleAddress);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Configure oracle settings
    console.log("\n=== Step 4: Configuring Oracle Settings ===");
    const tx1 = await oracle.updateRequestFee(ethers.parseEther("0.001"));
    await tx1.wait();
    console.log("✅ Request fee updated");

    await new Promise(resolve => setTimeout(resolve, 1000));

    const tx2 = await oracle.updateMaxRequestsPerBlock(10);
    await tx2.wait();
    console.log("✅ Max requests per block updated");

    await new Promise(resolve => setTimeout(resolve, 1000));

    const tx3 = await oracle.updateRequestTimeout(3600);
    await tx3.wait();
    console.log("✅ Request timeout updated");

    await new Promise(resolve => setTimeout(resolve, 1000));

    const tx4 = await oracle.setRelayerAuthorization(deployer.address, true);
    await tx4.wait();
    console.log("✅ Relayer authorization set");

    console.log("✅ Oracle configuration completed");

    // Step 5: Test random number generation
    console.log("\n=== Step 5: Testing Random Number Generation ===");
    
    // Test multiple randomness requests
    for (let i = 1; i <= 3; i++) {
        try {
            const seed = ethers.randomBytes(32);
            console.log(`\n📝 Request ${i}: Requesting randomness with seed:`, ethers.hexlify(seed));
            
            const fee = ethers.parseEther("0.001");
            const tx = await oracle.requestRandomness(seed, { value: fee });
            console.log(`✅ Request ${i} submitted, tx hash:`, tx.hash);
            
            const receipt = await tx.wait();
            console.log(`✅ Request ${i} confirmed in block:`, receipt?.blockNumber);
            
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
                console.log(`✅ Request ${i} ID:`, requestId?.toString());
                
                // Check request details
                const request = await oracle.getRequest(requestId);
                console.log(`📊 Request ${i} details:`);
                console.log(`   - Requester: ${request.requester}`);
                console.log(`   - Seed: ${request.seed}`);
                console.log(`   - Timestamp: ${request.timestamp}`);
                console.log(`   - Fulfilled: ${request.fulfilled}`);
                console.log(`   - Random Value: ${request.randomValue}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log(`❌ Request ${i} failed:`, error);
        }
    }

    // Step 6: Get final statistics
    console.log("\n=== Step 6: Final System Statistics ===");
    try {
        const [totalRequests, fulfilledRequests, pendingRequests, currentFee] = await oracle.getStats();
        console.log("📊 Total requests:", totalRequests.toString());
        console.log("📊 Fulfilled requests:", fulfilledRequests.toString());
        console.log("📊 Pending requests:", pendingRequests.toString());
        console.log("📊 Current fee:", ethers.formatEther(currentFee), "ETH");
        
    } catch (error) {
        console.log("❌ Statistics failed:", error);
    }

    // Step 7: Verify contracts on Etherscan
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("\n=== Step 7: Verifying Contracts on Etherscan ===");
        
        try {
            await verify(verifierAddress, [deployer.address]);
            console.log("✅ Verifier contract verified");
        } catch (error) {
            console.log("⚠️ Verifier verification failed:", error);
        }

        try {
            await verify(oracleAddress, [verifierAddress, keyHashTx.hash, deployer.address]);
            console.log("✅ Oracle contract verified");
        } catch (error) {
            console.log("⚠️ Oracle verification failed:", error);
        }
    }

    // Step 8: Print deployment summary
    console.log(`\n=== ${networkName.toUpperCase()} Deployment Summary ===`);
    console.log("🔗 Verifier Contract:", verifierAddress);
    console.log("🔗 Oracle Contract:", oracleAddress);
    console.log("🔑 Verification Key Hash:", keyHashTx.hash);
    console.log("👤 Deployer:", deployer.address);
    console.log("💰 Request Fee: 0.001 ETH");
    console.log("⏱️ Request Timeout: 1 hour");
    console.log("📊 Max Requests per Block: 10");

    console.log(`\n=== ${networkName.toUpperCase()} Environment Variables ===`);
    console.log(`export ${networkName.toUpperCase()}_VERIFIER_ADDRESS=${verifierAddress}`);
    console.log(`export ${networkName.toUpperCase()}_ORACLE_ADDRESS=${oracleAddress}`);
    console.log(`export ${networkName.toUpperCase()}_VERIFICATION_KEY_HASH=${keyHashTx.hash}`);

    return {
        network: networkName,
        deployer: deployer.address,
        contracts: {
            verifier: verifierAddress,
            oracle: oracleAddress
        },
        configuration: {
            verificationKeyHash: keyHashTx.hash,
            requestFee: "0.001 ETH",
            requestTimeout: "1 hour",
            maxRequestsPerBlock: 10
        },
        deployedAt: new Date().toISOString()
    };
}

async function main() {
    const networks = ["base-sepolia", "sepolia"];
    const results = [];

    for (const network of networks) {
        try {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`DEPLOYING TO ${network.toUpperCase()}`);
            console.log(`${'='.repeat(50)}`);
            
            const result = await deployToNetwork(network);
            results.push(result);
            
            console.log(`\n✅ ${network.toUpperCase()} deployment completed successfully!`);
            
        } catch (error) {
            console.log(`\n❌ ${network.toUpperCase()} deployment failed:`, error);
        }
    }

    console.log("\n🎉 All deployments completed!");
    console.log("Deployment results:", JSON.stringify(results, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 