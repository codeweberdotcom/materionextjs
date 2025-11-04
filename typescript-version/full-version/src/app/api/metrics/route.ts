import { NextRequest, NextResponse } from 'next/server'
import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client'

// Enable default metrics collection
collectDefaultMetrics()

// Custom metrics
const totalUsers = new Gauge({
  name: 'app_total_users',
  help: 'Total number of registered users'
})

const activeSessions = new Gauge({
  name: 'app_active_sessions',
  help: 'Number of active user sessions'
})

const apiRequests = new Counter({
  name: 'app_api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'endpoint', 'status']
})

const responseTime = new Histogram({
  name: 'app_response_time_seconds',
  help: 'Response time in seconds',
  labelNames: ['method', 'endpoint']
})

// Socket.IO metrics
const socketConnections = new Gauge({
  name: 'socket_io_connections_total',
  help: 'Total number of active Socket.IO connections'
})

const socketMessagesSent = new Counter({
  name: 'socket_io_messages_sent_total',
  help: 'Total number of Socket.IO messages sent',
  labelNames: ['event']
})

const socketMessagesReceived = new Counter({
  name: 'socket_io_messages_received_total',
  help: 'Total number of Socket.IO messages received',
  labelNames: ['event']
})

const socketErrors = new Counter({
  name: 'socket_io_errors_total',
  help: 'Total number of Socket.IO errors',
  labelNames: ['type']
})

// Route metrics
const routeRequests = new Counter({
  name: 'app_route_requests_total',
  help: 'Total number of requests per route',
  labelNames: ['method', 'route', 'status_code']
})

const routeResponseTime = new Histogram({
  name: 'app_route_response_time_seconds',
  help: 'Response time per route',
  labelNames: ['method', 'route']
})

export async function GET(request: NextRequest) {
  try {
    // Get system metrics
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const uptime = process.uptime()

    // Mock application metrics (replace with real data from your database)
    const mockMetrics = {
      totalUsers: 1250,
      activeSessions: 89,
      apiRequests: 15420,
      databaseSize: 256 * 1024 * 1024, // 256 MB
      connectionPool: '5/10',
      avgResponseTime: 0.145,
      errorRate: 0.023,
      throughput: 120,
      totalRecords: 15420,
      socketConnections: 45,
      socketMessagesSent: 1250,
      socketMessagesReceived: 1180,
      socketErrors: 12,
      routeStats: {
        '/api/chat/messages': { requests: 450, avgResponseTime: 0.089 },
        '/api/notifications': { requests: 320, avgResponseTime: 0.156 },
        '/api/users': { requests: 180, avgResponseTime: 0.234 }
      }
    }

    // Update custom metrics
    totalUsers.set(mockMetrics.totalUsers)
    activeSessions.set(mockMetrics.activeSessions)

    // Update Socket.IO metrics
    socketConnections.set(mockMetrics.socketConnections)
    socketMessagesSent.inc({ event: 'message' }, mockMetrics.socketMessagesSent)
    socketMessagesReceived.inc({ event: 'message' }, mockMetrics.socketMessagesReceived)
    socketErrors.inc({ type: 'connection_error' }, mockMetrics.socketErrors)

    // Update route metrics
    Object.entries(mockMetrics.routeStats).forEach(([route, stats]: [string, any]) => {
      routeRequests.inc({ method: 'GET', route, status_code: '200' }, stats.requests)
      routeResponseTime.observe({ method: 'GET', route }, stats.avgResponseTime)
    })

    // Get Prometheus metrics
    const metrics = await register.metrics()

    // Return both system metrics and Prometheus metrics
    const response = {
      system: {
        memoryUsage: memUsage,
        cpuUsage: cpuUsage.system / 1000000, // Convert to percentage
        uptime: uptime
      },
      application: mockMetrics,
      prometheus: metrics
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}

// Middleware to track API requests
export async function middleware(request: NextRequest) {
  const start = Date.now()
  const method = request.method
  const url = new URL(request.url)
  const endpoint = url.pathname

  try {
    // Track the request
    apiRequests.inc({ method, endpoint, status: '200' })

    // Measure response time
    const responseTimeValue = (Date.now() - start) / 1000
    responseTime.observe({ method, endpoint }, responseTimeValue)

    return NextResponse.next()
  } catch (error) {
    // Track failed requests
    apiRequests.inc({ method, endpoint, status: '500' })
    throw error
  }
}