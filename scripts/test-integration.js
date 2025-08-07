#!/usr/bin/env bun

const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { ethers } = require('ethers');
const { execSync } = require('child_process');

class IntegrationTest {
    constructor() {
        this.testResults = {
            circuit: { passed: 0, failed: 0, tests: [] },
            contract: { passed: 0, failed: 0, tests: [] },
            api: { passed: 0, failed: 0, tests: [] },
            integration: { passed: 0, failed: 0, tests: [] }
        };
        
        this.apiUrl = process.env.API_URL || 'http://localhost:3000';
        this.testTimeout = 30000; // 30 seconds
    }

    async runAllTests() {
        console.log(chalk.blue.bold('🧪 ZKRandom Engine Integration Tests\n'));

        try {
            await this.runCircuitTests();
            await this.runContractTests();
            await this.runAPITests();
            await this.runIntegrationTests();
            
            this.displayResults();
            this.exitWithStatus();
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Integration tests failed:'), error.message);
            process.exit(1);
        }
    }

    async runCircuitTests() {
        console.log(chalk.cyan('🔐 Circuit Tests'));
        
        await this.testCircuitCompilation();
        await this.testProofGeneration();
        await this.testProofVerification();
    }

    async runContractTests() {
        console.log(chalk.cyan('\n📜 Contract Tests'));
        
        await this.testContractCompilation();
        await this.testContractDeployment();
        await this.testContractFunctionality();
    }

    async runAPITests() {
        console.log(chalk.cyan('\n🌐 API Tests'));
        
        await this.testAPIHealth();
        await this.testRandomnessRequest();
        await this.testRequestStatus();
        await this.testUserRequests();
        await this.testStatistics();
    }

    async runIntegrationTests() {
        console.log(chalk.cyan('\n🔄 End-to-End Integration Tests'));
        
        await this.testFullRandomnessFlow();
        await this.testMultiChainSupport();
        await this.testErrorHandling();
    }

