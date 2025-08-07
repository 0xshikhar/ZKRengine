#!/usr/bin/env node

/**
 * Test Script for ZKRandom System
 * Tests the complete randomness generation flow
 */

require('dotenv').config();
const { ethers } = require('ethers');

async function testSystem() {
    console.log('🧪 Testing ZKRandom System...\n');

    try {
        // Test 1: Circuit Proof Generation
        console.log('=== Test 1: Circuit Proof Generation ===');
        
        const { execSync } = require('child_process');
        const proofResult = execSync('cd circuits && node generate-proof.js', { 
            encoding: 'utf8',
            timeout: 30000 
        });
        
        console.log('✅ Circuit proof generation working');
        console.log('📊 Random value generated successfully\n');

        // Test 2: API Services
        console.log('=== Test 2: API Services ===');
        
        const proofService = require('./api/src/services/proof.service');
        const chainService = require('./api/src/services/chain.service');
        const entropyService = require('./api/src/services/entropy.service');
        
        // Wait for services to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test proof service
        const testResult = await proofService.testProofGeneration();
        if (testResult.success) {
            console.log('✅ Proof service working');
            console.log(`📊 Generated random value: ${testResult.randomValue}`);
        } else {
            console.log('❌ Proof service failed:', testResult.error);
        }
        
        // Test entropy service
        const entropy = await entropyService.generateEntropy('0x1234', 84532);
        console.log('✅ Entropy service working');
        console.log(`📊 Entropy hash: ${entropy.hash.substring(0, 16)}...`);
        
        // Test chain service
        const chains = chainService.getSupportedChains();
        console.log('✅ Chain service working');
        console.log(`📊 Supported chains: ${chains.map(c => c.name).join(', ')}\n`);

        // Test 3: Contract Interaction
        console.log('=== Test 3: Contract Interaction ===');
        
        const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
        const oracleAddress = '0x09dDF8f56981deC60e468e2B85194102a3e2E124';
        
        const oracleABI = [
            'function getStats() external view returns (uint256 totalRequests, uint256 fulfilledRequests, uint256 pendingRequests, uint256 currentFee)'
        ];
        
        const oracle = new ethers.Contract(oracleAddress, oracleABI, provider);
        const stats = await oracle.getStats();
        
        console.log('✅ Contract interaction working');
        console.log(`📊 Total requests: ${stats[0].toString()}`);
        console.log(`📊 Fulfilled requests: ${stats[1].toString()}`);
        console.log(`📊 Pending requests: ${stats[2].toString()}`);
        console.log(`📊 Current fee: ${ethers.formatEther(stats[3])} ETH\n`);

        // Test 4: Environment Configuration
        console.log('=== Test 4: Environment Configuration ===');
        
        const requiredVars = [
            'PRIVATE_KEY',
            'VERIFICATION_KEY_HASH',
            'BASE_SEPOLIA_ORACLE_ADDRESS',
            'SEPOLIA_ORACLE_ADDRESS'
        ];
        
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length === 0) {
            console.log('✅ Environment configuration complete');
            console.log(`📊 Verification key: ${process.env.VERIFICATION_KEY_HASH?.substring(0, 16)}...`);
        } else {
            console.log('❌ Missing environment variables:', missingVars.join(', '));
        }

        console.log('\n🎉 System Test Completed!');
        console.log('\n📋 Next Steps:');
        console.log('1. Update .env file with your actual values');
        console.log('2. Start MongoDB: mongod');
        console.log('3. Start the relayer: cd api && node src/relayer.js');
        console.log('4. Start the API: cd api && npm start');
        console.log('5. Start the frontend: cd nextjs && npm run dev');
        console.log('6. Test randomness requests through the UI or API');

    } catch (error) {
        console.error('❌ System test failed:', error.message);
        
        if (error.message.includes('Circuit')) {
            console.log('\n💡 Tip: Make sure circuits are compiled properly');
            console.log('Run: cd circuits && ./compile.sh');
        }
        
        if (error.message.includes('MongoDB')) {
            console.log('\n💡 Tip: Make sure MongoDB is running');
            console.log('Run: mongod or brew services start mongodb-community');
        }
        
        process.exit(1);
    }
}

// Run the test
testSystem().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});