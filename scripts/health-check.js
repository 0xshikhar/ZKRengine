#!/usr/bin/env bun

// const chalk = require('chalk');
// const ora = require('ora');
const axios = require('axios');
const { execSync } = require('child_process');

class HealthCheck {
    constructor() {
        this.results = {
            infrastructure: {},
            services: {},
            dependencies: {},
            overall: 'unknown'
        };
    }

    async runFullHealthCheck() {
        console.log('🏥 ZKRandom Engine Health Check\n');

        try {
            await this.checkInfrastructure();
            await this.checkServices();
            await this.checkDependencies();
            
            this.calculateOverallHealth();
            this.displayResults();
            
        } catch (error) {
            console.error('\n❌ Health check failed:', error.message);
            process.exit(1);
        }
    }

    async checkInfrastructure() {
        console.log('🏗️  Infrastructure Health');
        
        // Check Docker containers
        await this.checkDocker();
        
        // Check database connections
        await this.checkDatabase();
        
        // Check Redis
        await this.checkRedis();
    }

    async checkServices() {
        console.log('\n🌐 Services Health');
        
        // Check API server
        await this.checkAPI();
        
        // Check Frontend
        await this.checkFrontend();
        
        // Check external services
        await this.checkExternalServices();
    }

    async checkDependencies() {
        console.log('\n📦 Dependencies Health');
        
        // Check Node.js version
        await this.checkNodeVersion();
        
        // Check global tools
        await this.checkGlobalTools();
        
        // Check workspace dependencies
        await this.checkWorkspaceDependencies();
    }

    async checkDocker() {
        const spinner = ora('Checking Docker containers...').start();
        
        try {
            const output = execSync('docker-compose ps --format json', { 
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            const containers = output.trim().split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
            
            const runningContainers = containers.filter(c => c.State === 'running');
            const totalContainers = containers.length;
            
            if (totalContainers === 0) {
                this.results.infrastructure.docker = {
                    status: 'warning',
                    message: 'No containers found (may not be started)'
                };
                spinner.warn('No Docker containers found');
            } else if (runningContainers.length === totalContainers) {
                this.results.infrastructure.docker = {
                    status: 'healthy',
                    message: `All ${totalContainers} containers running`
                };
                spinner.succeed(`Docker: ${runningContainers.length}/${totalContainers} containers running`);
            } else {
                this.results.infrastructure.docker = {
                    status: 'unhealthy',
                    message: `${runningContainers.length}/${totalContainers} containers running`
                };
                spinner.fail(`Docker: ${runningContainers.length}/${totalContainers} containers running`);
            }
            
        } catch (error) {
            this.results.infrastructure.docker = {
                status: 'error',
                message: 'Docker not available or not running'
            };
            spinner.fail('Docker not available');
        }
    }

    async checkDatabase() {
        const spinner = ora('Checking MongoDB connection...').start();
        
        try {
            // Try to connect to MongoDB
            const mongoose = require('mongoose');
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zkrandom';
            
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000
            });
            
            await mongoose.connection.db.admin().ping();
            await mongoose.disconnect();
            
            this.results.infrastructure.database = {
                status: 'healthy',
                message: 'MongoDB connection successful'
            };
            spinner.succeed('MongoDB connection successful');
            
        } catch (error) {
            this.results.infrastructure.database = {
                status: 'unhealthy',
                message: `MongoDB connection failed: ${error.message}`
            };
            spinner.fail('MongoDB connection failed');
        }
    }

    async checkRedis() {
        const spinner = ora('Checking Redis connection...').start();
        
        try {
            const redis = require('redis');
            const client = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                socket: { connectTimeout: 5000 }
            });
            
            await client.connect();
            await client.ping();
            await client.quit();
            
