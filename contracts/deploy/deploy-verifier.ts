import { ethers } from "hardhat";
import { verify } from "../utils/verify";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying Verifier contract with account:", deployer.address);

    // Deploy Verifier contract
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(deployer.address);
    
    // Wait for deployment to complete
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    
    console.log("Verifier deployed to:", verifierAddress);

    // Register verification key for randomness circuit
    // This would be the actual verification key from your compiled circuit
    const verificationKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // Placeholder
    const keyHash = await verifier.registerVerificationKey(verificationKey);
    console.log("Verification key registered with hash:", keyHash);

    // Configure initial settings
    await verifier.updateVerificationTimeout(3600); // 1 hour
    await verifier.updateMaxProofSize(1000);
    await verifier.updateMinProofSize(10);

    console.log("Verifier configuration completed");

    // Verify contract on Etherscan
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying contract on Etherscan...");
        await verify(verifierAddress, [deployer.address]);
    }

    return {
        verifier: verifierAddress,
        verificationKeyHash: keyHash
    };
}

main()
    .then((result) => {
        console.log("Deployment result:", result);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 