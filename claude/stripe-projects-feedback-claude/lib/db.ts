import { MongoClient, Db, Collection } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedback';
const DB_NAME = 'feedback_db';

interface Feedback {
  _id?: string;
  id: string;
  message: string;
  twitterHandle?: string;
  agent?: string;
  createdAt: Date;
  category?: string;
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function getFeedbackCollection(): Promise<Collection<Feedback>> {
  const { db } = await connectToDatabase();
  return db.collection<Feedback>('feedback');
}

async function getSummaryCollection(): Promise<Collection> {
  const { db } = await connectToDatabase();
  return db.collection('summaries');
}

export { connectToDatabase, getFeedbackCollection, getSummaryCollection };
export type { Feedback };
