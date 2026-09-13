require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");
const folderRoutes = require("./routes/folders");
const shareRoutes = require("./routes/share");

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// On Vercel, there's no long-lived process keeping a DB connection open —
// every request potentially runs on a fresh serverless invocation. This
// makes sure a connection exists before any route touches the database.
// On a normal server it's a no-op after the first connectDB() call below.
app.use(async (req, res, next) => {
  if (!process.env.VERCEL) return next();

  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({
      message: "Database connection failed. Check MONGODB_URI in your Vercel project's Environment Variables.",
    });
  }
});

// --- API Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/share", shareRoutes); // public — no login required

// --- Serve the frontend (plain HTML/CSS/JS in /public) ---
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 5000;

// Vercel imports this file and calls the exported `app` directly for each
// request — it never runs app.listen(). Traditional hosts (Render, Railway,
// your own machine) DO need app.listen(), so only start it there.
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Cloud Drive server running at http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
