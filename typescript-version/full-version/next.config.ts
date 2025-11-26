import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  basePath: process.env.BASEPATH,
  // Exclude server-only packages from client-side bundling
  serverExternalPackages: ['prom-client'],
  webpack: (config, { isServer }) => {
    // Fix for mini-css-extract-plugin issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        cluster: false,
      }
      // Exclude prom-client from client-side bundling
      config.externals = config.externals || []
      config.externals.push('prom-client')
      
      // Настраиваем splitChunks для xlsx и papaparse - они загружаются динамически
      // Это позволяет webpack правильно обрабатывать динамические импорты
      if (!config.optimization) {
        config.optimization = {}
      }
      if (!config.optimization.splitChunks) {
        config.optimization.splitChunks = {}
      }
      if (!config.optimization.splitChunks.cacheGroups) {
        config.optimization.splitChunks.cacheGroups = {}
      }
      
      config.optimization.splitChunks.cacheGroups.xlsx = {
        test: /[\\/]node_modules[\\/]xlsx[\\/]/,
        name: 'xlsx',
        chunks: 'async',
        priority: 10,
      }
      
      config.optimization.splitChunks.cacheGroups.papaparse = {
        test: /[\\/]node_modules[\\/]papaparse[\\/]/,
        name: 'papaparse',
        chunks: 'async',
        priority: 10,
      }
    } else {
      // На сервере тоже настраиваем для корректной работы
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }

    return config
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/en/dashboards/crm',
        permanent: true,
        locale: false
      },
      {
        source: '/:lang(en|fr|ar)',
        destination: '/:lang/dashboards/crm',
        permanent: true,
        locale: false
      },
      {
        source: '/((?!(?:en|fr|ar|front-pages|favicon.ico)\\b)):path',
        destination: '/en/:path',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
