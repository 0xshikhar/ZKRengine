# Contract Deployment Troubleshooting Guide

## "Replacement Transaction Underpriced" Error

This error occurs when you try to send a transaction with the same nonce as a previous transaction, but with a lower gas price.

### Common Causes

1. **Pending Transactions**: A previous transaction with the same nonce is still pending in the mempool
2. **Insufficient Gas Price Increase**: When replacing a transaction, you need to increase the gas price by at least 10-20%
3. **Network Congestion**: High gas prices on the network causing delays

### Solutions

#### 1. Check Account State
```bash
npx hardhat run scripts/clear-pending.ts --network sepolia
```

This script will:
- Check your current nonce
- Detect pending transactions
- Show gas price recommendations
- Display network status

#### 2. Use Higher Gas Prices
```bash
# Deploy with increased gas price (20% increase)
npx hardhat run scripts/deploy-with-gas.ts --network sepolia

# Deploy with high gas price (50% increase)
npx hardhat run scripts/deploy-with-gas.ts high --network sepolia

# Deploy with urgent gas price (100% increase)
npx hardhat run scripts/deploy-with-gas.ts urgent --network sepolia
```

#### 3. Wait for Pending Transactions
If you have pending transactions:
1. Wait 5-10 minutes for them to be mined
2. Check the transaction status on a block explorer
3. If stuck, use higher gas prices for new transactions

#### 4. Manual Gas Price Management
You can manually set gas prices in your deployment script:

```typescript
const tx = await contract.someFunction(params, {
    gasPrice: ethers.parseUnits("50", "gwei") // Set specific gas price
});
```

### Gas Price Recommendations

| Network | Normal | Increased (20%) | High (50%) | Urgent (100%) |
|---------|--------|-----------------|------------|---------------|
| Sepolia | 20 gwei | 24 gwei | 30 gwei | 40 gwei |
| Base Sepolia | 15 gwei | 18 gwei | 22.5 gwei | 30 gwei |
| Mainnet | 30 gwei | 36 gwei | 45 gwei | 60 gwei |

### Environment Variables

Make sure your environment variables are set correctly:

```bash
# Required for deployment
PRIVATE_KEY=your_private_key_here
INFURA_PROJECT_ID=your_infura_project_id
ALCHEMY_API_KEY=your_alchemy_api_key

# Optional but recommended
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Network-Specific Issues

#### Sepolia Testnet
- Usually has lower gas prices
- Faster block times
- Good for testing

#### Base Sepolia
- Similar to Sepolia but on Base network
- Check RPC endpoint: `https://sepolia.base.org`

#### Mainnet
- Higher gas prices required
- More strict about transaction replacement
- Use higher gas prices for reliability

### Debugging Steps

1. **Check Account Balance**
   ```bash
   npx hardhat run scripts/clear-pending.ts --network sepolia
   ```

2. **Check Network Status**
   ```bash
   npx hardhat console --network sepolia
   > await ethers.provider.getFeeData()
   ```

3. **Check Pending Transactions**
   ```bash
   npx hardhat console --network sepolia
   > const [signer] = await ethers.getSigners()
   > await ethers.provider.getTransactionCount(signer.address, "pending")
   ```

4. **Force Higher Gas Price**
   ```bash
   npx hardhat run scripts/deploy-with-gas.ts urgent --network sepolia
   ```

### Prevention Tips

1. **Always check account state before deployment**
2. **Use gas price estimation**
3. **Wait for confirmations between transactions**
4. **Use retry logic for critical operations**
5. **Monitor network conditions**

### Emergency Recovery

If transactions are completely stuck:

1. **Wait for network congestion to clear**
2. **Use a different account with fresh nonce**
3. **Contact network support if necessary**
4. **Consider using a different network for testing**

### Scripts Available

- `scripts/clear-pending.ts` - Check account state and pending transactions
- `scripts/deploy-with-gas.ts` - Deploy with custom gas prices
- `deploy/deploy-full-system.ts` - Full deployment with retry logic

### Example Usage

```bash
# Check account state first
npx hardhat run scripts/clear-pending.ts --network sepolia

# If no pending transactions, deploy normally
npx hardhat run deploy/deploy-full-system.ts --network sepolia

# If there are issues, use higher gas price
npx hardhat run scripts/deploy-with-gas.ts urgent --network sepolia
``` 