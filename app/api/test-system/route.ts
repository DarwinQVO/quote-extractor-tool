/**
 * Simple System Test - No External Dependencies
 * Tests basic functionality without Supabase, OpenAI, or yt-dlp
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };

  // Test 1: Basic Node.js functionality
  try {
    const nodeVersion = process.version;
    results.tests.push({
      name: 'Node.js Runtime',
      status: 'PASS',
      details: `Node ${nodeVersion}`
    });
    results.summary.passed++;
  } catch (error) {
    results.tests.push({
      name: 'Node.js Runtime',
      status: 'FAIL',
      error: error.message
    });
    results.summary.failed++;
  }

  // Test 2: Environment Variables Detection
  const envTest = {
    name: 'Environment Variables',
    status: 'PASS',
    details: {
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'not-railway',
      OPENAI_KEY_EXISTS: !!(process.env.OPENAI_API_KEY),
      OPENAI_KEY_VALID: !!(process.env.OPENAI_API_KEY?.startsWith('sk-')),
      SUPABASE_URL_EXISTS: !!(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_KEY_EXISTS: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      YTDLP_PROXY_EXISTS: !!(process.env.YTDLP_PROXY)
    }
  };
  results.tests.push(envTest);
  results.summary.passed++;

  // Test 3: Memory Storage (our fallback system)
  try {
    const { memoryStorage_ } = await import('@/lib/memory-storage');
    
    // Test creating a source
    const testSource = {
      id: 'test-123',
      url: 'https://youtube.com/watch?v=test',
      title: 'Test Video',
      channel: 'Test Channel',
      duration: 180,
      thumbnail: 'https://test.jpg',
      status: 'ready' as const,
      addedAt: new Date()
    };
    
    await memoryStorage_.sources.create(testSource);
    const retrieved = await memoryStorage_.sources.findById('test-123');
    
    if (retrieved && retrieved.title === 'Test Video') {
      results.tests.push({
        name: 'Memory Storage System',
        status: 'PASS',
        details: 'Source created and retrieved successfully'
      });
      results.summary.passed++;
    } else {
      throw new Error('Source not retrieved correctly');
    }
    
    // Cleanup
    await memoryStorage_.sources.delete('test-123');
    
  } catch (error) {
    results.tests.push({
      name: 'Memory Storage System',
      status: 'FAIL',
      error: error.message
    });
    results.summary.failed++;
  }

  // Test 4: Basic file system access
  try {
    const fs = await import('fs/promises');
    const os = await import('os');
    const tmpdir = os.tmpdir();
    
    // Try to write a test file
    const testFile = `${tmpdir}/railway-test-${Date.now()}.txt`;
    await fs.writeFile(testFile, 'Railway test');
    const content = await fs.readFile(testFile, 'utf8');
    await fs.unlink(testFile);
    
    if (content === 'Railway test') {
      results.tests.push({
        name: 'File System Access',
        status: 'PASS',
        details: `Temp directory: ${tmpdir}`
      });
      results.summary.passed++;
    } else {
      throw new Error('File content mismatch');
    }
    
  } catch (error) {
    results.tests.push({
      name: 'File System Access',
      status: 'FAIL',
      error: error.message
    });
    results.summary.failed++;
  }

  // Test 5: Basic HTTP functionality
  try {
    const response = await fetch('https://httpbin.org/json', {
      method: 'GET',
      headers: { 'User-Agent': 'Railway-Test' }
    });
    
    if (response.ok) {
      results.tests.push({
        name: 'HTTP Requests',
        status: 'PASS',
        details: `Status: ${response.status}`
      });
      results.summary.passed++;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
    
  } catch (error) {
    results.tests.push({
      name: 'HTTP Requests',
      status: 'FAIL',
      error: error.message
    });
    results.summary.failed++;
  }

  results.summary.total = results.summary.passed + results.summary.failed;
  
  return NextResponse.json(results, {
    status: results.summary.failed > 0 ? 500 : 200,
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    }
  });
}