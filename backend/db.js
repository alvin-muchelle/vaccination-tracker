import dotenv from 'dotenv';
import { MongoClient } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI;
let db;

const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: false,
});

export async function connectDB() {
  try {
    if (!db) {  // Only connect if not already connected
      await client.connect();
      console.log("MongoDB connected!");
      db = client.db();
    }
    return db;
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) throw new Error('Database not initialized! Call connectDB() first!');
  return db;
}