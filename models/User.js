const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // stored as a bcrypt hash
    storageUsed: { type: Number, default: 0 }, // bytes used, kept in sync on upload/delete
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
