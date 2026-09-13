const express = require("express");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

const router = express.Router();

function getBucket() {
  return new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
}

function filesCollection() {
  return mongoose.connection.db.collection("uploads.files");
}

// Looks up a file by its public share token and checks it hasn't expired.
async function findSharedFile(token) {
  const file = await filesCollection().findOne({ "metadata.shareToken": token });
  if (!file) return null;

  const expires = file.metadata && file.metadata.shareExpires;
  if (expires && new Date(expires) < new Date()) return null;

  return file;
}

// GET /api/share/:token — metadata only, used by share.html to render the page
router.get("/:token", async (req, res) => {
  const file = await findSharedFile(req.params.token);
  if (!file) return res.status(404).json({ message: "This link is invalid or has expired." });

  res.json({
    name: file.filename,
    size: file.length,
    type: file.contentType,
    previewable: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "application/pdf"].includes(
      file.contentType
    ),
  });
});

// GET /api/share/:token/download
router.get("/:token/download", async (req, res) => {
  const file = await findSharedFile(req.params.token);
  if (!file) return res.status(404).json({ message: "This link is invalid or has expired." });

  res.set("Content-Type", file.contentType || "application/octet-stream");
  res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
  getBucket().openDownloadStream(file._id).pipe(res);
});

// GET /api/share/:token/preview
router.get("/:token/preview", async (req, res) => {
  const file = await findSharedFile(req.params.token);
  if (!file) return res.status(404).json({ message: "This link is invalid or has expired." });

  res.set("Content-Type", file.contentType || "application/octet-stream");
  res.set("Content-Disposition", "inline");
  getBucket().openDownloadStream(file._id).pipe(res);
});

module.exports = router;
