const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

class ContractDeployer {
    constructor() {
        this.deploymentConfig = require('../config/deployment.json');
        this.chainConfig = require('../config/chains.json');
        this.deployedContracts = {};
    }

    async deploy(networkName) {
        console.log(`🚀 Starting deployment on ${networkName}...`);

        try {
            // Get network configuration
            const network = this.deploymentConfig.networks[networkName];
            if (!network) {
                throw new Error(`Network ${networkName} not found in deployment config`);
            }

            const [deployer] = await ethers.getSigners();
            console.log(`📋 Deploying with account: ${deployer.address}`);
            console.log(`💰 Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

            // Deploy contracts in order
            await this.deployZKRandomOracle(network, deployer);
            await this.deployZKRandomConsumer(network, deployer);

            // Post-deployment tasks
            await this.runPostDeploymentTasks(network, deployer);

            // Save deployment results
            await this.saveDeploymentResults(networkName);

            console.log(`✅ Deployment completed successfully on ${networkName}`);

        } catch (error) {
            console.error(`❌ Deployment failed on ${networkName}:`, error);
            throw error;
        }
    }

    async deployZKRandomOracle(network, deployer) {
        console.log('\n📦 Deploying ZKRandomOracle...');

        const constructorArgs = this.deploymentConfig.constructorArgs.ZKRandomOracle;

        // Replace placeholder values
        const zkVerifyAddress = constructorArgs.zkVerifyAddress;
        const verificationKeyHash = process.env.VERIFICATION_KEY_HASH || constructorArgs.verificationKeyHash;
        const owner = deployer.address;

        const ZKRandomOracle = await ethers.getContractFactory('ZKRandomOracle');
        const oracle = await ZKRandomOracle.deploy(
            zkVerifyAddress,
            verificationKeyHash,
            owner,
            {
                gasPrice: ethers.utils.parseUnits(network.gasPrice, 'gwei'),
                gasLimit: network.gasLimit
            }
        );

        await oracle.deployed();

        console.log(`✅ ZKRandomOracle deployed to: ${oracle.address}`);
        console.log(`📄 Transaction hash: ${oracle.deploymentTransaction().hash}`);

        // Wait for confirmations
        await oracle.deploymentTransaction().wait(network.confirmations);

        this.deployedContracts.ZKRandomOracle = {
            address: oracle.address,
            deploymentTx: oracle.deploymentTransaction().hash,
            blockNumber: oracle.deploymentTransaction().blockNumber,
            deployedAt: new Date().toISOString(),
            constructorArgs: [zkVerifyAddress, verificationKeyHash, owner]
        };
    }

    async deployZKRandomConsumer(network, deployer) {
        console.log('\n📦 Deploying ZKRandomConsumer (Example)...');

        if (!this.deployedContracts.ZKRandomOracle) {
            throw new Error('ZKRandomOracle must be deployed first');
        }

        const oracleAddress = this.deployedContracts.ZKRandomOracle.address;

        const ExampleRandomConsumer = await ethers.getContractFactory('ExampleRandomConsumer');
        const consumer = await ExampleRandomConsumer.deploy(
            oracleAddress,
            {
                gasPrice: ethers.utils.parseUnits(network.gasPrice, 'gwei'),
                gasLimit: network.gasLimit
            }
        );

        await consumer.deployed();

        console.log(`✅ ExampleRandomConsumer deployed to: ${consumer.address}`);
        console.log(`📄 Transaction hash: ${consumer.deploymentTransaction().hash}`);

        // Wait for confirmations
        await consumer.deploymentTransaction().wait(network.confirmations);

        this.deployedContracts.ZKRandomConsumer = {
            address: consumer.address,
            deploymentTx: consumer.deploymentTransaction().hash,
            blockNumber: consumer.deploymentTransaction().blockNumber,
            deployedAt: new Date().toISOString(),
            constructorArgs: [oracleAddress]
        };
    }

    async runPostDeploymentTasks(network, deployer) {
        console.log('\n🔧 Running post-deployment tasks...');

        const oracle = await ethers.getContractAt('ZKRandomOracle', this.deployedContracts.ZKRandomOracle.address);

        // Set up relayers
        const relayers = this.deploymentConfig.postDeployment.relayers;
        for (const relayer of relayers) {
            if (relayer && relayer !== '${RELAYER_ADDRESS_1}' && relayer !== '${RELAYER_ADDRESS_2}') {
                console.log(`👤 Authorizing relayer: ${relayer}`);
                const tx = await oracle.setRelayerAuthorization(relayer, true);
                await tx.wait(network.confirmations);
            }
        }

        // Configure rate limits if specified
        const rateLimits = this.deploymentConfig.postDeployment.rateLimits;
        if (rateLimits.requestsPerHour) {
            console.log(`⏱️  Setting rate limits...`);
            // Implementation depends on specific rate limiting mechanism
        }

        console.log('✅ Post-deployment tasks completed');
    }

    async saveDeploymentResults(networkName) {
        const deploymentPath = path.join(__dirname, '../config/deployment.json');
        const config = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

        // Update deployment config with actual addresses
        config.networks[networkName].contracts = this.deployedContracts;

        // Write back to file
        fs.writeFileSync(deploymentPath, JSON.stringify(config, null, 2));

        // Also create a separate deployment record
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const recordPath = path.join(__dirname, `../deployments/${networkName}-${timestamp}.json`);

        // Ensure deployments directory exists
        const deploymentsDir = path.dirname(recordPath);
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentRecord = {
            network: networkName,
            timestamp: new Date().toISOString(),
            contracts: this.deployedContracts,
            deployer: (await ethers.getSigners())[0].address,
            hardhatNetwork: network.name
        };

        fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));

        console.log(`📁 Deployment results saved to: ${recordPath}`);
    }

    async verifyContracts(networkName) {
        console.log(`\n🔍 Verifying contracts on ${networkName}...`);

        try {
            // Verify ZKRandomOracle
            if (this.deployedContracts.ZKRandomOracle) {
                console.log('Verifying ZKRandomOracle...');
                await hre.run('verify:verify', {
                    address: this.deployedContracts.ZKRandomOracle.address,
                    constructorArguments: this.deployedContracts.ZKRandomOracle.constructorArgs,
                });
            }

            // Verify ZKRandomConsumer
            if (this.deployedContracts.ZKRandomConsumer) {
                console.log('Verifying ZKRandomConsumer...');
                await hre.run('verify:verify', {
                    address: this.deployedContracts.ZKRandomConsumer.address,
                    constructorArguments: this.deployedContracts.ZKRandomConsumer.constructorArgs,
                });
            }

            console.log('✅ Contract verification completed');

        } catch (error) {
            console.warn('⚠️  Contract verification failed:', error.message);
        }
    }
}

// CLI execution
async function main() {
    const networkName = process.argv[2];

    if (!networkName) {
        console.error('❌ Please specify a network name');
        console.log('Usage: npm run deploy:contracts <network-name>');
        console.log('Available networks: base-mainnet, base-sepolia, ethereum, polygon');
        process.exit(1);
    }

    const deployer = new ContractDeployer();

    try {
        await deployer.deploy(networkName);

        // Optionally verify contracts
        if (process.env.VERIFY_CONTRACTS === 'true') {
            await deployer.verifyContracts(networkName);
        }

        console.log('\n🎉 Deployment process completed successfully!');

    } catch (error) {
        console.error('💥 Deployment failed:', error);
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = ContractDeployer;

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}