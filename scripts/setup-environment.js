#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

class EnvironmentSetup {
    constructor() {
        this.rootDir = process.cwd();
        this.envFile = path.join(this.rootDir, '.env');
        this.envExample = path.join(this.rootDir, 'env.example');
    }

    async setup() {
        console.log('\n🚀 ZKRandom Engine Environment Setup\n');

        try {
            await this.checkPrerequisites();
            await this.setupEnvironmentFile();
            await this.verifyProjectStructure();
            await this.checkDependencies();
            
            console.log('\n✅ Environment setup completed successfully!');
            console.log('\n📝 Next steps:');
            console.log('1. Edit .env file with your API keys and configuration');
            console.log('2. Run: bun run setup:install');
            console.log('3. Run: bun run contract:install (for contracts)');
            console.log('4. Run: bun run setup:compile');
            console.log('5. Run: bun run test');
            
        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            process.exit(1);
        }
    }

    async checkPrerequisites() {
        console.log('Checking prerequisites...');
        
        try {
            // Check Node.js version
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
            
            if (majorVersion < 18) {
                throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
            }

            // Check if bun is available
            const { execSync } = require('child_process');
            try {
                execSync('bun --version', { stdio: 'ignore' });
            } catch (error) {
                throw new Error('Bun is not installed or not in PATH');
            }

            // Check if Docker is available (optional)
            try {
                execSync('docker --version', { stdio: 'ignore' });
                console.log('Prerequisites checked (Docker available)');
            } catch (error) {
                console.log('Prerequisites checked (Docker not available - optional)');
            }

            console.log('✅ Prerequisites checked');
            
        } catch (error) {
            console.error('❌ Prerequisites check failed');
            throw error;
        }
    }

    async setupEnvironmentFile() {
        console.log('Setting up environment file...');
        
        try {
            if (!fs.existsSync(this.envExample)) {
                throw new Error('env.example file not found');
            }

            if (!fs.existsSync(this.envFile)) {
                fs.copyFileSync(this.envExample, this.envFile);
                console.log('✅ Environment file created (.env)');
                
                console.log('\n⚠️  Important: Configure the following in .env:');
                console.log('- PRIVATE_KEY (testnet private key)');
                console.log('- INFURA_PROJECT_ID');
                console.log('- ALCHEMY_API_KEY');
                console.log('- RELAYER_API_KEY (zkVerify)');
                console.log('- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
                
            } else {
                console.log('✅ Environment file already exists');
            }
            
        } catch (error) {
            console.error('❌ Environment file setup failed');
            throw error;
        }
    }

    async verifyProjectStructure() {
        console.log('Verifying project structure...');
        
        try {
            const requiredDirs = [
                'api',
                'contract', 
                'nextjs',
                'circuits',
                'docs',
                'scripts',
                'monitoring',
                'config'
            ];

            const missingDirs = [];
            
            for (const dir of requiredDirs) {
                const dirPath = path.join(this.rootDir, dir);
                if (!fs.existsSync(dirPath)) {
                    missingDirs.push(dir);
                }
            }

            if (missingDirs.length > 0) {
                throw new Error(`Missing directories: ${missingDirs.join(', ')}`);
            }

            // Check for key files
            const requiredFiles = [
                'bunfig.toml',
                'api/package.json',
                'contract/package.json',
                'nextjs/package.json',
                'circuits/package.json'
            ];

            const missingFiles = [];
            
            for (const file of requiredFiles) {
                const filePath = path.join(this.rootDir, file);
                if (!fs.existsSync(filePath)) {
                    missingFiles.push(file);
                }
            }

            if (missingFiles.length > 0) {
                console.log(`⚠️  Some files missing: ${missingFiles.join(', ')}`);
            } else {
                console.log('✅ Project structure verified');
            }
            
        } catch (error) {
            console.error('❌ Project structure verification failed');
            throw error;
        }
    }

    async checkDependencies() {
        console.log('Checking global dependencies...');
        
        try {
            const { execSync } = require('child_process');
            const globalDeps = [];

            // Check for hardhat
            try {
                execSync('bunx hardhat --version', { stdio: 'ignore' });
            } catch (error) {
                globalDeps.push('hardhat (will be installed locally)');
            }

            // Check for circom
            try {
                execSync('circom --version', { stdio: 'ignore' });
            } catch (error) {
                globalDeps.push('circom (install from https://docs.circom.io/)');
            }

            // Check for snarkjs
            try {
                execSync('bunx snarkjs --version', { stdio: 'ignore' });
            } catch (error) {
                globalDeps.push('snarkjs (bunx snarkjs --version)');
            }

            if (globalDeps.length > 0) {
                console.log('⚠️  Some global dependencies missing');
                console.log('\n📦 Missing global dependencies:');
                globalDeps.forEach(dep => console.log(`  - ${dep}`));
            } else {
                console.log('✅ Global dependencies checked');
            }
            
        } catch (error) {
            console.error('❌ Dependency check failed');
            throw error;
        }
    }

    generateEnvTemplate() {
        return `# ZKRandom Engine Environment Configuration

# API Configuration
NODE_ENV=development
PORT=3000
API_KEY_SECRET=your-secret-key-here

# Database
MONGODB_URI=mongodb://localhost:27017/zkrandom
REDIS_URL=redis://localhost:6379

# Blockchain Configuration
PRIVATE_KEY=your-testnet-private-key-here
INFURA_PROJECT_ID=your-infura-project-id
ALCHEMY_API_KEY=your-alchemy-api-key

# zkVerify Configuration
RELAYER_API_KEY=your-relayer-api-key
VERIFICATION_KEY_HASH=your-verification-key-hash

# Chain-specific RPC URLs
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_SEPOLIA_RPC=https://sepolia.base.org
ETHEREUM_RPC=https://mainnet.infura.io/v3/\${INFURA_PROJECT_ID}
POLYGON_RPC=https://polygon-rpc.com

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

# Security
JWT_SECRET=your-jwt-secret-here
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Next.js Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id`;
    }
}

// CLI execution
if (require.main === module) {
    const setup = new EnvironmentSetup();
    setup.setup().catch(console.error);
}

module.exports = EnvironmentSetup;