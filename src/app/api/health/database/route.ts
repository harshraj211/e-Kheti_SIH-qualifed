import { NextResponse } from 'next/server';
import { getDatabase, isMongoConfigured } from '@/lib/mongodb';

export const runtime = 'nodejs';

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json({ configured: false, connected: false }, { status: 503 });
  }

  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return NextResponse.json({ configured: true, connected: true, database: database.databaseName });
  } catch (error) {
    console.error('MongoDB health check failed:', error);
    return NextResponse.json({ configured: true, connected: false }, { status: 503 });
  }
}
