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
  receiver: String, // null = public
  content: String,
  voiceData: String,
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// Online users
let users = {}; // { username: socketId }

// Socket.IO
io.on("connection", (socket) => {
  let currentUser = null;

  // User joins
  socket.on("user joined", async (username) => {
    currentUser = username;
    users[username] = socket.id;

    const messages = await Message.find().sort({ timestamp: 1 });
    socket.emit("chat history", messages);

    io.emit("users update", Object.keys(users));
    console.log(`👤 ${username} joined`);
  });

  // Send message
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
      // Private message
      [msg.receiver, msg.sender].forEach(u => {
        if (users[u]) io.to(users[u]).emit("receive message", outMsg);
      });
    } else {
      // Public message
      io.emit("receive message", outMsg);
    }
  });

  // Message delivered
  socket.on("message delivered", async (data) => {
    const { sender, timestamp } = data;

    // Update delivered status in DB
    const msg = await Message.findOne({ sender, timestamp });
    if (msg && !msg.delivered) {
      msg.delivered = true;
      await msg.save();
    }

    // Emit back to original sender
    if (users[sender]) {
      io.to(users[sender]).emit("message delivered", { timestamp });
    }
  });

  // Typing
  socket.on("typing", (data) => {
    if (data.receiver) {
      [data.receiver, data.sender].forEach(u => {
        if (users[u]) io.to(users[u]).emit("typing", data);
      });
    } else {
      socket.broadcast.emit("typing", data);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (currentUser) {
      delete users[currentUser];
      io.emit("users update", Object.keys(users));
      console.log(`❌ ${currentUser} disconnected`);
    }
  });
});

// REST API
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));