/**
 * Health Check API for Railway Production Monitoring
 * Enterprise-grade health monitoring endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { performSystemHealthCheck } from '@/lib/production-health';

export async function GET(request: NextRequest) {
  try {
    const health = await performSystemHealthCheck();
    
    // Return appropriate HTTP status based on health
    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 206 : 503;
    
    return NextResponse.json({
      status: health.overall,
      timestamp: health.timestamp,
      checks: health.checks,
      summary: {
        healthy: health.checks.filter(c => c.status === 'healthy').length,
        warnings: health.checks.filter(c => c.status === 'warning').length,
        unhealthy: health.checks.filter(c => c.status === 'unhealthy').length,
        total: health.checks.length
      }
    }, { status: statusCode });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: 'Health check system failure',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Support HEAD requests for simple uptime checks
export async function HEAD(request: NextRequest) {
  try {
    const health = await performSystemHealthCheck();
    
    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 206 : 503;
    
    return new Response(null, { 
      status: statusCode,
      headers: {
        'X-Health-Status': health.overall,
        'X-Health-Timestamp': health.timestamp.toISOString(),
        'X-Health-Checks-Total': health.checks.length.toString(),
        'X-Health-Checks-Healthy': health.checks.filter(c => c.status === 'healthy').length.toString(),
      }
    });
    
  } catch (error) {
    return new Response(null, { 
      status: 500,
      headers: {
        'X-Health-Status': 'error',
        'X-Health-Error': 'Health check system failure'
      }
    });
  }
}