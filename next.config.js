/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['ccpvnpidhxkcbxeeyqeq.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  // Temporarily disable TypeScript and ESLint checks during build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist']
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignore Node.js specific modules for client-side build
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        stream: false,
        util: false,
        assert: false,
        crypto: false,
        os: false,
        https: false,
        http: false,
        url: false,
        zlib: false
      }
      
      // Handle PDF.js worker
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist/build/pdf.worker.js': 'pdfjs-dist/build/pdf.worker.min.js'
      }
    }
    
    return config
  }
}

module.exports = nextConfig