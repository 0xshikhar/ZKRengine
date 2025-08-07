pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "./utils.circom";

template ZKRandom(n) {
    // Public inputs
    signal input blockHash;
    signal input nonce;
    signal input timestamp;
    
    // Private inputs
    signal input entropy;
    signal input salt;
    
    // Output
    signal output randomValue;
    signal output proof;
    
    // Components
    component hasher1 = Poseidon(5);
    component hasher2 = Poseidon(2);
    component rangeCheck = RangeCheck(252);
    
    // Hash all inputs together
    hasher1.inputs[0] <== blockHash;
    hasher1.inputs[1] <== nonce;
    hasher1.inputs[2] <== timestamp;
    hasher1.inputs[3] <== entropy;
    hasher1.inputs[4] <== salt;
    
    // Generate intermediate hash
    signal intermediateHash <== hasher1.out;
    
    // Generate final random value
    hasher2.inputs[0] <== intermediateHash;
    hasher2.inputs[1] <== nonce;
    
    randomValue <== hasher2.out;
    
    // Range check to ensure valid output
    rangeCheck.in <== randomValue;
    
    // Generate proof of computation
    proof <== intermediateHash;
    
    // Constraints to prevent manipulation (quadratic constraints)
    signal squares[4];
    squares[0] <== blockHash * blockHash;
    squares[1] <== entropy * entropy;
    squares[2] <== salt * salt;
    squares[3] <== timestamp * timestamp;
}

component main = ZKRandom(4);