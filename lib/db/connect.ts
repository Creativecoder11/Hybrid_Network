import mongoose from "mongoose";
// Registers every Mongoose model as soon as the DB layer is loaded, so any
// query anywhere can safely use populate() without each call site needing
// its own side-effect import of the referenced model.
import "@/models";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectDB() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Don't cache a failed connection attempt — clear it so the next call retries
    // instead of forever re-awaiting the same rejected promise.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
