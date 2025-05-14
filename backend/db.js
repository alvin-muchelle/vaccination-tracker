import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ MONGODB_URI is not set!");
  process.exit(1);
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,                  // ensure TLS
  tlsAllowInvalidCertificates: false,
});

export async function connectDB() {
  try {
    await client.connect(); 
    console.log("✅ MongoDB connected!");
    return client.db();   
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
