/**
 * Simple Status Check - Railway Deployment Verification
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Railway deployment is working',
    build_id: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    node_version: process.version,
    env: process.env.NODE_ENV || 'unknown'
  });
}

export async function POST() {
  return NextResponse.json({
    status: 'ok',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}