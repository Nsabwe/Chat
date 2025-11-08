import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

// Models
import User from "./models/user.js";
import Message from "./models/message.js";
import Story from "./models/story.js";
import Post from "./models/post.js";
import Notification from "./models/notification.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// === File uploads setup ===
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// === MongoDB connection ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

// === SOCKET.IO ===
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("joinRoom", async ({ room, user }) => {
    socket.join(room);
    socket.data.user = user;

    await User.findOneAndUpdate(
      { username: user },
      { online: true, lastSeen: new Date() },
      { upsert: true }
    );

    io.emit("userStatus", { user, online: true });

    const messages = await Message.find({ room }).sort({ time: 1 }).limit(50);
    socket.emit("previousMessages", messages);
  });

  socket.on("sendMessage", async (data) => {
    const msg = new Message(data);
    await msg.save();

    if (data.receiver) {
      await new Notification({
        user: data.receiver,
        type: "message",
        sender: data.sender,
        content: data.text || "Sent you a file",
      }).save();
    }

    io.to(data.room).emit("newMessage", msg);
  });

  socket.on("typing", ({ room, user, isTyping }) => {
    socket.to(room).emit("displayTyping", { user, isTyping });
  });

  socket.on("markSeen", async ({ room, user }) => {
    await Message.updateMany(
      { room, receiver: user, seen: false },
      { $set: { seen: true, delivered: true } }
    );
    io.to(room).emit("messagesSeen", { user });
  });

  socket.on("deleteMessage", async ({ messageId, user }) => {
    const msg = await Message.findById(messageId);
    if (msg && msg.sender === user) {
      await msg.deleteOne();
      io.to(msg.room).emit("messageDeleted", { messageId });
    }
  });

  socket.on("disconnect", async () => {
    const user = socket.data.user;
    if (user) {
      await User.findOneAndUpdate(
        { username: user },
        { online: false, lastSeen: new Date() }
      );
      io.emit("userStatus", { user, online: false, lastSeen: new Date() });
    }
    console.log("🔴 User disconnected:", user);
  });
});

// === AUTH ROUTES ===

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { firstName, lastName, phone, password, gender } = req.body;
    const existingUser = await User.findOne({ phone });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      phone,
      password: hashedPassword,
      gender,
      online: false,
    });

    await newUser.save();
    res.status(201).json({ name: `${firstName} ${lastName}`, phone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: "Invalid phone or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid phone or password" });

    res.status(200).json({ name: `${user.firstName} ${user.lastName}`, phone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// === FILE UPLOADS ===
app.post("/upload", upload.single("voice"), (req, res) => {
  res.json({ url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` });
});

// Profile management
app.post("/profile", upload.single("image"), async (req, res) => {
  const username = req.query.user || "unknown";
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  await User.findOneAndUpdate({ username }, { profileUrl: url }, { upsert: true });
  res.json({ url });
});

app.delete("/profile", async (req, res) => {
  const username = req.query.user;
  await User.findOneAndUpdate({ username }, { profileUrl: "" });
  res.json({ success: true });
});

// === STORIES ===
app.post("/storyUpload", upload.single("story"), async (req, res) => {
  const user = req.query.user;
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  await new Story({ user, imageUrl }).save();
  res.json({ success: true, imageUrl });
});

app.get("/stories", async (req, res) => {
  const stories = await Story.find().sort({ createdAt: -1 });
  res.json(stories);
});

app.post("/story/view", async (req, res) => {
  const { storyId, viewer } = req.body;
  const story = await Story.findById(storyId);
  if (story && !story.viewers.includes(viewer)) {
    story.viewers.push(viewer);
    await story.save();

    await new Notification({
      user: story.user,
      type: "storyView",
      sender: viewer,
      content: "Viewed your story"
    }).save();
  }
  res.json({ viewers: story.viewers });
});

// === POSTS ===
app.post("/publicPost", upload.single("image"), async (req, res) => {
  const { user, text } = req.body;
  const imageUrl = req.file ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` : "";
  const post = new Post({ user, text, imageUrl });
  await post.save();
  res.json({ success: true, post });
});

app.post("/post/like", async (req, res) => {
  const { postId, username } = req.body;
  const post = await Post.findById(postId);
  if (post && !post.likes.includes(username)) {
    post.likes.push(username);
    await post.save();
    await new Notification({
      user: post.user,
      type: "like",
      sender: username,
      content: "Liked your post"
    }).save();
  }
  res.json({ likes: post.likes });
});

app.post("/post/comment", async (req, res) => {
  const { postId, username, text } = req.body;
  const post = await Post.findById(postId);
  post.comments.push({ user: username, text });
  await post.save();
  await new Notification({
    user: post.user,
    type: "comment",
    sender: username,
    content: text
  }).save();
  res.json({ comments: post.comments });
});

// === NOTIFICATIONS ===
app.get("/notifications/:user", async (req, res) => {
  const notifications = await Notification.find({ user: req.params.user }).sort({ createdAt: -1 });
  res.json(notifications);
});

// === ONLINE USERS ===
app.get("/onlineUsers", async (req, res) => {
  const users = await User.find({ online: true });
  res.json(users);
});

// === START SERVER ===
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));