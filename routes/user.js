import express from "express";
import User from "../models/User.js";
import Message from "../models/Message.js";

const router = express.Router();

// ======================
// Get User Profile & History
// ======================
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate("seenStories")
      .populate({
        path: "messageHistory",
        populate: { path: "sender receiver", select: "username" }
      })
      .populate("friends", "username online");

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Update Username
// ======================
router.put("/update/:userId", async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findById(req.params.userId);
    if (username) user.username = username;

    await user.save();
    res.json({ message: "Username updated", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Delete Message or History
// ======================
router.delete("/history/:userId/:messageId", async (req, res) => {
  try {
    const { userId, messageId } = req.params;
    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ message: "Message not found" });

    // Soft delete for this user
    if (!message.deletedBy.includes(userId)) message.deletedBy.push(userId);
    await message.save();

    res.json({ message: "Message deleted for user" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Get Offline Messages
// ======================
router.get("/offline-messages/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      receiver: userId,
      createdAt: { $lte: new Date() },
      deletedBy: { $ne: userId }
    }).populate("sender", "username");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// List Friends
// ======================
router.get("/friends/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("friends", "username online");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Add Friend
// ======================
router.post("/friends/:userId", async (req, res) => {
  try {
    const { friendId } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user.friends.includes(friendId)) user.friends.push(friendId);

    await user.save();
    res.json({ message: "Friend added", friends: user.friends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