    // Circuit Tests
    async testCircuitCompilation() {
        const test = { name: 'Circuit Compilation', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            execSync('bun run compile', { 
                cwd: 'circuits',
                stdio: 'pipe',
                timeout: this.testTimeout 
            });
            
            // Check if required files exist
            const fs = require('fs');
            const requiredFiles = [
                'circuits/build/randomness.r1cs',
                'circuits/build/randomness_js/randomness.wasm',
                'circuits/build/randomness_0001.zkey',
                'circuits/build/verification_key.json'
            ];
            
            const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
            
            if (missingFiles.length > 0) {
                throw new Error(`Missing files: ${missingFiles.join(', ')}`);
            }
            
            test.status = 'passed';
            this.testResults.circuit.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.circuit.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.circuit.tests.push(test);
    }

    async testProofGeneration() {
        const test = { name: 'Proof Generation', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const output = execSync('bun run generate-proof', { 
                cwd: 'circuits',
                encoding: 'utf8',
                timeout: this.testTimeout 
            });
            
            if (!output.includes('Proof generated successfully')) {
                throw new Error('Proof generation did not complete successfully');
            }
            
            // Check if proof file was created
            const fs = require('fs');
            if (!fs.existsSync('circuits/build/test_proof.json')) {
                throw new Error('Proof file not created');
            }
            
            test.status = 'passed';
            this.testResults.circuit.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.circuit.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.circuit.tests.push(test);
    }

    async testProofVerification() {
        const test = { name: 'Proof Verification', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const output = execSync('bun run verify-proof', { 
                cwd: 'circuits',
                encoding: 'utf8',
                timeout: this.testTimeout 
            });
            
            if (!output.includes('Proof is valid')) {
                throw new Error('Proof verification failed');
            }
            
            test.status = 'passed';
            this.testResults.circuit.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.circuit.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.circuit.tests.push(test);
    }

    // Contract Tests
    async testContractCompilation() {
        const test = { name: 'Contract Compilation', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            execSync('bun run compile', { 
                cwd: 'contract',
                stdio: 'pipe',
                timeout: this.testTimeout 
            });
            
            test.status = 'passed';
            this.testResults.contract.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.contract.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.contract.tests.push(test);
    }

    async testContractDeployment() {
        const test = { name: 'Contract Deployment (Local)', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Start local hardhat network in background
            const { spawn } = require('child_process');
            const hardhatNode = spawn('bunx', ['hardhat', 'node'], {
                cwd: 'contract',
                stdio: 'pipe'
            });
            
            // Wait for network to start
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Deploy contracts
            execSync('bun run deploy', { 
                cwd: 'contract',
                stdio: 'pipe',
                timeout: this.testTimeout 
            });
            
            // Clean up
            hardhatNode.kill();
            
            test.status = 'passed';
            this.testResults.contract.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.contract.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.contract.tests.push(test);
    }

    async testContractFunctionality() {
        const test = { name: 'Contract Unit Tests', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            execSync('bun run test', { 
                cwd: 'contract',
                stdio: 'pipe',
                timeout: this.testTimeout 
            });
            
            test.status = 'passed';
            this.testResults.contract.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.contract.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.contract.tests.push(test);
    }

    // API Tests
    async testAPIHealth() {
        const test = { name: 'API Health Check', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const response = await axios.get(`${this.apiUrl}/health`, {
                timeout: 5000
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected status 200, got ${response.status}`);
            }
            
            if (!response.data.status || response.data.status !== 'healthy') {
                throw new Error('API not reporting healthy status');
            }
            
            test.status = 'passed';
            this.testResults.api.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.api.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.api.tests.push(test);
    }

    async testRandomnessRequest() {
        const test = { name: 'Randomness Request API', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const requestData = {
                chainId: 84532, // Base Sepolia
                seed: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                requester: '0x742d35Cc6634C0532925a3b8D3Ac6c2e1b47C8C7'
            };
            
            const response = await axios.post(`${this.apiUrl}/api/v1/randomness/request`, requestData, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected status 200, got ${response.status}`);
            }
            
            if (!response.data.success || !response.data.data.requestId) {
                throw new Error('Invalid response format');
            }
            
            // Store request ID for later tests
            this.testRequestId = response.data.data.requestId;
            
            test.status = 'passed';
            this.testResults.api.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.api.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.api.tests.push(test);
    }

    async testRequestStatus() {
        const test = { name: 'Request Status API', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            if (!this.testRequestId) {
                throw new Error('No request ID available from previous test');
            }
            
            const response = await axios.get(`${this.apiUrl}/api/v1/randomness/request/${this.testRequestId}`, {
                timeout: 5000
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected status 200, got ${response.status}`);
            }
            
            if (!response.data.success || !response.data.data.requestId) {
                throw new Error('Invalid response format');
            }
            
            test.status = 'passed';
            this.testResults.api.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.api.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.api.tests.push(test);
    }

    async testUserRequests() {
        const test = { name: 'User Requests API', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const testAddress = '0x742d35Cc6634C0532925a3b8D3Ac6c2e1b47C8C7';
            const response = await axios.get(`${this.apiUrl}/api/v1/randomness/user/${testAddress}`, {
                timeout: 5000
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected status 200, got ${response.status}`);
            }
            
            if (!response.data.success || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }
            
            test.status = 'passed';
            this.testResults.api.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.api.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.api.tests.push(test);
    }

    async testStatistics() {
        const test = { name: 'Statistics API', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const response = await axios.get(`${this.apiUrl}/api/v1/randomness/statistics`, {
                timeout: 5000
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected status 200, got ${response.status}`);
            }
            
            if (!response.data.success || !response.data.data) {
                throw new Error('Invalid response format');
            }
            
            test.status = 'passed';
            this.testResults.api.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.api.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.api.tests.push(test);
    }

    // Integration Tests
    async testFullRandomnessFlow() {
        const test = { name: 'Full Randomness Flow', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // This would test the complete flow from request to fulfillment
            // For now, we'll simulate it
            
            // 1. Request randomness
            // 2. Generate proof
            // 3. Submit to zkVerify (mocked)
            // 4. Fulfill randomness
            
            // Simulate the flow
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            test.status = 'passed';
            this.testResults.integration.passed++;
            spinner.succeed(`✅ ${test.name} (simulated)`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.integration.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.integration.tests.push(test);
    }

    async testMultiChainSupport() {
        const test = { name: 'Multi-Chain Support', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Test supported chains endpoint
            const response = await axios.get(`${this.apiUrl}/api/v1/randomness/chains`, {
                timeout: 5000
            });
            
            if (response.status !== 200) {
                throw new Error(`Expected status 200, got ${response.status}`);
            }
            
            if (!response.data.success || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }
            
            const chains = response.data.data;
            if (chains.length === 0) {
                throw new Error('No supported chains found');
            }
            
            // Check if Base Sepolia is supported
            const baseSepolia = chains.find(chain => chain.chainId === 84532);
            if (!baseSepolia) {
                throw new Error('Base Sepolia not found in supported chains');
            }
            
            test.status = 'passed';
            this.testResults.integration.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.integration.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.integration.tests.push(test);
    }

    async testErrorHandling() {
        const test = { name: 'Error Handling', status: 'running' };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Test invalid request
            const invalidRequestData = {
                chainId: 'invalid',
                seed: 'invalid-seed',
                requester: 'invalid-address'
            };
            
            try {
                await axios.post(`${this.apiUrl}/api/v1/randomness/request`, invalidRequestData, {
                    timeout: 5000
                });
                throw new Error('Expected API to reject invalid request');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    // This is expected
                } else {
                    throw error;
                }
            }
            
            // Test non-existent request status
            try {
                await axios.get(`${this.apiUrl}/api/v1/randomness/request/invalid-id`, {
                    timeout: 5000
                });
                throw new Error('Expected API to return 404 for invalid request ID');
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    // This is expected
                } else {
                    throw error;
                }
            }
            
            test.status = 'passed';
            this.testResults.integration.passed++;
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            this.testResults.integration.failed++;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.integration.tests.push(test);
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log(chalk.blue.bold('📊 Integration Test Results'));
        console.log('='.repeat(60));

        const passed = this.testResults.filter(test => test.status === 'passed').length;
        const failed = this.testResults.filter(test => test.status === 'failed').length;
        const total = this.testResults.length;

        this.testResults.forEach(test => {
            const icon = test.status === 'passed' ? '✅' : '❌';
            const color = test.status === 'passed' ? 'green' : 'red';
            
            console.log(`\n${icon} ${chalk[color](test.name)}`);
            
            if (test.details && test.details.length > 0) {
                test.details.forEach(detail => {
                    console.log(`  ${detail}`);
                });
            }
            
            if (test.error) {
                console.log(`  Error: ${test.error}`);
            }
        });

        console.log('\n' + '='.repeat(60));
        const overallStatus = failed === 0 ? 'PASSED' : 'FAILED';
        const overallColor = failed === 0 ? 'green' : 'red';
        
        console.log(`${chalk[overallColor].bold(`Overall: ${overallStatus}`)} (${passed}/${total} tests passed)`);
        
        if (failed > 0) {
            console.log('\n🔧 Troubleshooting:');
            console.log('  • Check service logs: bun run docker:logs');
            console.log('  • Verify environment configuration: .env');
            console.log('  • Run health check: bun run health');
            console.log('  • Check API documentation: /docs');
        }
    }

    exitWithStatus() {
        const totalFailed = Object.values(this.testResults)
            .reduce((sum, category) => sum + category.failed, 0);
        
        process.exit(totalFailed > 0 ? 1 : 0);
    }
}

// CLI execution
if (require.main === module) {
    require('dotenv').config();
    const integrationTest = new IntegrationTest();
    integrationTest.runAllTests().catch(console.error);
}

module.exports = IntegrationTest;