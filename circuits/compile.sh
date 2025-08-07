#!/bin/bash

# ZKRandom Circuit Compilation Script
echo "🔧 Compiling ZKRandom circuits..."

# Create build directory
mkdir -p build

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile the circuit with node_modules library path (including parent directory)
echo "🔨 Compiling circuit..."
circom randomness.circom --r1cs --wasm --sym -o build -l node_modules -l ../node_modules

# Check if compilation was successful
if [ $? -ne 0 ]; then
    echo "❌ Circuit compilation failed"
    exit 1
fi

echo "✅ Circuit compiled successfully"

# Check if powersOfTau file exists, download if not
if [ ! -f "powersOfTau28_hez_final_16.ptau" ]; then
    echo "📥 Downloading powersOfTau file..."
    curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau -o powersOfTau28_hez_final_16.ptau
fi

# Start trusted setup
echo "🚀 Starting trusted setup (Groth16)..."

# Generate proving key
snarkjs groth16 setup build/randomness.r1cs powersOfTau28_hez_final_16.ptau build/randomness_0000.zkey
echo "✅ Proving key generated"

# Contribute to the ceremony
snarkjs zkey contribute build/randomness_0000.zkey build/randomness_0001.zkey --name="Contributor 1" -v
echo "✅ Contribution successful"

# Export verification key
snarkjs zkey export verificationkey build/randomness_0001.zkey build/verification_key.json
echo "✅ Verification key exported"

# Generate Solidity verifier
snarkjs zkey export solidityverifier build/randomness_0001.zkey ../contracts/Verifier.sol
echo "✅ Solidity verifier generated"

echo "🎉 Circuit setup completed successfully!"
echo "📁 Files generated in build/ directory:"
echo "  - randomness.r1cs"
echo "  - randomness.wasm"
echo "  - randomness_js/"
echo "  - randomness.sym"
echo "  - randomness_0001.zkey (proving key)"
echo "  - verification_key.json (verification key)"
echo "  - contracts/Verifier.sol (Solidity verifier)"
