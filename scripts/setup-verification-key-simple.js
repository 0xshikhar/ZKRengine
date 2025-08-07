const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
    const keyHash = '0x' + crypto.createHash('sha256').update(formattedKey).digest('hex');
    
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
    
    // Create environment variables file
    const envPath = path.join(__dirname, '../.env.verification');
    const envContent = `VERIFICATION_KEY_HASH=${keyHash}
VERIFICATION_KEY_PATH=${verificationKeyPath}
CIRCUIT_BUILD_PATH=${circuitOutputPath}`;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Environment variables saved to:', envPath);
    
    return {
        keyHash,
        formattedKey,
        configPath,
        envPath
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

async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            await setupVerificationKey();
            break;
        default:
            console.log('Usage:');
            console.log('  node scripts/setup-verification-key-simple.js setup    # Setup verification key');
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
    setupVerificationKey
}; 