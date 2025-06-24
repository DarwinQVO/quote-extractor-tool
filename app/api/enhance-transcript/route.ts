import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Initialize OpenAI client only when needed
let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'build-placeholder' || apiKey === 'build-test') {
      throw new Error(`OpenAI API key not configured. Current: "${apiKey}"`);
    }
    
    if (!apiKey.startsWith('sk-')) {
      throw new Error(`Invalid OpenAI API key format. Must start with 'sk-'`);
    }
    
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    const { text, context } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();
    
    // Create context-aware prompt
    const systemPrompt = `You are an expert transcript enhancer. Your job is to improve transcript text quality while maintaining the exact meaning and speaker intent.

APPLY THESE RULES EXACTLY:
1. Fix company/person names using context knowledge (e.g., if they mention "WAZE" but transcript says "ways", correct it)
2. Identify missed percentages (e.g., "fifty five" → "55%")
3. Capitalize first letter of quotes within quotes
4. Fix grammar and punctuation intelligently
5. Maintain all factual information exactly - NEVER change numbers, dates, or specific details
6. Keep the natural speaking flow and tone
7. Don't add words that weren't spoken

${context ? `CONTEXT:
- Video: ${context.title}
- Channel: ${context.channel}
- Speakers: ${context.speakers?.join(', ') || 'Unknown'}
- Topic: ${context.topic || 'General'}` : ''}

Return only the enhanced text, no explanations.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const enhancedText = completion.choices[0]?.message?.content?.trim();
    
    if (!enhancedText) {
      throw new Error('No enhanced text received from OpenAI');
    }

    return NextResponse.json({ 
      enhancedText,
      success: true 
    });

  } catch (error: any) {
    console.error('Transcript enhancement error:', error);
    
    return NextResponse.json(
      { 
        error: 'Enhancement failed',
        details: error.message,
        success: false
      },
      { status: 500 }
    );
  }
}