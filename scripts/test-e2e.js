#!/usr/bin/env bun

const chalk = require('chalk');
const ora = require('ora');
const axios = require('axios');
const { execSync, spawn } = require('child_process');

class E2ETest {
    constructor() {
        this.processes = [];
        this.testResults = [];
        this.apiUrl = 'http://localhost:3000';
        this.frontendUrl = 'http://localhost:3001';
    }

    async runAllTests() {
        console.log(chalk.blue.bold('🎭 End-to-End Testing Suite\n'));

        try {
            await this.setupTestEnvironment();
            await this.startServices();
            await this.waitForServices();
            await this.runTestScenarios();
            
            this.displayResults();
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ E2E tests failed:'), error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async setupTestEnvironment() {
        const spinner = ora('Setting up test environment...').start();
        
        try {
            // Check if .env exists
            const fs = require('fs');
            if (!fs.existsSync('.env')) {
                throw new Error('.env file not found. Run: bun run setup:env');
            }

            // Load environment variables
            require('dotenv').config();

            // Verify required environment variables
            const requiredVars = [
                'MONGODB_URI',
                'REDIS_URL',
                'PRIVATE_KEY'
            ];

            const missingVars = requiredVars.filter(varName => !process.env[varName]);
            if (missingVars.length > 0) {
                throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
            }

            spinner.succeed('Test environment ready');
            
        } catch (error) {
            spinner.fail('Test environment setup failed');
            throw error;
        }
    }

    async startServices() {
        const spinner = ora('Starting services...').start();
        
        try {
            // Start infrastructure services
            execSync('docker-compose up -d mongodb redis', { 
                stdio: 'pipe',
                timeout: 30000 
            });

            // Wait for infrastructure to be ready
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Start API server
            const apiProcess = spawn('bun', ['run', 'api:dev'], {
                stdio: 'pipe',
                env: { ...process.env, PORT: '3000' }
            });
            this.processes.push(apiProcess);

            // Start frontend
            const frontendProcess = spawn('bun', ['run', 'dev'], {
                cwd: 'nextjs',
                stdio: 'pipe',
                env: { ...process.env, PORT: '3001' }
            });
            this.processes.push(frontendProcess);

            spinner.succeed('Services started');
            
        } catch (error) {
            spinner.fail('Failed to start services');
            throw error;
        }
    }

    async waitForServices() {
        const spinner = ora('Waiting for services to be ready...').start();
        
        try {
            // Wait for API
            await this.waitForService(this.apiUrl + '/health', 'API');
            
            // Wait for frontend
            await this.waitForService(this.frontendUrl, 'Frontend');

            spinner.succeed('All services ready');
            
        } catch (error) {
            spinner.fail('Services failed to start');
            throw error;
        }
    }

    async waitForService(url, serviceName, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await axios.get(url, { timeout: 5000 });
                if (response.status === 200) {
                    console.log(`  ✅ ${serviceName} ready`);
                    return;
                }
            } catch (error) {
                // Service not ready yet
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error(`${serviceName} failed to start after ${maxAttempts} attempts`);
    }

    async runTestScenarios() {
        console.log(chalk.cyan('\n🎬 Running E2E Test Scenarios\n'));

        const scenarios = [
            this.testHealthEndpoints,
            this.testRandomnessRequestFlow,
            this.testRequestStatusTracking,
            this.testUserRequestHistory,
            this.testChainSupport,
            this.testErrorHandling
        ];

        for (const scenario of scenarios) {
            await scenario.call(this);
        }
    }

    async testHealthEndpoints() {
        const test = { name: 'Health Endpoints', status: 'running', details: [] };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Test API health
            const apiResponse = await axios.get(`${this.apiUrl}/health`);
            if (apiResponse.status !== 200) {
                throw new Error('API health check failed');
            }
            test.details.push('API health: ✅');

            // Test API v1 health
            const apiV1Response = await axios.get(`${this.apiUrl}/api/v1/health`);
            if (apiV1Response.status !== 200) {
                throw new Error('API v1 health check failed');
            }
            test.details.push('API v1 health: ✅');

            // Test frontend accessibility
            const frontendResponse = await axios.get(this.frontendUrl);
            if (frontendResponse.status !== 200) {
                throw new Error('Frontend not accessible');
            }
            test.details.push('Frontend: ✅');

            test.status = 'passed';
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.push(test);
    }

    async testRandomnessRequestFlow() {
        const test = { name: 'Randomness Request Flow', status: 'running', details: [] };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Submit randomness request
            const requestData = {
                chainId: 84532, // Base Sepolia
                seed: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)), 
                    byte => byte.toString(16).padStart(2, '0')).join(''),
                requester: '0x742d35Cc6634C0532925a3b8D3Ac6c2e1b47C8C7'
            };

            const requestResponse = await axios.post(
                `${this.apiUrl}/api/v1/randomness/request`,
                requestData,
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (requestResponse.status !== 200 || !requestResponse.data.success) {
                throw new Error('Failed to submit randomness request');
            }

            const requestId = requestResponse.data.data.requestId;
            test.details.push(`Request submitted: ${requestId}`);

            // Wait a moment for processing to start
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check request status
            const statusResponse = await axios.get(
                `${this.apiUrl}/api/v1/randomness/request/${requestId}`
            );

            if (statusResponse.status !== 200 || !statusResponse.data.success) {
                throw new Error('Failed to get request status');
            }

            const status = statusResponse.data.data.status;
            test.details.push(`Status: ${status}`);

            if (!['pending', 'processing', 'fulfilled'].includes(status)) {
                throw new Error(`Unexpected status: ${status}`);
            }

            test.status = 'passed';
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.push(test);
    }

    async testRequestStatusTracking() {
        const test = { name: 'Request Status Tracking', status: 'running', details: [] };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Test with invalid request ID
            try {
                await axios.get(`${this.apiUrl}/api/v1/randomness/request/invalid-id`);
                throw new Error('Should have returned 404 for invalid request ID');
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    test.details.push('Invalid request ID handling: ✅');
                } else {
                    throw error;
                }
            }

            // Test request ID format validation
            try {
                await axios.get(`${this.apiUrl}/api/v1/randomness/request/req_123_abc`);
                // This might be 404 (not found) which is fine for this test
                test.details.push('Request ID format handling: ✅');
            } catch (error) {
                if (error.response && [404, 400].includes(error.response.status)) {
                    test.details.push('Request ID format handling: ✅');
                } else {
                    throw error;
                }
            }

            test.status = 'passed';
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.push(test);
    }

    async testUserRequestHistory() {
        const test = { name: 'User Request History', status: 'running', details: [] };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            const testAddress = '0x742d35Cc6634C0532925a3b8D3Ac6c2e1b47C8C7';
            
            // Get user requests
            const response = await axios.get(
                `${this.apiUrl}/api/v1/randomness/user/${testAddress}`
            );

            if (response.status !== 200 || !response.data.success) {
                throw new Error('Failed to get user requests');
            }

            if (!Array.isArray(response.data.data)) {
                throw new Error('User requests should return an array');
            }

            test.details.push(`Found ${response.data.data.length} requests`);

            // Test pagination
            const paginatedResponse = await axios.get(
                `${this.apiUrl}/api/v1/randomness/user/${testAddress}?page=1&limit=10`
            );

            if (paginatedResponse.status !== 200) {
                throw new Error('Pagination failed');
            }

            test.details.push('Pagination: ✅');

            // Test invalid address format
            try {
                await axios.get(`${this.apiUrl}/api/v1/randomness/user/invalid-address`);
                throw new Error('Should have returned 400 for invalid address');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    test.details.push('Address validation: ✅');
                } else {
                    throw error;
                }
            }

            test.status = 'passed';
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.push(test);
    }

    async testChainSupport() {
        const test = { name: 'Chain Support', status: 'running', details: [] };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Get supported chains
            const response = await axios.get(`${this.apiUrl}/api/v1/randomness/chains`);

            if (response.status !== 200 || !response.data.success) {
                throw new Error('Failed to get supported chains');
            }

            const chains = response.data.data;
            if (!Array.isArray(chains) || chains.length === 0) {
                throw new Error('No supported chains found');
            }

            test.details.push(`Found ${chains.length} supported chains`);

            // Check for Base Sepolia
            const baseSepolia = chains.find(chain => chain.chainId === 84532);
            if (!baseSepolia) {
                throw new Error('Base Sepolia not found in supported chains');
            }
            test.details.push('Base Sepolia: ✅');

            // Test individual chain info
            const chainResponse = await axios.get(`${this.apiUrl}/api/v1/randomness/chains/84532`);
            if (chainResponse.status !== 200) {
                throw new Error('Failed to get individual chain info');
            }
            test.details.push('Individual chain info: ✅');

            test.status = 'passed';
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.push(test);
    }

    async testErrorHandling() {
        const test = { name: 'Error Handling', status: 'running', details: [] };
        const spinner = ora(`Running: ${test.name}`).start();
        
        try {
            // Test invalid randomness request
            const invalidRequest = {
                chainId: 'invalid',
                seed: 'invalid-seed',
                requester: 'invalid-address'
            };

            try {
                await axios.post(
                    `${this.apiUrl}/api/v1/randomness/request`,
                    invalidRequest,
                    { headers: { 'Content-Type': 'application/json' } }
                );
                throw new Error('Should have rejected invalid request');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    test.details.push('Invalid request rejection: ✅');
                } else {
                    throw error;
                }
            }

            // Test missing required fields
            try {
                await axios.post(
                    `${this.apiUrl}/api/v1/randomness/request`,
                    {},
                    { headers: { 'Content-Type': 'application/json' } }
                );
                throw new Error('Should have rejected empty request');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    test.details.push('Empty request rejection: ✅');
                } else {
                    throw error;
                }
            }

            // Test non-existent endpoints
            try {
                await axios.get(`${this.apiUrl}/api/v1/nonexistent`);
                throw new Error('Should have returned 404 for non-existent endpoint');
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    test.details.push('404 handling: ✅');
                } else {
                    throw error;
                }
            }

            test.status = 'passed';
            spinner.succeed(`✅ ${test.name}`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            spinner.fail(`❌ ${test.name}: ${error.message}`);
        }
        
        this.testResults.push(test);
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log(chalk.blue.bold('📊 E2E Test Results'));
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

    async cleanup() {
        const spinner = ora('Cleaning up...').start();
        
        try {
            // Kill spawned processes
            this.processes.forEach(process => {
                if (process && !process.killed) {
                    process.kill('SIGTERM');
                }
            });

            // Stop Docker services
            try {
                execSync('docker-compose down', { stdio: 'pipe' });
            } catch (error) {
                // Ignore errors during cleanup
            }

            spinner.succeed('Cleanup completed');
            
        } catch (error) {
            spinner.fail('Cleanup failed');
            console.warn('Some cleanup operations failed:', error.message);
        }
    }
}

// CLI execution
if (require.main === module) {
    const e2eTest = new E2ETest();
    e2eTest.runAllTests().catch(console.error);
}

module.exports = E2ETest;