import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/clchat", {
  dbName: "clchat",
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection failed:", err.message));

// Schemas
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  gender: String,
  phone: { type: String, unique: true },
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  content: String,
  voiceData: String,
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// Online users
let users = {};

// Socket.IO
io.on("connection", (socket) => {
  let currentUser = null;

  socket.on("user joined", async (username) => {
    currentUser = username;
    users[username] = socket.id;

    const messages = await Message.find().sort({ timestamp: 1 });
    socket.emit("chat history", messages);

    io.emit("users update", Object.keys(users));
    console.log(`👤 ${username} joined`);
  });

  socket.on("send message", async (msg) => {
    const newMessage = new Message({
      sender: msg.sender,
      receiver: msg.receiver || null,
      content: msg.content || "",
      voiceData: msg.voiceData || ""
    });

    await newMessage.save();

    const outMsg = {
      sender: newMessage.sender,
      receiver: newMessage.receiver,
      content: newMessage.content,
      voiceData: newMessage.voiceData,
      timestamp: newMessage.timestamp
    };

    if (msg.receiver) {
      [msg.receiver, msg.sender].forEach(u => {
        if (users[u]) io.to(users[u]).emit("receive message", outMsg);
      });
    } else {
      io.emit("receive message", outMsg);
    }
  });

  socket.on("message delivered", async (data) => {
    const { sender, timestamp } = data;
    const msg = await Message.findOne({ sender, timestamp });
    if (msg && !msg.delivered) {
      msg.delivered = true;
      await msg.save();
    }
    if (users[sender]) {
      io.to(users[sender]).emit("message delivered", { timestamp });
    }
  });

  socket.on("typing", (data) => {
    if (data.receiver) {
      [data.receiver, data.sender].forEach(u => {
        if (users[u]) io.to(users[u]).emit("typing", data);
      });
    } else {
      socket.broadcast.emit("typing", data);
    }
  });

  socket.on("disconnect", () => {
    if (currentUser) {
      delete users[currentUser];
      io.emit("users update", Object.keys(users));
      console.log(`❌ ${currentUser} disconnected`);
    }
  });
});

// REST API - Messages
app.get("/api/messages", async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 });
  res.json(messages);
});

app.post("/api/messages", async (req, res) => {
  const { sender, receiver, content, voiceData } = req.body;
  const msg = new Message({ sender, receiver, content, voiceData });
  await msg.save();
  res.json(msg);
});

// REST API - Register
app.post("/api/register", async (req, res) => {
  try {
    const { firstName, lastName, gender, phone, password } = req.body;
    if (!firstName || !lastName || !gender || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "Phone already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ firstName, lastName, gender, phone, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// REST API - Login
app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: "Phone and password required" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: "Invalid phone or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid phone or password" });

    res.json({ name: `${user.firstName} ${user.lastName}`, phone: user.phone });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));