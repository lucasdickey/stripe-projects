import { NextRequest, NextResponse } from 'next/server';
import { getFeedbackCollection } from '@/lib/db';
import { OpenAI } from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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

    // Call OpenAI for response
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant discussing feedback about Stripe Projects improvements.
          You have access to recent feedback items from users and can discuss patterns, suggestions, and help users understand what others are asking for.
          Keep responses concise and focused on the Stripe Projects feedback context.`,
        },
        {
          role: 'user',
          content: `Recent feedback items:\n${feedbackSummary}\n\nUser question: ${message}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = response.choices[0].message.content;

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
