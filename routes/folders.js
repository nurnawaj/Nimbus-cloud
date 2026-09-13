const express = require("express");
const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");
const requireAuth = require("../middleware/auth");
const Folder = require("../models/Folder");
const User = require("../models/User");

const router = express.Router();

function getBucket() {
  return new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
}

// POST /api/folders — create a new folder
// body: { name, parentId }  (parentId omitted/null = create at root)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Folder name is required." });
    }

    if (parentId) {
      const parent = await Folder.findOne({ _id: parentId, owner: req.userId });
      if (!parent) return res.status(404).json({ message: "Parent folder not found." });
    }

    const folder = await Folder.create({
      name: name.trim(),
      owner: req.userId,
      parent: parentId || null,
    });

    res.status(201).json({ folder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating folder." });
  }
});

// GET /api/folders?parent=<id>  — list subfolders of a folder (omit "parent" for root)
router.get("/", requireAuth, async (req, res) => {
  try {
    const parentId = req.query.parent || null;
    const folders = await Folder.find({ owner: req.userId, parent: parentId }).sort({ name: 1 });
    res.json({ folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error listing folders." });
  }
});

// GET /api/folders/:id/path — breadcrumb chain from root down to this folder
router.get("/:id/path", requireAuth, async (req, res) => {
  try {
    const chain = [];
    let current = await Folder.findOne({ _id: req.params.id, owner: req.userId });

    if (!current) return res.status(404).json({ message: "Folder not found." });

    while (current) {
      chain.unshift({ id: current._id, name: current.name });
      if (!current.parent) break;
      current = await Folder.findOne({ _id: current.parent, owner: req.userId });
    }

    res.json({ path: chain });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error building folder path." });
  }
});

// PATCH /api/folders/:id — rename a folder
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Folder name is required." });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { name: name.trim() },
      { new: true }
    );

    if (!folder) return res.status(404).json({ message: "Folder not found." });
    res.json({ folder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error renaming folder." });
  }
});

// DELETE /api/folders/:id — deletes the folder AND everything inside it
// (subfolders recursively, and every file stored in any of them)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const rootFolder = await Folder.findOne({ _id: req.params.id, owner: req.userId });
    if (!rootFolder) return res.status(404).json({ message: "Folder not found." });

    const bucket = getBucket();
    const filesCollection = mongoose.connection.db.collection("uploads.files");
    const user = await User.findById(req.userId);

    // Walk the folder tree collecting every folder id (BFS)
    const folderIds = [rootFolder._id];
    let queue = [rootFolder._id];
    while (queue.length) {
      const children = await Folder.find({ owner: req.userId, parent: { $in: queue } });
      const childIds = children.map((c) => c._id);
      folderIds.push(...childIds);
      queue = childIds;
    }

    // Delete every file that lives in any of those folders
    const filesToDelete = await filesCollection
      .find({ "metadata.owner": req.userId, "metadata.folder": { $in: folderIds.map(String) } })
      .toArray();

    for (const file of filesToDelete) {
      await bucket.delete(file._id);
      user.storageUsed = Math.max(0, user.storageUsed - file.length);
    }
    await user.save();

    await Folder.deleteMany({ _id: { $in: folderIds } });

    res.json({ message: "Folder and its contents deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deleting folder." });
  }
});

module.exports = router;
