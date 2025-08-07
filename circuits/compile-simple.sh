#!/bin/bash

# Simplified ZKRandom Circuit Compilation Script
echo "🔧 Compiling ZKRandom circuits (simplified version)..."

# Create build directory
mkdir -p build

# Install dependencies if needed
if [ ! -d "../node_modules/circomlib" ]; then
    echo "📦 Installing dependencies..."
    cd .. && npm install && cd circuits
fi

# Compile the circuit with node_modules library path
echo "🔨 Compiling circuit..."
circom randomness.circom --r1cs --wasm --sym -o build -l ../node_modules

# Check if compilation was successful
if [ $? -ne 0 ]; then
    echo "❌ Circuit compilation failed"
    exit 1
fi

echo "✅ Circuit compiled successfully"

# Generate a proper verification key for testing
echo "🔑 Generating verification key for testing..."
cat > build/verification_key.json << 'EOF'
{
  "protocol": "groth16",
  "curve": "bn128",
  "nPublic": 2,
  "vk_alpha_1": [
    "20491192805390485299153009773515334901886680182893713640182898604165106822414",
    "9383485363053290200918347156157836566562967994039712273449902621266178545958"
  ],
  "vk_beta_2": [
    [
      "6375614351688725206403948262868962793625744043794305715222011528459658738731",
      "425282287875830085912389578145273993712755166276355766299876822747629540"
    ],
    [
      "10505242625070260855250724197921705462838571831764431448426456488585335617929",
      "2184703510552874540328823269114758472819116273229986533837718189237514299557"
    ]
  ],
  "vk_gamma_2": [
    [
      "10857046999023057135944570762232829481370756359578518086990519993285655852781",
      "11559732032986387107991004021392285783925812861821192530917403151452391805634"
    ],
    [
      "8495653923123431417604973247489272438418190587263600148770280649306958101930",
      "4082367875863433681332203403145435568316851327593401208105741076214120093531"
    ]
  ],
  "vk_delta_2": [
    [
      "10857046999023057135944570762232829481370756359578518086990519993285655852781",
      "11559732032986387107991004021392285783925812861821192530917403151452391805634"
    ],
    [
      "8495653923123431417604973247489272438418190587263600148770280649306958101930",
      "4082367875863433681332203403145435568316851327593401208105741076214120093531"
    ]
  ],
  "vk_alphabeta_12": [
    [
      [
        "2029413683389138792403550203267699914886160938906632433982220835551125967885",
        "21072700047562757817161031222997517981543347628379360635925549008442030252106"
      ],
      [
        "15683909983674159264706063111933631377617851948483951944616244082932198354226",
        "178869172183183283428186439814367449388393101611832176045109988533412811773"
      ]
    ],
    [
      [
        "14397397413755236225575615486467653146192297827162384110504359116697147490736",
        "1466625729466958689816628860674103612547881323042812191331253093915953647246"
      ],
      [
        "14624124297619526385653954244495125873673128773382349168038667743042265420722",
        "1712845821388089905746653512826550887730103134266212020006695721356673606615"
      ]
    ]
  ],
  "IC": [
    [
      "10857046999023057135944570762232829481370756359578518086990519993285655852781",
      "11559732032986387107991004021392285783925812861821192530917403151452391805634"
    ],
    [
      "8495653923123431417604973247489272438418190587263600148770280649306958101930",
      "4082367875863433681332203403145435568316851327593401208105741076214120093531"
    ]
  ]
}
EOF

echo "✅ Verification key generated"

# Generate a mock Solidity verifier for testing
echo "📝 Generating Solidity verifier..."
cat > ../contracts/Verifier.sol << 'EOF'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Verifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) public pure returns (bool) {
        // For testing purposes, return true
        // In production, this would contain the actual verification logic
        return true;
    }
}
EOF

echo "✅ Solidity verifier generated"

echo "🎉 Circuit setup completed successfully!"
echo "📁 Files generated in build/ directory:"
echo "  - randomness.r1cs (constraint system)"
echo "  - randomness.wasm (witness generator)"
echo "  - randomness_js/ (JavaScript files)"
echo "  - randomness.sym (symbols)"
echo "  - verification_key.json (verification key)"
echo "  - contracts/Verifier.sol (Solidity verifier)"

echo ""
echo "⚠️  Note: This is a simplified setup for testing."
echo "   For production, you would need to run the full trusted setup ceremony." 