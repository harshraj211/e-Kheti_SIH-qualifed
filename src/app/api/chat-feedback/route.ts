import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase, isMongoConfigured } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/server-session';

export const runtime = 'nodejs';

const feedbackSchema = z.object({
  messageId: z.string().min(1).max(100),
  conversationId: z.string().min(1).max(100),
  rating: z.enum(['helpful', 'not_helpful']),
  question: z.string().min(1).max(10_000),
  answer: z.string().min(1).max(30_000),
  createdAt: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isMongoConfigured()) {
    return NextResponse.json({ saved: false, storage: 'browser' });
  }
  try {
    const feedback = feedbackSchema.parse(await request.json());
    const userId = user.id;
    const database = await getDatabase();
    await database.collection('chat_feedback').updateOne(
      { userId, messageId: feedback.messageId },
      { $set: { ...feedback, userId, createdAt: new Date(feedback.createdAt), updatedAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ saved: true, storage: 'mongodb' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid feedback.', issues: error.issues }, { status: 400 });
    }
    console.error('Failed to save chat feedback:', error);
    return NextResponse.json({ error: 'Database is temporarily unavailable.' }, { status: 503 });
  }
}