            this.results.infrastructure.redis = {
                status: 'healthy',
                message: 'Redis connection successful'
            };
            spinner.succeed('Redis connection successful');
            
        } catch (error) {
            this.results.infrastructure.redis = {
                status: 'unhealthy',
                message: `Redis connection failed: ${error.message}`
            };
            spinner.fail('Redis connection failed');
        }
    }

    async checkAPI() {
        const spinner = ora('Checking API server...').start();
        
        try {
            const apiUrl = process.env.API_URL || 'http://localhost:3000';
            const response = await axios.get(`${apiUrl}/health`, {
                timeout: 5000
            });
            
            if (response.status === 200) {
                this.results.services.api = {
                    status: 'healthy',
                    message: 'API server responding',
                    data: response.data
                };
                spinner.succeed('API server healthy');
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
            
        } catch (error) {
            this.results.services.api = {
                status: 'unhealthy',
                message: `API server not responding: ${error.message}`
            };
            spinner.fail('API server not responding');
        }
    }

    async checkFrontend() {
        const spinner = ora('Checking Frontend...').start();
        
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const response = await axios.get(frontendUrl, {
                timeout: 5000
            });
            
            if (response.status === 200) {
                this.results.services.frontend = {
                    status: 'healthy',
                    message: 'Frontend responding'
                };
                spinner.succeed('Frontend healthy');
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
            
        } catch (error) {
            this.results.services.frontend = {
                status: 'unhealthy',
                message: `Frontend not responding: ${error.message}`
            };
            spinner.fail('Frontend not responding');
        }
    }

    async checkExternalServices() {
        const spinner = ora('Checking external services...').start();
        
        const services = [
            { name: 'Base Sepolia RPC', url: 'https://sepolia.base.org' },
            { name: 'Base Mainnet RPC', url: 'https://mainnet.base.org' }
        ];
        
        const results = [];
        
        for (const service of services) {
            try {
                const response = await axios.post(service.url, {
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 1
                }, { timeout: 10000 });
                
                if (response.data.result) {
                    results.push({ name: service.name, status: 'healthy' });
                } else {
                    results.push({ name: service.name, status: 'unhealthy' });
                }
            } catch (error) {
                results.push({ name: service.name, status: 'error', error: error.message });
            }
        }
        
        const healthyServices = results.filter(r => r.status === 'healthy').length;
        
        this.results.services.external = {
            status: healthyServices === services.length ? 'healthy' : 'warning',
            message: `${healthyServices}/${services.length} external services healthy`,
            details: results
        };
        
        if (healthyServices === services.length) {
            spinner.succeed(`External services: ${healthyServices}/${services.length} healthy`);
        } else {
            spinner.warn(`External services: ${healthyServices}/${services.length} healthy`);
        }
    }

    async checkNodeVersion() {
        const spinner = ora('Checking Node.js version...').start();
        
        try {
            const version = process.version;
            const majorVersion = parseInt(version.slice(1).split('.')[0]);
            
            if (majorVersion >= 18) {
                this.results.dependencies.node = {
                    status: 'healthy',
                    message: `Node.js ${version} (✓)`
                };
                spinner.succeed(`Node.js ${version}`);
            } else {
                this.results.dependencies.node = {
                    status: 'unhealthy',
                    message: `Node.js ${version} (requires 18+)`
                };
                spinner.fail(`Node.js ${version} (requires 18+)`);
            }
            
        } catch (error) {
            this.results.dependencies.node = {
                status: 'error',
                message: 'Node.js version check failed'
            };
            spinner.fail('Node.js version check failed');
        }
    }

    async checkGlobalTools() {
        const spinner = ora('Checking global tools...').start();
        
        const tools = [
            { name: 'hardhat', command: 'bunx hardhat --version' },
            { name: 'circom', command: 'circom --version' },
            { name: 'snarkjs', command: 'bunx snarkjs --version' }
        ];
        
        const results = [];
        
        for (const tool of tools) {
            try {
                execSync(tool.command, { stdio: 'ignore' });
                results.push({ name: tool.name, status: 'available' });
            } catch (error) {
                results.push({ name: tool.name, status: 'missing' });
            }
        }
        
        const availableTools = results.filter(r => r.status === 'available').length;
        
        this.results.dependencies.globalTools = {
            status: availableTools === tools.length ? 'healthy' : 'warning',
            message: `${availableTools}/${tools.length} global tools available`,
            details: results
        };
        
        if (availableTools === tools.length) {
            spinner.succeed(`Global tools: ${availableTools}/${tools.length} available`);
        } else {
            spinner.warn(`Global tools: ${availableTools}/${tools.length} available`);
        }
    }

    async checkWorkspaceDependencies() {
        const spinner = ora('Checking workspace dependencies...').start();
        
        try {
            const workspaces = ['api', 'nextjs', 'circuits'];
            const results = [];
            
            for (const workspace of workspaces) {
                try {
                    const packageJsonPath = `${workspace}/package.json`;
                    if (require('fs').existsSync(packageJsonPath)) {
                        execSync(`bun install --cwd ${workspace}`, { stdio: 'ignore' });
                        results.push({ name: workspace, status: 'healthy' });
                    } else {
                        results.push({ name: workspace, status: 'missing' });
                    }
                } catch (error) {
                    results.push({ name: workspace, status: 'issues' });
                }
            }
            
            // Check contract folder separately
            try {
                const contractPackageJson = 'contract/package.json';
                if (require('fs').existsSync(contractPackageJson)) {
                    execSync('cd contract && bun install', { stdio: 'ignore' });
                    results.push({ name: 'contract (separate)', status: 'healthy' });
                } else {
                    results.push({ name: 'contract (separate)', status: 'missing' });
                }
            } catch (error) {
                results.push({ name: 'contract (separate)', status: 'issues' });
            }
            
            const healthyWorkspaces = results.filter(r => r.status === 'healthy').length;
            
            this.results.dependencies.workspaces = {
                status: healthyWorkspaces === results.length ? 'healthy' : 'warning',
                message: `${healthyWorkspaces}/${results.length} workspaces healthy`,
                details: results
            };
            
            if (healthyWorkspaces === results.length) {
                spinner.succeed(`Workspaces: ${healthyWorkspaces}/${results.length} healthy`);
            } else {
                spinner.warn(`Workspaces: ${healthyWorkspaces}/${results.length} healthy`);
            }
            
        } catch (error) {
            this.results.dependencies.workspaces = {
                status: 'error',
                message: 'Workspace dependency check failed'
            };
            spinner.fail('Workspace dependency check failed');
        }
    }

    calculateOverallHealth() {
        const allChecks = [
            ...Object.values(this.results.infrastructure),
            ...Object.values(this.results.services),
            ...Object.values(this.results.dependencies)
        ];
        
        const healthyCount = allChecks.filter(check => check.status === 'healthy').length;
        const unhealthyCount = allChecks.filter(check => check.status === 'unhealthy').length;
        const errorCount = allChecks.filter(check => check.status === 'error').length;
        
        if (errorCount > 0 || unhealthyCount > allChecks.length / 2) {
            this.results.overall = 'unhealthy';
        } else if (unhealthyCount > 0 || allChecks.some(check => check.status === 'warning')) {
            this.results.overall = 'warning';
        } else {
            this.results.overall = 'healthy';
        }
    }

    displayResults() {
        console.log('\n' + '='.repeat(50));
        console.log(chalk.blue.bold('📊 Health Check Results'));
        console.log('='.repeat(50));
        
        // Overall status
        const statusColor = this.results.overall === 'healthy' ? 'green' : 
                          this.results.overall === 'warning' ? 'yellow' : 'red';
        const statusIcon = this.results.overall === 'healthy' ? '✅' : 
                         this.results.overall === 'warning' ? '⚠️' : '❌';
        
        console.log(`\n${statusIcon} Overall Status: ${chalk[statusColor].bold(this.results.overall.toUpperCase())}`);
        
        // Recommendations
        console.log('\n📝 Recommendations:');
        
        if (this.results.infrastructure.docker?.status !== 'healthy') {
            console.log('  • Start Docker containers: bun run docker:up');
        }
        
        if (this.results.services.api?.status !== 'healthy') {
            console.log('  • Start API server: bun run api:dev');
        }
        
        if (this.results.services.frontend?.status !== 'healthy') {
            console.log('  • Start frontend: bun run dev');
        }
        
        if (this.results.dependencies.globalTools?.status !== 'healthy') {
            console.log('  • Install missing global tools (see documentation)');
        }
        
        console.log('\n🔗 Useful Commands:');
        console.log('  • Start all services: bun run docker:up');
        console.log('  • View logs: bun run docker:logs');
        console.log('  • Run tests: bun run test');
        console.log('  • Setup environment: bun run setup');
        console.log('  • Install contracts: bun run contract:install');
    }
}

// CLI execution
if (require.main === module) {
    require('dotenv').config();
    const healthCheck = new HealthCheck();
    healthCheck.runFullHealthCheck().catch(console.error);
}

module.exports = HealthCheck;