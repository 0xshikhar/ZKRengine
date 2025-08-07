#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying ZKR Engine Frontend...');

// Check if we're in the right directory
const currentDir = process.cwd();
if (!currentDir.includes('zkr-engine')) {
  console.error('❌ Please run this script from the zkr-engine root directory');
  process.exit(1);
}

// Navigate to the Next.js directory
const nextjsDir = path.join(currentDir, 'nextjs');
if (!fs.existsSync(nextjsDir)) {
  console.error('❌ Next.js directory not found');
  process.exit(1);
}

process.chdir(nextjsDir);

try {
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('🔧 Building the application...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');
  console.log('');
  console.log('🎉 ZKR Engine Frontend is ready for deployment!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Deploy to Vercel: npx vercel --prod');
  console.log('2. Deploy to Netlify: netlify deploy --prod');
  console.log('3. Deploy to Railway: railway up');
  console.log('4. Or run locally: npm run start');
  console.log('');
  console.log('🌐 Make sure to update your environment variables in your hosting platform:');
  console.log('- NEXT_PUBLIC_API_URL: Your backend API URL');
  console.log('- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: Your WalletConnect Project ID');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
} 