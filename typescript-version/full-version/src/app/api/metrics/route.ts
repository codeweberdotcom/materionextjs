import { metricsRegistry } from '@/lib/metrics/registry'

export async function GET() {
  try {
    const body = await metricsRegistry.metrics()

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': metricsRegistry.contentType
      }
    })
  } catch (error) {
    return new Response('Failed to collect metrics', { status: 500 })
  }
}
