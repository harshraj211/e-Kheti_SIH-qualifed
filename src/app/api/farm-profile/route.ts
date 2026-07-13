import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase, isMongoConfigured } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/server-session';

export const runtime = 'nodejs';

const nutrientLevel = z.enum(['', 'low', 'medium', 'high']);
const profileSchema = z.object({
  farmerName: z.string().max(100),
  location: z.string().min(2).max(160),
  acreage: z.string().max(30),
  crop: z.string().min(2).max(100),
  variety: z.string().max(100),
  sowingDate: z.string().max(30),
  cropStage: z.string().max(100),
  irrigationMethod: z.string().max(100),
  soilType: z.string().max(100),
  soilPh: z.string().max(20),
  nitrogen: nutrientLevel,
  phosphorus: nutrientLevel,
  potassium: nutrientLevel,
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isMongoConfigured()) {
    return NextResponse.json({ profile: null, storage: 'browser' });
  }
  try {
    const database = await getDatabase();
    const profile = await database.collection('farm_profiles').findOne(
      { userId: user.id },
      { projection: { _id: 0, userId: 0, createdAt: 0, updatedAt: 0 } },
    );
    return NextResponse.json({ profile, storage: 'mongodb' });
  } catch (error) {
    console.error('Failed to read farm profile:', error);
    return NextResponse.json({ error: 'Database is temporarily unavailable.' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isMongoConfigured()) {
    return NextResponse.json({ saved: false, storage: 'browser' });
  }
  try {
    const profile = profileSchema.parse(await request.json());
    const database = await getDatabase();
    const now = new Date();
    await database.collection('farm_profiles').updateOne(
      { userId: user.id },
      {
        $set: { ...profile, updatedAt: now },
        $setOnInsert: { userId: user.id, createdAt: now },
      },
      { upsert: true },
    );
    return NextResponse.json({ saved: true, storage: 'mongodb' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid farm profile.', issues: error.issues }, { status: 400 });
    }
    console.error('Failed to save farm profile:', error);
    return NextResponse.json({ error: 'Database is temporarily unavailable.' }, { status: 503 });
  }
}
