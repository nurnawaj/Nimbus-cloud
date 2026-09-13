// Vercel auto-detects any file under /api as a Serverless Function.
// This one just re-exports the real Express app defined in server.js at
// the project root, so all the actual route/middleware code stays in one
// place instead of being duplicated.
module.exports = require("../server");
