import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@moverix/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
}

export default nextConfig
