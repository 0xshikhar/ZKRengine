const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function generateVerificationKey() {
    console.log('Generating verification key from compiled circuit...');
    
    // Path to the compiled circuit files
    const circuitPath = path.join(__dirname, 'randomness.circom');
    const outputPath = path.join(__dirname, 'output');
    
    // Check if circuit is compiled
    if (!fs.existsSync(outputPath)) {
        console.log('Circuit not compiled. Compiling first...');
        await compileCircuit();
    }
    
    // Read the verification key from the compiled output
    const verificationKeyPath = path.join(outputPath, 'randomness_verification_key.json');
    
    if (!fs.existsSync(verificationKeyPath)) {
        throw new Error('Verification key not found. Please compile the circuit first.');
    }
    
    const verificationKey = JSON.parse(fs.readFileSync(verificationKeyPath, 'utf8'));
    
    // Convert to the format expected by the verifier
    const formattedKey = formatVerificationKey(verificationKey);
    
    console.log('Verification key generated successfully');
    console.log('Key hash:', ethers.utils.keccak256(formattedKey));
    
    return {
        key: formattedKey,
        hash: ethers.utils.keccak256(formattedKey)
    };
}

function formatVerificationKey(verificationKey) {
    // Convert the verification key to the format expected by the verifier
    // This is a simplified version - you may need to adjust based on your specific circuit
    
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
    
    return ethers.utils.toUtf8Bytes(JSON.stringify(formatted));
}

async function compileCircuit() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
        console.log('Compiling circuit...');
        await execAsync('circom randomness.circom --r1cs --wasm --sym --c', { cwd: __dirname });
        console.log('Circuit compiled successfully');
    } catch (error) {
        console.error('Error compiling circuit:', error.message);
        throw error;
    }
}

async function registerVerificationKey() {
    try {
        const { key, hash } = await generateVerificationKey();
        
        // Get the verifier contract
        const Verifier = await ethers.getContractFactory('Verifier');
        const verifierAddress = process.env.VERIFIER_ADDRESS;
        
        if (!verifierAddress) {
            throw new Error('VERIFIER_ADDRESS environment variable not set');
        }
        
        const verifier = Verifier.attach(verifierAddress);
        
        console.log('Registering verification key with verifier contract...');
        const tx = await verifier.registerVerificationKey(key);
        await tx.wait();
        
        console.log('Verification key registered successfully');
        console.log('Transaction hash:', tx.hash);
        console.log('Key hash:', hash);
        
        return {
            keyHash: hash,
            transactionHash: tx.hash
        };
        
    } catch (error) {
        console.error('Error registering verification key:', error);
        throw error;
    }
}

async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'generate':
            await generateVerificationKey();
            break;
        case 'register':
            await registerVerificationKey();
            break;
        default:
            console.log('Usage:');
            console.log('  node generate-verification-key.js generate  # Generate verification key');
            console.log('  node generate-verification-key.js register   # Register key with verifier');
            break;
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    generateVerificationKey,
    registerVerificationKey
}; 