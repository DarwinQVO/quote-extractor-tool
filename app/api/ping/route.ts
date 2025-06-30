import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    ping: 'pong', 
    time: Date.now(),
    working: true 
  });
}