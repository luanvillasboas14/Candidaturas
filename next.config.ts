import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone',
  serverExternalPackages: ['tesseract.js'],
};

export default nextConfig;
