/**
 * Новый рефакторированный WebSocket сервер
 * Использует модульную архитектуру с namespaces, типизацией и аутентификацией
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initializeSocketServer } from '../lib/sockets'
import logger from '../lib/logger'
import { env, isProduction } from '../shared/config/env'

const dev = !isProduction
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Создаем HTTP сервер
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true)
    handle(req, res, parsedUrl)
  })

  // Инициализируем Socket.IO сервер с новой архитектурой
  const io = initializeSocketServer(server);

  // Сохраняем ссылку на io для использования в приложении
  globalThis.io = io;

  const PORT = env.PORT ?? 3000

  server.listen(PORT, () => {
    logger.info(`🚀 Next.js server with Socket.IO running on port ${PORT}`, {
      environment: env.NODE_ENV,
      port: PORT,
      socketNamespaces: ['/chat', '/notifications']
    })
  })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully')

    if (io) {
      io.disconnectSockets(true)
      io.close(() => {
        logger.info('Socket.IO server closed')
      })
    }

    server.close(() => {
      logger.info('HTTP server closed')
      process.exit(0)
    })
  })

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully')

    if (io) {
      io.disconnectSockets(true)
      io.close(() => {
        logger.info('Socket.IO server closed')
      })
    }

    server.close(() => {
      logger.info('HTTP server closed')
      process.exit(0)
    })
  })
}).catch(error => {
  logger.error('Failed to start server', { error: error.message })
  process.exit(1)
})
