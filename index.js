import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";

// Import routes
import userRoutes from "./routes/user.js";
import messageRoutes from "./routes/message.js";
import storyRoutes from "./routes/story.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// ======================
// Middleware
// ======================
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads")); // serve media files

// ======================
// Routes
// ======================
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/stories", storyRoutes);

// ======================
// Socket.IO for Real-Time
// ======================
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // User comes online
  socket.on("user-online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("update-online-status", Array.from(onlineUsers.keys())); // update everyone
  });

  // Send message in real-time
  socket.on("send-message", (message) => {
    const receiverSocket = onlineUsers.get(message.receiver);
    if (receiverSocket) {
      io.to(receiverSocket).emit("receive-message", message);
    }
  });

  // User disconnects
  socket.on("disconnect", () => {
    for (let [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) onlineUsers.delete(userId);
    }
    io.emit("update-online-status", Array.from(onlineUsers.keys()));
    console.log("User disconnected:", socket.id);
  });
});

// ======================
// Connect to MongoDB
// ======================
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("MongoDB connected");
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
.catch((err) => console.log(err));