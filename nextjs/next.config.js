/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    output: 'standalone',
    experimental: {
        outputFileTracingRoot: undefined,
    },
}

module.exports = nextConfig
