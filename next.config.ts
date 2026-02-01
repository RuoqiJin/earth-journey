import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cesium requires static file serving
  output: 'standalone',
}

export default nextConfig
