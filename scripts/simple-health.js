#!/usr/bin/env bun

const { execSync } = require('child_process');
const fs = require('fs');

class SimpleHealthCheck {
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
        
        // Check if .env file exists
        if (fs.existsSync('.env')) {
            this.results.infrastructure.env = {
                status: 'healthy',
                message: 'Environment file exists'
            };
            console.log('✅ Environment file exists');
        } else {
            this.results.infrastructure.env = {
                status: 'warning',
                message: 'Environment file missing'
            };
            console.log('⚠️  Environment file missing');
        }
    }

    async checkDependencies() {
        console.log('\n📦 Dependencies Health');
        
        // Check Node.js version
        try {
            const version = process.version;
            const majorVersion = parseInt(version.slice(1).split('.')[0]);
            
            if (majorVersion >= 18) {
                this.results.dependencies.node = {
                    status: 'healthy',
                    message: `Node.js ${version} (✓)`
                };
                console.log(`✅ Node.js ${version}`);
            } else {
                this.results.dependencies.node = {
                    status: 'unhealthy',
                    message: `Node.js ${version} (requires 18+)`
                };
                console.log(`❌ Node.js ${version} (requires 18+)`);
            }
            
        } catch (error) {
            this.results.dependencies.node = {
                status: 'error',
                message: 'Node.js version check failed'
            };
            console.log('❌ Node.js version check failed');
        }

        // Check Bun
        try {
            execSync('bun --version', { stdio: 'ignore' });
            this.results.dependencies.bun = {
                status: 'healthy',
                message: 'Bun is available'
            };
            console.log('✅ Bun is available');
        } catch (error) {
            this.results.dependencies.bun = {
                status: 'unhealthy',
                message: 'Bun is not available'
            };
            console.log('❌ Bun is not available');
        }

        // Check workspace dependencies
        const workspaces = ['api', 'nextjs', 'circuits'];
        const results = [];
        
        for (const workspace of workspaces) {
            try {
                const packageJsonPath = `${workspace}/package.json`;
                if (fs.existsSync(packageJsonPath)) {
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
            if (fs.existsSync(contractPackageJson)) {
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
            console.log(`✅ Workspaces: ${healthyWorkspaces}/${results.length} healthy`);
        } else {
            console.log(`⚠️  Workspaces: ${healthyWorkspaces}/${results.length} healthy`);
        }
    }

    calculateOverallHealth() {
        const allChecks = [
            ...Object.values(this.results.infrastructure),
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
        console.log('📊 Health Check Results');
        console.log('='.repeat(50));
        
        // Overall status
        const statusColor = this.results.overall === 'healthy' ? 'green' : 
                          this.results.overall === 'warning' ? 'yellow' : 'red';
        const statusIcon = this.results.overall === 'healthy' ? '✅' : 
                         this.results.overall === 'warning' ? '⚠️' : '❌';
        
        console.log(`\n${statusIcon} Overall Status: ${this.results.overall.toUpperCase()}`);
        
        console.log('\n📝 Recommendations:');
        console.log('  • Run: bun run install:all');
        console.log('  • Run: bun run build:all');
        console.log('  • Run: bun run contract:install');
        
        console.log('\n🔗 Useful Commands:');
        console.log('  • Start all services: bun run dev:all');
        console.log('  • Build everything: bun run build:all');
        console.log('  • Contract work: bun run contract:compile');
        console.log('  • Setup environment: bun run setup');
    }
}

// CLI execution
if (require.main === module) {
    const healthCheck = new SimpleHealthCheck();
    healthCheck.runFullHealthCheck().catch(console.error);
}

module.exports = SimpleHealthCheck; 