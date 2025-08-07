# ZKR Engine Frontend

A modern, responsive web application for generating cryptographically secure, zero-knowledge verified random numbers across multiple blockchains.

## Features

- 🎯 **Zero-Knowledge Verified Randomness**: Generate cryptographically secure random numbers with ZK proofs
- 🌐 **Multi-Chain Support**: Support for Ethereum, Base, Polygon, and more
- 🔒 **Tamper-Proof**: Immutable randomness that cannot be manipulated
- ⚡ **Fast Processing**: Quick randomness generation with real-time status tracking
- 🎨 **Modern UI**: Beautiful, responsive design with dark/light mode support
- 🔗 **Wallet Integration**: Seamless integration with popular Web3 wallets

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **Web3**: RainbowKit + wagmi for wallet connectivity
- **State Management**: React hooks with TanStack Query
- **Icons**: Lucide React
- **Notifications**: Sonner for toast notifications

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun package manager
- Backend API server running (see main README)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/0xshikhar/zkr-engine.git
   cd zkr-engine/nextjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp env.local .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_CHAIN_ID=84532
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── navigation/     # Navigation components
│   └── zkrandom/      # ZK Randomness specific components
├── config/             # Configuration files
├── lib/                # Utility functions
├── styles/             # Global styles
└── types/              # TypeScript type definitions
```

## Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard**

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm i -g netlify-cli
   ```

2. **Build and deploy**
   ```bash
   npm run build
   netlify deploy --prod --dir=out
   ```

### Option 3: Railway

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Deploy**
   ```bash
   railway up
   ```

### Option 4: Docker

1. **Build the Docker image**
   ```bash
   docker build -t zkr-engine-frontend .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:3000 zkr-engine-frontend
   ```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Your frontend URL | Yes | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes | `http://localhost:3001` |
| `NEXT_PUBLIC_CHAIN_ID` | Default chain ID | No | `84532` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Project ID | Yes | - |

## API Integration

The frontend integrates with the ZKR Engine backend API. Make sure your backend is running and accessible at the URL specified in `NEXT_PUBLIC_API_URL`.

### Supported Endpoints

- `GET /v1/randomness/chains` - Get supported chains
- `POST /v1/randomness/request` - Submit randomness request
- `GET /v1/randomness/request/:id` - Get request status
- `GET /v1/randomness/user/:address` - Get user requests
- `GET /v1/randomness/statistics` - Get statistics

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Support

- 📧 Email: support@zkr-engine.com
- 💬 Discord: [Join our community](https://discord.gg/zkr-engine)
- 📖 Documentation: [docs.zkr-engine.com](https://docs.zkr-engine.com)
- 🐛 Issues: [GitHub Issues](https://github.com/0xshikhar/zkr-engine/issues) 