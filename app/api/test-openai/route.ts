import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Initialize OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'build-placeholder') {
    throw new Error(`OpenAI API key not configured. Current: "${apiKey}"`);
  }
  
  return new OpenAI({ apiKey });
}

export async function POST() {
  try {
    console.log('🧪 Testing OpenAI API connection...');
    
    const openai = getOpenAIClient();
    
    // Test simple OpenAI API call first
    console.log('📝 Testing text completion...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "Hello from Railway!" in exactly 3 words.' }],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI API test successful');
    
    return NextResponse.json({
      success: true,
      message: 'OpenAI API is working',
      testResponse: completion.choices[0].message.content,
      models: {
        whisper: 'whisper-1 should be available',
        chat: 'gpt-3.5-turbo working'
      }
    });
    
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : 'No stack trace'
    }, { status: 500 });
  }
}