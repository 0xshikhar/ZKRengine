const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function setupVerificationKey() {
    console.log('Setting up verification key for ZKRandom system...');
    
    // Check if circuit is compiled
    const circuitOutputPath = path.join(__dirname, '../circuits/build');
    const verificationKeyPath = path.join(circuitOutputPath, 'verification_key.json');
    
    if (!fs.existsSync(verificationKeyPath)) {
        console.log('❌ Verification key not found. Please compile the circuit first:');
        console.log('cd circuits && ./compile-simple.sh');
        return;
    }
    
    // Read the verification key
    const verificationKey = JSON.parse(fs.readFileSync(verificationKeyPath, 'utf8'));
    console.log('✅ Verification key loaded from:', verificationKeyPath);
    
    // Format the key for the verifier
    const formattedKey = formatVerificationKey(verificationKey);
    const keyHash = ethers.utils.keccak256(formattedKey);
    
    console.log('🔑 Verification key hash:', keyHash);
    
    // Save the key hash for deployment
    const deploymentConfig = {
        verificationKeyHash: keyHash,
        verificationKey: verificationKey,
        formattedKey: formattedKey.toString('hex'),
        generatedAt: new Date().toISOString()
    };
    
    const configPath = path.join(__dirname, '../config/verification-key.json');
    fs.writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));
    console.log('✅ Verification key config saved to:', configPath);
    
    return {
        keyHash,
        formattedKey,
        configPath
    };
}

function formatVerificationKey(verificationKey) {
    // Convert the verification key to the format expected by the verifier
    const formatted = {
        protocol: verificationKey.protocol || 'groth16',
        curve: verificationKey.curve || 'bn128',
        nPublic: verificationKey.nPublic || 2,
        vk_alpha_1: verificationKey.vk_alpha_1,
        vk_beta_2: verificationKey.vk_beta_2,
        vk_gamma_2: verificationKey.vk_gamma_2,
        vk_delta_2: verificationKey.vk_delta_2,
        vk_alphabeta_12: verificationKey.vk_alphabeta_12,
        IC: verificationKey.IC
    };
    
    return Buffer.from(JSON.stringify(formatted), 'utf8');
}

async function registerVerificationKey() {
    try {
        const { keyHash, formattedKey } = await setupVerificationKey();
        
        // Get the verifier contract
        const Verifier = await ethers.getContractFactory('Verifier');
        const verifierAddress = process.env.VERIFIER_ADDRESS;
        
        if (!verifierAddress) {
            console.log('❌ VERIFIER_ADDRESS environment variable not set');
            console.log('Please deploy the verifier first or set the address');
            return;
        }
        
        const verifier = Verifier.attach(verifierAddress);
        
        console.log('📝 Registering verification key with verifier contract...');
        const tx = await verifier.registerVerificationKey(formattedKey);
        await tx.wait();
        
        console.log('✅ Verification key registered successfully');
        console.log('🔗 Transaction hash:', tx.hash);
        console.log('🔑 Key hash:', keyHash);
        
        return {
            keyHash,
            transactionHash: tx.hash
        };
        
    } catch (error) {
        console.error('❌ Error registering verification key:', error.message);
        throw error;
    }
}

async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            await setupVerificationKey();
            break;
        case 'register':
            await registerVerificationKey();
            break;
        default:
            console.log('Usage:');
            console.log('  node scripts/setup-verification-key.js setup    # Setup verification key');
            console.log('  node scripts/setup-verification-key.js register # Register key with verifier');
            break;
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Error:', error.message);
            process.exit(1);
        });
}

module.exports = {
    setupVerificationKey,
    registerVerificationKey
}; 