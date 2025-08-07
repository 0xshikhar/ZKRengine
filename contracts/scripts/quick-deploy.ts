import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Quick deployment for account:", deployer.address);

    // Get current gas price and use a high value to avoid underpriced errors
    const feeData = await ethers.provider.getFeeData();
    const baseGasPrice = feeData.gasPrice || ethers.parseUnits("30", "gwei");
    const highGasPrice = baseGasPrice * 150n / 100n; // 50% increase

    console.log("Using high gas price:", ethers.formatUnits(highGasPrice, "gwei"), "gwei");

    try {
        // Step 1: Deploy Verifier contract
        console.log("\n=== Step 1: Deploying Verifier Contract ===");
        const Verifier = await ethers.getContractFactory("Verifier");
        const verifier = await Verifier.deploy(deployer.address, {
            gasPrice: highGasPrice
        });
        await verifier.waitForDeployment();
        const verifierAddress = await verifier.getAddress();
        console.log("✅ Verifier deployed to:", verifierAddress);

        // Step 2: Register verification key
        console.log("\n=== Step 2: Registering Verification Key ===");
        const verificationKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        
        const keyHashTx = await verifier.registerVerificationKey(verificationKey, {
            gasPrice: highGasPrice
        });
        await keyHashTx.wait();
        console.log("✅ Verification key registered with hash:", keyHashTx.hash);

        // Step 3: Deploy Oracle contract
        console.log("\n=== Step 3: Deploying Oracle Contract ===");
        const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
        const oracle = await ZKRandomOracle.deploy(verifierAddress, keyHashTx.hash, deployer.address, {
            gasPrice: highGasPrice
        });
        await oracle.waitForDeployment();
        const oracleAddress = await oracle.getAddress();
        console.log("✅ Oracle deployed to:", oracleAddress);

        console.log("\n=== Deployment Summary ===");
        console.log("🔗 Verifier:", verifierAddress);
        console.log("🔗 Oracle:", oracleAddress);
        console.log("🔑 Key Hash:", keyHashTx.hash);
        console.log("⛽ Gas Price:", ethers.formatUnits(highGasPrice, "gwei"), "gwei");

        console.log("\n=== Environment Variables ===");
        console.log("export VERIFIER_ADDRESS=" + verifierAddress);
        console.log("export ORACLE_ADDRESS=" + oracleAddress);
        console.log("export VERIFICATION_KEY_HASH=" + keyHashTx.hash);

    } catch (error: any) {
        console.error("❌ Deployment failed:", error.message);
        
        if (error.message.includes("replacement transaction underpriced")) {
            console.log("\n💡 Solution: Try with even higher gas price");
            console.log("Run: npx hardhat run scripts/deploy-with-gas.ts urgent --network sepolia");
        } else if (error.message.includes("Too Many Requests")) {
            console.log("\n💡 Solution: Rate limited. Wait a few minutes and try again");
            console.log("Or use a different RPC endpoint");
        } else {
            console.log("\n💡 Check your account balance and network connection");
        }
        
        process.exit(1);
    }
}

main()
    .then(() => {
        console.log("\n🎉 Quick deployment completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Quick deployment failed:", error);
        process.exit(1);
    }); 