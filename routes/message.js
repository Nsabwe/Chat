import express from "express";
import Message from "../models/Message.js";
import { sendNotification } from "./notification.js"; // for push notifications
const router = express.Router();

// Send a message
router.post("/send", async (req, res) => {
  try {
    const { sender, receiver, text, media } = req.body;
    const message = new Message({ sender, receiver, text, media });
    await message.save();

    // Trigger push notification
    await sendNotification(receiver, {
      title: "New Message",
      body: text ? text : "Sent a media message",
      url: "/private-chat"
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages between two users (private chat)
router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ createdAt: 1 }); // oldest first
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a message
router.delete("/:id", async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully", data: message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
