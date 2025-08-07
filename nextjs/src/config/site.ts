import { SiteConfig } from "@/types"

import { env } from "@/env.mjs"

export const siteConfig: SiteConfig = {
  name: "ZKR Engine",
  author: "0xShikhar",
  description:
    "Generate cryptographically secure, zero-knowledge verified random numbers for your decentralized applications across multiple blockchains.",
  keywords: ["Zero-Knowledge", "Randomness", "Blockchain", "ZK Proofs", "Cryptography", "Web3", "DeFi"],
  url: {
    base: env.NEXT_PUBLIC_APP_URL,
    author: "https://shikhar.xyz",
  },
  links: {
    github: "https://github.com/0xshikhar/zkr-engine",
  },
  ogImage: `${env.NEXT_PUBLIC_APP_URL}/og.jpg`,
}
