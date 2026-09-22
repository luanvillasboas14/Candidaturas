import type { NextConfig } from 'next';

const tesseractTrace = [
  './node_modules/tesseract.js/**/*',
  './node_modules/tesseract.js-core/**/*',
  './node_modules/sharp/**/*',
  './node_modules/@img/**/*',
  './node_modules/detect-libc/**/*',
  './tessdata/**/*',
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: 'standalone',
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core', 'sharp', 'pg'],
  outputFileTracingIncludes: {
    '/api/so-contrato/analisar': tesseractTrace,
    '/src/app/api/so-contrato/analisar/route': tesseractTrace,
  },
};

export default nextConfig;
