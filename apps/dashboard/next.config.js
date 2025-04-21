/** @type {import('next').NextConfig} */
// next.config.js
const path = require('path');

module.exports = {
  webpack: (config, options) => {
    if (options.isServer) {
      config.externals = ['react', ...config.externals];
    }
    config.resolve.alias['react'] = path.resolve(__dirname, '.', 'node_modules', 'react');
    return config;
  },
};

const nextConfig = {
  experimental: {
    // Statikus hibakezelő oldalak előrenderelésének kikapcsolása
    //disableStaticPages404: true,
    //disableStaticPages500: true,
  },
  // ESLint hibák figyelmen kívül hagyása build során
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Strict mode kikapcsolása (opcionális)
  reactStrictMode: false,
  // Standalone output
  output: 'standalone',
};

module.exports = nextConfig;
