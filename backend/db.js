import dotenv from 'dotenv';
dotenv.config();

import { MongoClient } from 'mongodb';

const {
  MONGOUSER,
  MONGOPASSWORD,
  MONGOHOST,
  MONGOPORT,
} = process.env;

// Construct connection URI
const uri = `mongodb://${MONGOUSER}:${encodeURIComponent(MONGOPASSWORD)}@${MONGOHOST}:${MONGOPORT}/vaccination_tracker`;
console.log(uri)
// Create a single MongoClient instance
const client = new MongoClient(uri, {
  maxPoolSize: 10, // Adjust based on your needs
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000
});

let db;

export async function connectDB() {
  if (!db) {
    try {
      await client.connect();
      db = client.db('vaccination_tracker');
      console.log('MongoDB connected successfully');
      return db;
    } catch (err) {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    }
  }
  return db;
}

// Export the database instance
export function getDB() {
  if (!db) throw new Error('Database not initialized!');
  return db;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing MongoDB connection');
  await client.close();
});