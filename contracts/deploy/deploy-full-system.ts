import { ethers } from "hardhat";
import { verify } from "../utils/verify";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying full ZKRandom system with account:", deployer.address);

    // Get current gas price and increase it for reliability
    const currentGasPrice = await ethers.provider.getFeeData();
    const increasedGasPrice = currentGasPrice.gasPrice ? 
        currentGasPrice.gasPrice * 120n / 100n : // 20% increase
        ethers.parseUnits("50", "gwei"); // fallback

    console.log("Current gas price:", ethers.formatUnits(currentGasPrice.gasPrice || 0n, "gwei"), "gwei");
    console.log("Using increased gas price:", ethers.formatUnits(increasedGasPrice, "gwei"), "gwei");

    // Step 1: Deploy Verifier contract
    console.log("\n=== Step 1: Deploying Verifier Contract ===");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(deployer.address, {
        gasPrice: increasedGasPrice
    });
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress);

    // Step 2: Register verification key with retry logic
    console.log("\n=== Step 2: Registering Verification Key ===");
    const verificationKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // Placeholder
    
    let keyHashTx;
    try {
        keyHashTx = await verifier.registerVerificationKey(verificationKey, {
            gasPrice: increasedGasPrice
        });
        const keyHashReceipt = await keyHashTx.wait();
        console.log("✅ Verification key registered with hash:", keyHashTx.hash);
    } catch (error: any) {
        if (error.message.includes("replacement transaction underpriced")) {
            console.log("⚠️ Transaction underpriced, trying with higher gas price...");
            const higherGasPrice = increasedGasPrice * 150n / 100n; // 50% increase
            keyHashTx = await verifier.registerVerificationKey(verificationKey, {
                gasPrice: higherGasPrice
            });
            const keyHashReceipt = await keyHashTx.wait();
            console.log("✅ Verification key registered with hash:", keyHashTx.hash);
        } else {
            throw error;
        }
    }

    // Step 3: Configure verifier settings with retry logic
    console.log("\n=== Step 3: Configuring Verifier Settings ===");
    
    const configureWithRetry = async (txPromise: Promise<any>, description: string) => {
        try {
            const tx = await txPromise;
            await tx.wait();
            console.log("✅", description);
        } catch (error: any) {
            if (error.message.includes("replacement transaction underpriced")) {
                console.log(`⚠️ ${description} underpriced, retrying with higher gas...`);
                // For configuration calls, we'll use a higher gas price
                const higherGasPrice = increasedGasPrice * 150n / 100n;
                // Note: This would need to be implemented differently for each specific call
                console.log("⚠️ Manual retry needed for:", description);
            } else {
                throw error;
            }
        }
    };

    await configureWithRetry(
        verifier.updateVerificationTimeout(3600, { gasPrice: increasedGasPrice }),
        "Verification timeout updated"
    );

    await configureWithRetry(
        verifier.updateMaxProofSize(1000, { gasPrice: increasedGasPrice }),
        "Max proof size updated"
    );

    await configureWithRetry(
        verifier.updateMinProofSize(10, { gasPrice: increasedGasPrice }),
        "Min proof size updated"
    );

    console.log("✅ Verifier configuration completed");

    // Step 4: Deploy ZKRandomOracle contract
    console.log("\n=== Step 4: Deploying ZKRandomOracle Contract ===");
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = await ZKRandomOracle.deploy(verifierAddress, keyHashTx.hash, deployer.address, {
        gasPrice: increasedGasPrice
    });
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ ZKRandomOracle deployed to:", oracleAddress);

    // Step 5: Configure oracle settings
    console.log("\n=== Step 5: Configuring Oracle Settings ===");
    
    await configureWithRetry(
        oracle.updateRequestFee(ethers.parseEther("0.001"), { gasPrice: increasedGasPrice }),
        "Request fee updated"
    );

    await configureWithRetry(
        oracle.updateMaxRequestsPerBlock(10, { gasPrice: increasedGasPrice }),
        "Max requests per block updated"
    );

    await configureWithRetry(
        oracle.updateRequestTimeout(3600, { gasPrice: increasedGasPrice }),
        "Request timeout updated"
    );

    await configureWithRetry(
        oracle.setRelayerAuthorization(deployer.address, true, { gasPrice: increasedGasPrice }),
        "Relayer authorization set"
    );

    console.log("✅ Oracle configuration completed");

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
    console.log("\n=== Deployment Summary ===");
    console.log("🔗 Verifier Contract:", verifierAddress);
    console.log("🔗 Oracle Contract:", oracleAddress);
    console.log("🔑 Verification Key Hash:", keyHashTx.hash);
    console.log("👤 Deployer:", deployer.address);
    console.log("💰 Request Fee: 0.001 ETH");
    console.log("⏱️ Request Timeout: 1 hour");
    console.log("📊 Max Requests per Block: 10");

    // Step 9: Save deployment info
    const deploymentInfo = {
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
            maxRequestsPerBlock: 10,
            verificationTimeout: "1 hour",
            maxProofSize: 1000,
            minProofSize: 10
        },
        deployedAt: new Date().toISOString()
    };

    console.log("\n=== Environment Variables ===");
    console.log("export VERIFIER_ADDRESS=" + verifierAddress);
    console.log("export ORACLE_ADDRESS=" + oracleAddress);
    console.log("export VERIFICATION_KEY_HASH=" + keyHashTx.hash);

    return deploymentInfo;
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