import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(quotes);
  } catch (error) {
    console.error('Error loading quotes from SQLite:', error);
    return NextResponse.json({ error: 'Failed to load quotes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const quotes = await request.json();
    
    if (!Array.isArray(quotes)) {
      return NextResponse.json({ error: 'Quotes must be an array' }, { status: 400 });
    }
    
    // Upsert all quotes
    for (const quote of quotes) {
      await prisma.quote.upsert({
        where: { id: quote.id },
        update: {
          sourceId: quote.sourceId,
          text: quote.text,
          speaker: quote.speaker,
          startTime: quote.startTime,
          endTime: quote.endTime,
          citation: quote.citation,
          timestampLink: quote.timestampLink,
          exported: quote.exported || false,
        },
        create: {
          id: quote.id,
          sourceId: quote.sourceId,
          text: quote.text,
          speaker: quote.speaker,
          startTime: quote.startTime,
          endTime: quote.endTime,
          citation: quote.citation,
          timestampLink: quote.timestampLink,
          exported: quote.exported || false,
          createdAt: new Date(quote.createdAt),
        }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving quotes to SQLite:', error);
    return NextResponse.json({ error: 'Failed to save quotes' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get('id');
    
    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID required' }, { status: 400 });
    }
    
    await prisma.quote.delete({ where: { id: quoteId } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting quote from SQLite:', error);
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}