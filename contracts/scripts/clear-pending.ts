import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking account state for:", deployer.address);

    // Get current nonce
    const nonce = await deployer.getNonce();
    console.log("Current nonce:", nonce);

    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    console.log("Current gas price:", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");

    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Check if there are pending transactions
    console.log("\n=== Checking for pending transactions ===");
    
    try {
        // Try to get the latest transaction count
        const latestNonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
        const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
        
        console.log("Latest nonce:", latestNonce);
        console.log("Pending nonce:", pendingNonce);
        
        if (pendingNonce > latestNonce) {
            console.log("⚠️ There are pending transactions!");
            console.log("Pending transactions count:", pendingNonce - latestNonce);
            
            // Wait for a few blocks to see if transactions get mined
            console.log("Waiting for 3 blocks to see if pending transactions get mined...");
            const currentBlock = await ethers.provider.getBlockNumber();
            await ethers.provider.waitForTransaction(ethers.ZeroHash, 3);
            const newBlock = await ethers.provider.getBlockNumber();
            console.log(`Waited for ${newBlock - currentBlock} blocks`);
            
            // Check again
            const newLatestNonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
            const newPendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
            
            console.log("New latest nonce:", newLatestNonce);
            console.log("New pending nonce:", newPendingNonce);
            
            if (newPendingNonce > newLatestNonce) {
                console.log("⚠️ Still have pending transactions. Consider:");
                console.log("1. Wait longer for transactions to be mined");
                console.log("2. Use a higher gas price for new transactions");
                console.log("3. Check if transactions are stuck in mempool");
            } else {
                console.log("✅ Pending transactions have been mined!");
            }
        } else {
            console.log("✅ No pending transactions found");
        }
    } catch (error) {
        console.log("Error checking pending transactions:", error);
    }

    // Suggest gas price for new transactions
    console.log("\n=== Gas Price Recommendations ===");
    const baseGasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
    
    console.log("For normal transactions:", ethers.formatUnits(baseGasPrice, "gwei"), "gwei");
    console.log("For replacement transactions:", ethers.formatUnits(baseGasPrice * 120n / 100n, "gwei"), "gwei (20% increase)");
    console.log("For urgent transactions:", ethers.formatUnits(baseGasPrice * 150n / 100n, "gwei"), "gwei (50% increase)");

    // Check network status
    console.log("\n=== Network Status ===");
    const network = await ethers.provider.getNetwork();
    console.log("Chain ID:", network.chainId);
    console.log("Network name:", network.name);
    
    const latestBlock = await ethers.provider.getBlock("latest");
    if (latestBlock) {
        console.log("Latest block:", latestBlock.number);
        console.log("Block timestamp:", new Date(Number(latestBlock.timestamp) * 1000).toISOString());
    }
}

main()
    .then(() => {
        console.log("\n✅ Account check completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Account check failed:", error);
        process.exit(1);
    }); 