import { ethers } from "hardhat";
import { verify } from "../utils/verify";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying ZKRandom system with account:", deployer.address);

    // Step 1: Deploy Verifier contract
    console.log("\n=== Step 1: Deploying Verifier Contract ===");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(deployer.address);
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress);

    // Wait a bit before next transaction
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Register verification key
    console.log("\n=== Step 2: Registering Verification Key ===");
    const verificationKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const keyHashTx = await verifier.registerVerificationKey(verificationKey);
    await keyHashTx.wait();
    console.log("✅ Verification key registered with hash:", keyHashTx.hash);

    // Wait a bit before next transaction
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Deploy ZKRandomOracle contract
    console.log("\n=== Step 3: Deploying ZKRandomOracle Contract ===");
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = await ZKRandomOracle.deploy(verifierAddress, keyHashTx.hash, deployer.address);
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ ZKRandomOracle deployed to:", oracleAddress);

    // Wait a bit before next transaction
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

    // Step 5: Verify contracts on Etherscan
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("\n=== Step 5: Verifying Contracts on Etherscan ===");
        
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

    // Step 6: Print deployment summary
    console.log("\n=== Deployment Summary ===");
    console.log("🔗 Verifier Contract:", verifierAddress);
    console.log("🔗 Oracle Contract:", oracleAddress);
    console.log("🔑 Verification Key Hash:", keyHashTx.hash);
    console.log("👤 Deployer:", deployer.address);
    console.log("💰 Request Fee: 0.001 ETH");
    console.log("⏱️ Request Timeout: 1 hour");
    console.log("📊 Max Requests per Block: 10");

    console.log("\n=== Environment Variables ===");
    console.log("export VERIFIER_ADDRESS=" + verifierAddress);
    console.log("export ORACLE_ADDRESS=" + oracleAddress);
    console.log("export VERIFICATION_KEY_HASH=" + keyHashTx.hash);

    return {
        network: process.env.HARDHAT_NETWORK || "unknown",
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

main()
    .then((result) => {
        console.log("\n🎉 Deployment completed successfully!");
        console.log("Deployment info:", JSON.stringify(result, null, 2));
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 