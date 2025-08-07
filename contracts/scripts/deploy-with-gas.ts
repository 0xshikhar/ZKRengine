import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with custom gas settings for account:", deployer.address);

    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    const currentGasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
    
    console.log("Current gas price:", ethers.formatUnits(currentGasPrice, "gwei"), "gwei");

    // Calculate different gas price options
    const gasPriceOptions = {
        normal: currentGasPrice,
        increased: currentGasPrice * 120n / 100n, // 20% increase
        high: currentGasPrice * 150n / 100n, // 50% increase
        urgent: currentGasPrice * 200n / 100n // 100% increase
    };

    console.log("\n=== Gas Price Options ===");
    console.log("Normal:", ethers.formatUnits(gasPriceOptions.normal, "gwei"), "gwei");
    console.log("Increased (20%):", ethers.formatUnits(gasPriceOptions.increased, "gwei"), "gwei");
    console.log("High (50%):", ethers.formatUnits(gasPriceOptions.high, "gwei"), "gwei");
    console.log("Urgent (100%):", ethers.formatUnits(gasPriceOptions.urgent, "gwei"), "gwei");

    // Use command line argument for gas price selection or default to increased
    const gasPriceArg = process.argv[2] || "increased";
    const selectedGasPrice = gasPriceOptions[gasPriceArg as keyof typeof gasPriceOptions] || gasPriceOptions.increased;
    
    console.log(`\nUsing gas price: ${ethers.formatUnits(selectedGasPrice, "gwei")} gwei (${gasPriceArg})`);

    // Step 1: Deploy Verifier contract
    console.log("\n=== Step 1: Deploying Verifier Contract ===");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(deployer.address, {
        gasPrice: selectedGasPrice
    });
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress);

    // Step 2: Register verification key
    console.log("\n=== Step 2: Registering Verification Key ===");
    const verificationKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // Placeholder
    
    const keyHashTx = await verifier.registerVerificationKey(verificationKey, {
        gasPrice: selectedGasPrice
    });
    const keyHashReceipt = await keyHashTx.wait();
    console.log("✅ Verification key registered with hash:", keyHashTx.hash);

    // Step 3: Configure verifier settings
    console.log("\n=== Step 3: Configuring Verifier Settings ===");
    
    const tx1 = await verifier.updateVerificationTimeout(3600, { gasPrice: selectedGasPrice });
    await tx1.wait();
    console.log("✅ Verification timeout updated");

    const tx2 = await verifier.updateMaxProofSize(1000, { gasPrice: selectedGasPrice });
    await tx2.wait();
    console.log("✅ Max proof size updated");

    const tx3 = await verifier.updateMinProofSize(10, { gasPrice: selectedGasPrice });
    await tx3.wait();
    console.log("✅ Min proof size updated");

    console.log("✅ Verifier configuration completed");

    // Step 4: Deploy ZKRandomOracle contract
    console.log("\n=== Step 4: Deploying ZKRandomOracle Contract ===");
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = await ZKRandomOracle.deploy(verifierAddress, keyHashTx.hash, deployer.address, {
        gasPrice: selectedGasPrice
    });
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ ZKRandomOracle deployed to:", oracleAddress);

    // Step 5: Configure oracle settings
    console.log("\n=== Step 5: Configuring Oracle Settings ===");
    
    const tx4 = await oracle.updateRequestFee(ethers.parseEther("0.001"), { gasPrice: selectedGasPrice });
    await tx4.wait();
    console.log("✅ Request fee updated");

    const tx5 = await oracle.updateMaxRequestsPerBlock(10, { gasPrice: selectedGasPrice });
    await tx5.wait();
    console.log("✅ Max requests per block updated");

    const tx6 = await oracle.updateRequestTimeout(3600, { gasPrice: selectedGasPrice });
    await tx6.wait();
    console.log("✅ Request timeout updated");

    const tx7 = await oracle.setRelayerAuthorization(deployer.address, true, { gasPrice: selectedGasPrice });
    await tx7.wait();
    console.log("✅ Relayer authorization set");

    console.log("✅ Oracle configuration completed");

    // Print deployment summary
    console.log("\n=== Deployment Summary ===");
    console.log("🔗 Verifier Contract:", verifierAddress);
    console.log("🔗 Oracle Contract:", oracleAddress);
    console.log("🔑 Verification Key Hash:", keyHashTx.hash);
    console.log("👤 Deployer:", deployer.address);
    console.log("⛽ Gas Price Used:", ethers.formatUnits(selectedGasPrice, "gwei"), "gwei");

    console.log("\n=== Environment Variables ===");
    console.log("export VERIFIER_ADDRESS=" + verifierAddress);
    console.log("export ORACLE_ADDRESS=" + oracleAddress);
    console.log("export VERIFICATION_KEY_HASH=" + keyHashTx.hash);
}

main()
    .then(() => {
        console.log("\n🎉 Deployment completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 