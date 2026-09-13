const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");
const requireAuth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

// Files are received in memory first, then streamed into MongoDB GridFS.
// GridFS automatically splits files into chunks and stores them in the
// "uploads.files" / "uploads.chunks" collections inside your Atlas cluster —
// that IS the "cloud storage" part, no third-party file host needed.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file, adjust as you like
});

function getBucket() {
  return new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
}

function filesCollection() {
  return mongoose.connection.db.collection("uploads.files");
}

const MAX_STORAGE_BYTES = (parseInt(process.env.MAX_STORAGE_MB) || 1024) * 1024 * 1024;

// Types the browser can preview inline instead of only downloading
const PREVIEWABLE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "application/pdf"];

function toFileDTO(f) {
  return {
    id: f._id,
    name: f.filename,
    size: f.length,
    type: f.contentType,
    uploadDate: f.uploadDate,
    folder: (f.metadata && f.metadata.folder) || null,
    previewable: PREVIEWABLE_TYPES.includes(f.contentType),
    shared: !!(f.metadata && f.metadata.shareToken),
  };
}

// POST /api/files/upload  (multipart form: "file", optional "folderId")
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file was attached." });
    }

    const user = await User.findById(req.userId);
    if (user.storageUsed + req.file.size > MAX_STORAGE_BYTES) {
      return res.status(400).json({ message: "Storage quota exceeded." });
    }

    const folderId = req.body.folderId || null;

    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { owner: req.userId, folder: folderId },
    });

    uploadStream.end(req.file.buffer);

    uploadStream.on("finish", async () => {
      user.storageUsed += req.file.size;
      await user.save();
      res.status(201).json({ message: "File uploaded successfully." });
    });

    uploadStream.on("error", (err) => {
      console.error(err);
      res.status(500).json({ message: "Error uploading file." });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during upload." });
  }
});

// GET /api/files?folderId=<id>&q=<search text>
// - No folderId -> root-level files. q, if present, searches ALL of the
//   user's files by name regardless of folder.
router.get("/", requireAuth, async (req, res) => {
  try {
    const { folderId, q } = req.query;
    const query = { "metadata.owner": req.userId };

    if (q && q.trim()) {
      query.filename = { $regex: q.trim(), $options: "i" };
    } else {
      query["metadata.folder"] = folderId || null;
    }

    const files = await filesCollection().find(query).sort({ uploadDate: -1 }).toArray();
    res.json({ files: files.map(toFileDTO) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching files." });
  }
});

// GET /api/files/storage — how much of the quota the user has used
router.get("/storage", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ used: user.storageUsed, max: MAX_STORAGE_BYTES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

// Shared helper: fetch a file doc the current user owns, or send a 404
async function findOwnedFile(req, res) {
  const fileId = new ObjectId(req.params.id);
  const file = await filesCollection().findOne({ _id: fileId, "metadata.owner": req.userId });
  if (!file) {
    res.status(404).json({ message: "File not found." });
    return null;
  }
  return file;
}

// GET /api/files/:id/download — forces a "Save As" download
router.get("/:id/download", requireAuth, async (req, res) => {
  try {
    const file = await findOwnedFile(req, res);
    if (!file) return;

    res.set("Content-Type", file.contentType || "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    getBucket().openDownloadStream(file._id).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error downloading file." });
  }
});

// GET /api/files/:id/preview — streams the file inline (for the preview modal)
router.get("/:id/preview", requireAuth, async (req, res) => {
  try {
    const file = await findOwnedFile(req, res);
    if (!file) return;

    res.set("Content-Type", file.contentType || "application/octet-stream");
    res.set("Content-Disposition", "inline");
    getBucket().openDownloadStream(file._id).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error loading preview." });
  }
});

// PATCH /api/files/:id — rename a file
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "File name is required." });
    }

    const file = await findOwnedFile(req, res);
    if (!file) return;

    await filesCollection().updateOne({ _id: file._id }, { $set: { filename: name.trim() } });
    res.json({ message: "File renamed." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error renaming file." });
  }
});

// DELETE /api/files/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const file = await findOwnedFile(req, res);
    if (!file) return;

    await getBucket().delete(file._id);

    const user = await User.findById(req.userId);
    user.storageUsed = Math.max(0, user.storageUsed - file.length);
    await user.save();

    res.json({ message: "File deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deleting file." });
  }
});

// ---------- Sharing ----------
// POST /api/files/:id/share  body: { expiresInHours }  (optional, default = no expiry)
// Creates (or refreshes) a public share link for this file.
router.post("/:id/share", requireAuth, async (req, res) => {
  try {
    const file = await findOwnedFile(req, res);
    if (!file) return;

    const token = crypto.randomBytes(16).toString("hex");
    const expiresInHours = parseInt(req.body.expiresInHours);
    const shareExpires = expiresInHours ? new Date(Date.now() + expiresInHours * 3600 * 1000) : null;

    await filesCollection().updateOne(
      { _id: file._id },
      { $set: { "metadata.shareToken": token, "metadata.shareExpires": shareExpires } }
    );

    res.json({ token, shareUrl: `${req.protocol}://${req.get("host")}/share.html?token=${token}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating share link." });
  }
});

// DELETE /api/files/:id/share — revoke an existing share link
router.delete("/:id/share", requireAuth, async (req, res) => {
  try {
    const file = await findOwnedFile(req, res);
    if (!file) return;

    await filesCollection().updateOne(
      { _id: file._id },
      { $unset: { "metadata.shareToken": "", "metadata.shareExpires": "" } }
    );

    res.json({ message: "Share link revoked." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error revoking share link." });
  }
});

module.exports = router;
