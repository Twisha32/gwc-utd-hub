import type { NextConfig } from 'next';

const config: NextConfig = {
  // small self-contained server for the Docker image
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
};

export default config;
