import { NextRequest, NextResponse } from 'next/server';
import { getFeedbackCollection, getSummaryCollection } from '@/lib/db';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CategorySummary {
  category: string;
  description: string;
  count: number;
  examples: string[];
}

async function generateSummary(): Promise<CategorySummary[]> {
  const feedbackCollection = await getFeedbackCollection();

  // Get all feedback items
  const allFeedback = await feedbackCollection
    .find({})
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray();

  if (allFeedback.length === 0) {
    return [];
  }

  // Prepare feedback text for summarization
  const feedbackText = allFeedback
    .map((item: any) => item.message)
    .join('\n---\n');

  // Use OpenAI to categorize and summarize
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at categorizing user feedback about software features and improvements.
          Analyze the provided feedback and:
          1. Identify the top 10 most common themes/categories of feedback
          2. For each category, provide a clear name and brief description
          3. Count how many feedback items belong to each category
          4. Provide 2-3 representative examples for each category

          Return the response as a JSON array with objects containing: category, description, count, examples (array of 2-3 strings)`,
        },
        {
          role: 'user',
          content: `Categorize this feedback:\n\n${feedbackText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return [];
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const categories = JSON.parse(jsonMatch[0]) as CategorySummary[];

    // Update categories in feedback items
    for (const category of categories) {
      for (const example of category.examples) {
        const feedbackItem = allFeedback.find((item: any) =>
          item.message.includes(example.substring(0, 50))
        );
        if (feedbackItem) {
          await feedbackCollection.updateOne(
            { _id: feedbackItem._id },
            { $set: { category: category.category } }
          );
        }
      }
    }

    // Store summary
    const summaryCollection = await getSummaryCollection();
    await summaryCollection.updateOne(
      { _id: 'latest' },
      {
        $set: {
          categories,
          generatedAt: new Date(),
          totalFeedback: allFeedback.length,
        },
      },
      { upsert: true }
    );

    return categories;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const summaryCollection = await getSummaryCollection();
    const summary = await summaryCollection.findOne({ _id: 'latest' });

    if (!summary) {
      // Generate new summary if not exists
      const newSummary = await generateSummary();
      return NextResponse.json({
        categories: newSummary,
        generatedAt: new Date(),
      });
    }

    // Check if summary is older than 1 hour
    const isOld =
      new Date().getTime() - new Date(summary.generatedAt).getTime() >
      3600000;

    if (isOld) {
      const newSummary = await generateSummary();
      return NextResponse.json({
        categories: newSummary,
        generatedAt: new Date(),
      });
    }

    return NextResponse.json({
      categories: summary.categories,
      generatedAt: summary.generatedAt,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary', categories: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const summary = await generateSummary();
    return NextResponse.json({
      categories: summary,
      generatedAt: new Date(),
      message: 'Summary regenerated',
    });
  } catch (error) {
    console.error('Error regenerating summary:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate summary' },
      { status: 500 }
    );
  }
}
