import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['vitest.setup.js'],
    include: [
      'tests/unit/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}',
    ],
    coverage: {
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/pages/_app.tsx',
        'src/pages/_document.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/@core',
      '@layouts': '/src/@layouts',
      '@menu': '/src/@menu',
      '@assets': '/src/assets',
      '@components': '/src/components',
      '@configs': '/src/configs',
      '@views': '/src/views',
      '@prisma/client': '/node_modules/@prisma/client',
      '@prisma/client/': '/node_modules/@prisma/client/',
    },
  },
})