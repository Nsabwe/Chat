import express from "express";
import Story from "../models/Story.js";
import User from "../models/User.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/stories"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ======================
// Create / Upload Story
// ======================
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { userId, content, type } = req.body;
    const fileContent = req.file ? `/uploads/stories/${req.file.filename}` : content;

    const story = new Story({ user: userId, content: fileContent, type });
    await story.save();

    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Like a Story
// ======================
router.post("/like/:storyId", async (req, res) => {
  try {
    const { userId } = req.body;
    const story = await Story.findById(req.params.storyId);

    if (!story.likes.includes(userId)) story.likes.push(userId);
    else story.likes = story.likes.filter(id => id.toString() !== userId);

    await story.save();
    res.json({ likes: story.likes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Comment on Story
// ======================
router.post("/comment/:storyId", async (req, res) => {
  try {
    const { userId, text, emoji } = req.body;
    const story = await Story.findById(req.params.storyId);

    story.comments.push({ user: userId, text, emoji });
    await story.save();

    res.json(story.comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Update Story
// ======================
router.put("/:storyId", async (req, res) => {
  try {
    const { content, type } = req.body;
    const story = await Story.findById(req.params.storyId);

    if (content) story.content = content;
    if (type) story.type = type;

    await story.save();
    res.json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Delete Story
// ======================
router.delete("/:storyId", async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    if (story.type !== "text" && fs.existsSync(path.join(".", story.content))) {
      fs.unlinkSync(path.join(".", story.content));
    }
    await story.remove();
    res.json({ message: "Story deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Mark as Seen
// ======================
router.post("/seen/:storyId", async (req, res) => {
  try {
    const { userId } = req.body;
    const story = await Story.findById(req.params.storyId);

    if (!story.viewers.includes(userId)) story.viewers.push(userId);
    await story.save();

    res.json({ viewers: story.viewers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Get Story Details (full)
// ======================
router.get("/:storyId", async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate("user", "username online")
      .populate("comments.user", "username");
    res.json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Get Users who viewed a story
// ======================
router.get("/viewers/:storyId", async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId).populate("viewers", "username online");
    res.json(story.viewers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
