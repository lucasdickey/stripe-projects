import { NextRequest, NextResponse } from 'next/server';
import { getFeedbackCollection } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get relevant feedback for context
    const feedbackCollection = await getFeedbackCollection();
    const recentFeedback = await feedbackCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const feedbackSummary = recentFeedback
      .map((item: any) => `- ${item.message}${item.agent ? ` (Agent: ${item.agent})` : ''}`)
      .join('\n');

    // Call Anthropic Claude Haiku for response
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are a helpful assistant discussing feedback about Stripe Projects improvements. You have access to recent feedback items from users and can discuss patterns, suggestions, and help users understand what others are asking for. Keep responses concise and focused on the Stripe Projects feedback context.

Recent feedback items:
${feedbackSummary}

User question: ${message}`,
        },
      ],
    });

    const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : 'Unable to process response';

    return NextResponse.json({
      message: assistantMessage,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
