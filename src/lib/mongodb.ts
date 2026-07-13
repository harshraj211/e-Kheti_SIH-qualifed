import { Db, MongoClient } from 'mongodb';

const databaseName = process.env.MONGODB_DB || 'ekheti';

declare global {
  // eslint-disable-next-line no-var
  var __ekhetiMongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __ekhetiMongoClient: MongoClient | undefined;
}

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  if (!global.__ekhetiMongoClient) {
    global.__ekhetiMongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 8_000,
    });
  }
  return global.__ekhetiMongoClient;
}

function getClientPromise() {
  if (!global.__ekhetiMongoClientPromise) {
    const client = getMongoClient();
    global.__ekhetiMongoClientPromise = client.connect().catch(error => {
      global.__ekhetiMongoClientPromise = undefined;
      throw error;
    });
  }

  return global.__ekhetiMongoClientPromise;
}

export function getDatabaseHandle(): Db {
  return getMongoClient().db(databaseName);
}

export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(databaseName);
}

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI);
}
