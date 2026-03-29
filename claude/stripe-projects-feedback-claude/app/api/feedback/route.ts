import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getFeedbackCollection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, twitterHandle, agent } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const collection = await getFeedbackCollection();

    const feedback = {
      id: uuidv4(),
      message: message.trim(),
      twitterHandle: twitterHandle?.trim() || null,
      agent: agent?.trim() || null,
      createdAt: new Date(),
      category: null, // Will be set by summarization service
    };

    await collection.insertOne(feedback as any);

    return NextResponse.json(
      { id: feedback.id, message: 'Feedback submitted successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 100;
    const skip = (page - 1) * limit;

    const collection = await getFeedbackCollection();

    const [items, total] = await Promise.all([
      collection
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(),
    ]);

    const feedback = items.map((item: any) => ({
      id: item.id,
      message: item.message,
      twitterHandle: item.twitterHandle,
      agent: item.agent,
      category: item.category,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({
      items: feedback,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
