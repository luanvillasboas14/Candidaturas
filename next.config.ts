import type { NextConfig } from 'next';

const tesseractTrace = [
  './node_modules/tesseract.js/**/*',
  './node_modules/tesseract.js-core/**/*',
  './tessdata/**/*',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone',
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core'],
  outputFileTracingIncludes: {
    '/api/so-contrato/analisar': tesseractTrace,
    '/src/app/api/so-contrato/analisar/route': tesseractTrace,
  },
};

export default nextConfig;
