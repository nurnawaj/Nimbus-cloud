const jwt = require("jsonwebtoken");

// Protects routes: checks for a valid "Authorization: Bearer <token>" header
function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided. Please log in." });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id; // attach the logged-in user's id to the request
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token. Please log in again." });
  }
}

module.exports = requireAuth;
