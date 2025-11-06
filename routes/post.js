import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Story from "../models/Story.js";

const router = express.Router();


// 🧱 CREATE A POST
router.post("/create", async (req, res) => {
  try {
    const { userId, text, media } = req.body;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    const post = new Post({
      user: userId,
      text,
      media,
      online: user.online, // store if user was online when posting
    });

    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔍 VIEW ALL POSTS
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "username profilePic online")
      .populate("comments.user", "username profilePic")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🗑️ DELETE POST
router.delete("/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const deleted = await Post.findByIdAndDelete(postId);
    if (!deleted) return res.status(404).json({ error: "Post not found" });
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 💬 COMMENT ON POST
router.post("/:postId/comment", async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, text } = req.body;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({ user: userId, text });
    await post.save();

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 📸 ADD STORY
router.post("/story", async (req, res) => {
  try {
    const { userId, media } = req.body;
    const story = new Story({ user: userId, media });
    await story.save();
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🖼️ ADD OR CHANGE PROFILE PICTURE
router.put("/profile-picture/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { profilePic } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePic },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "Profile picture updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
