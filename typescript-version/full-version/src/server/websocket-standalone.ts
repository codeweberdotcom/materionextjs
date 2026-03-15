/**
 * Standalone WebSocket сервер
 * Независимый сервер без зависимости от Next.js на отдельном порту
 */

import { createServer } from 'http'

import { initializeSocketServer } from '../lib/sockets'
import logger from '../lib/logger'
import { env } from '../shared/config/env'
import { prisma } from '../libs/prisma'

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001', 10)

async function startWebSocketServer() {
  try {
    // Создаём HTTP сервер только для WebSocket (без Next.js!)
    const httpServer = createServer((req, res) => {
      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'ok',
          service: 'websocket',
          uptime: process.uptime(),
          port: PORT,
          environment: env.NODE_ENV || 'development',
        }))
        
return
      }

      // Metrics endpoint (опционально)
      if (req.url === '/metrics' && process.env.NODE_ENV !== 'production') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          connections: (globalThis.io?.engine?.clientsCount || 0),
          uptime: process.uptime(),
        }))
        
return
      }

      // 404 для всех остальных запросов
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not Found' }))
    })

    // Инициализируем Socket.IO сервер
    const io = await initializeSocketServer(httpServer)

    // Сохраняем ссылку на io для использования в приложении
    globalThis.io = io

    // Запускаем сервер
    httpServer.listen(PORT, () => {
      logger.info('🚀 WebSocket server started', {
        port: PORT,
        environment: env.NODE_ENV || 'development',
        namespaces: ['/chat', '/notifications'],
        healthCheck: `http://localhost:${PORT}/health`,
      })
    })

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down WebSocket server gracefully...`)

      try {
        // Отключаем все Socket.IO соединения
        if (io) {
          io.disconnectSockets(true)
          io.close(() => {
            logger.info('Socket.IO server closed')
          })
        }

        // Закрываем HTTP сервер
        httpServer.close(() => {
          logger.info('HTTP server closed')
        })

        // Закрываем Prisma соединение
        await prisma.$disconnect()
        logger.info('Database connection closed')

        process.exit(0)
      } catch (error) {
        logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error) })
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    // Обработка необработанных ошибок
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in WebSocket server', {
        error: error.message,
        stack: error.stack,
      })
      shutdown('uncaughtException')
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in WebSocket server', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise),
      })
      shutdown('unhandledRejection')
    })

  } catch (error) {
    logger.error('Failed to start WebSocket server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    process.exit(1)
  }
}

// Запускаем сервер
startWebSocketServer()



