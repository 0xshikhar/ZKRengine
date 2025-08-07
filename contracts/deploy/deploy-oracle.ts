import { ethers } from "hardhat";
import { verify } from "../utils/verify";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying ZKRandomOracle contract with account:", deployer.address);

    // Get verifier address from environment or use default
    const verifierAddress = process.env.VERIFIER_ADDRESS || "0x0000000000000000000000000000000000000000";
    const verificationKeyHash = process.env.VERIFICATION_KEY_HASH || "0x0000000000000000000000000000000000000000000000000000000000000000";
    
    if (verifierAddress === "0x0000000000000000000000000000000000000000") {
        console.log("Warning: Using default verifier address. Set VERIFIER_ADDRESS environment variable.");
    }

    // Deploy ZKRandomOracle contract
    const ZKRandomOracle = await ethers.getContractFactory("ZKRandomOracle");
    const oracle = await ZKRandomOracle.deploy(verifierAddress, verificationKeyHash, deployer.address);
    
    // Wait for deployment to complete
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    
    console.log("ZKRandomOracle deployed to:", oracleAddress);
    console.log("Verifier address:", verifierAddress);
    console.log("Verification key hash:", verificationKeyHash);

    // Configure initial settings
    await oracle.updateRequestFee(ethers.parseEther("0.001")); // 0.001 ETH
    await oracle.updateMaxRequestsPerBlock(10);
    await oracle.updateRequestTimeout(3600); // 1 hour

    // Set initial relayer (deployer)
    await oracle.setRelayerAuthorization(deployer.address, true);

    console.log("Oracle configuration completed");

    // Verify contract on Etherscan
    if (process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying contract on Etherscan...");
        await verify(oracleAddress, [verifierAddress, verificationKeyHash, deployer.address]);
    }

    return {
        oracle: oracleAddress,
        verifier: verifierAddress,
        verificationKeyHash: verificationKeyHash
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