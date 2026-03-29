// In-memory database for Stripe Projects Feedback
// Uses in-memory storage that works on Vercel
// Can be replaced with Chroma, MongoDB, or Supabase later

interface Feedback {
  id: string;
  message: string;
  twitterHandle?: string;
  agent?: string;
  createdAt: Date;
  category?: string;
}

interface Summary {
  _id: string;
  categories: Array<{
    category: string;
    description: string;
    count: number;
    examples: string[];
  }>;
  generatedAt: Date;
  totalFeedback: number;
}

// In-memory collections
let feedbackItems: Feedback[] = [];
let summaries: Summary[] = [];

class FeedbackCollection {
  async insertOne(doc: Feedback) {
    feedbackItems.push(doc);
    return { insertedId: doc.id };
  }

  async find(filter: any = {}) {
    return {
      sort: (sort: any) => ({
        skip: (n: number) => ({
          limit: (limit: number) => ({
            toArray: async () => {
              let items = [...feedbackItems];
              // Sort by createdAt descending if requested
              if (sort.createdAt === -1) {
                items.sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                );
              }
              return items.slice(n, n + limit);
            },
          }),
        }),
      }),
    };
  }

  async countDocuments() {
    return feedbackItems.length;
  }

  async updateOne(filter: any, update: any) {
    const item = feedbackItems.find((f) => f.id === filter.id);
    if (item) {
      Object.assign(item, update.$set);
    }
  }
}

class SummaryCollection {
  async findOne(filter: any) {
    return summaries.find((s) => s._id === filter._id);
  }

  async updateOne(filter: any, update: any, options: any = {}) {
    let doc = summaries.find((s) => s._id === filter._id);
    if (!doc && options.upsert) {
      doc = {
        _id: filter._id,
        categories: [],
        generatedAt: new Date(),
        totalFeedback: 0,
      };
      summaries.push(doc);
    }
    if (doc) {
      Object.assign(doc, update.$set);
    }
  }

  async find(filter: any = {}) {
    return {
      toArray: async () => summaries,
    };
  }
}

async function getFeedbackCollection(): Promise<any> {
  return new FeedbackCollection();
}

async function getSummaryCollection(): Promise<any> {
  return new SummaryCollection();
}

// Utility function to get all data (for debugging)
async function getAllData() {
  return {
    feedback: feedbackItems,
    summaries: summaries,
  };
}

export { getFeedbackCollection, getSummaryCollection, getAllData };
export type { Feedback, Summary };
