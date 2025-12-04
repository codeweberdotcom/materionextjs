import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const wsPort = process.env.WEBSOCKET_PORT || '3001'
    const healthUrl = `http://localhost:${wsPort}/health`
    
    console.log('[TEST] Checking WebSocket health:', healthUrl)
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    
    console.log('[TEST] Response status:', response.status, response.ok)
    
    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        reason: 'Response not OK',
        status: response.status 
      })
    }
    
    const data = await response.json()
    console.log('[TEST] Response data:', data)
    
    return NextResponse.json({ 
      success: true, 
      socketStatus: data.status === 'ok',
      data 
    })
  } catch (error) {
    console.error('[TEST] Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

