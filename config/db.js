const mongoose = require("mongoose");

// On a traditional server, we connect once at startup and stay connected
// forever. On Vercel, each request may hit a fresh serverless "cold start"
// with no existing connection, so we cache the connection and reuse it
// across invocations instead of reconnecting every time.
let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log("✅ MongoDB Atlas connected:", mongoose.connection.host);
  } catch (err) {
    isConnected = false;
    console.error("❌ MongoDB connection error:", err.message);

    // On your own machine / Render / Railway, it's fine to crash immediately
    // if the database is unreachable. On Vercel, process.exit() inside a
    // serverless function just produces a confusing crash on every request
    // instead of a clean error — so there we throw and let the route handler
    // return a proper 500 with a real message.
    if (!process.env.VERCEL) process.exit(1);
    throw err;
  }
}

module.exports = connectDB;
