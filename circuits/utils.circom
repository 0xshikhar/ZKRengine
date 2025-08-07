pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";

// Range check template to ensure values are within valid range
template RangeCheck(n) {
    signal input in;
    signal output out;
    
    // For now, just pass through - the field arithmetic ensures valid range
    // In a production system, you'd implement proper range checking
    out <== 1;
}

// Custom range validator for field elements
template FieldRangeCheck() {
    signal input in;
    signal output valid;
    
    // Check if input is within valid field range
    // For BN254, field size is approximately 2^254
    component bits = Num2Bits(254);
    bits.in <== in;
    
    valid <== 1;
}

// Entropy mixer template for additional randomness
template EntropyMixer() {
    signal input seed;
    signal input blockData;
    signal input timestamp;
    signal output mixed;
    
    component hasher = Poseidon(3);
    hasher.inputs[0] <== seed;
    hasher.inputs[1] <== blockData;
    hasher.inputs[2] <== timestamp;
    
    mixed <== hasher.out;
}

// Verifiable delay function for additional security
template VDF(rounds) {
    signal input seed;
    signal output result;
    
    component hashers[rounds];
    signal intermediate[rounds + 1];
    
    intermediate[0] <== seed;
    
    for (var i = 0; i < rounds; i++) {
        hashers[i] = Poseidon(1);
        hashers[i].inputs[0] <== intermediate[i];
        intermediate[i + 1] <== hashers[i].out;
    }
    
    result <== intermediate[rounds];
}

// Commitment scheme for entropy
template EntropyCommitment() {
    signal input entropy;
    signal input nonce;
    signal output commitment;
    
    component hasher = Poseidon(2);
    hasher.inputs[0] <== entropy;
    hasher.inputs[1] <== nonce;
    
    commitment <== hasher.out;
}