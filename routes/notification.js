import webpush from "web-push";
import express from "express";
import User from "../models/User.js";

const router = express.Router();

// VAPID keys (generate with web-push)
const publicVapidKey = process.env.PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

webpush.setVapidDetails(
  "mailto:youremail@example.com",
  publicVapidKey,
  privateVapidKey
);

// ======================
// Save subscription for user
// ======================
router.post("/subscribe/:userId", async (req, res) => {
  const { userId } = req.params;
  const subscription = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.pushSubscription = subscription; // store subscription object
    await user.save();

    res.status(201).json({ message: "Subscribed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Send Notification
// ======================
export const sendNotification = async (userId, payload) => {
  try {
    const user = await User.findById(userId);
    if (!user?.pushSubscription) return;

    await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
  } catch (err) {
    console.log("Push notification error:", err.message);
  }
};

export default router;
