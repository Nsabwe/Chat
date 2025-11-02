import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import zlib from "zlib";

// -------------------- USER SCHEMA --------------------
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  gender:    { type: String, enum: ["Male", "Female"], required: true },
  phone:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Hash password automatically before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password on login
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

export const User = mongoose.model("User", userSchema);

// -------------------- MESSAGE SCHEMA --------------------
const messageSchema = new mongoose.Schema({
  sender: String,
  receiver: String, // null = public
  content: String,
  voiceData: Buffer, // compressed binary
  timestamp: { type: Date, default: Date.now }
});

export const Message = mongoose.model("Message", messageSchema);

// -------------------- DATABASE CONNECTION --------------------
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "clchat",
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB Atlas connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
};

// -------------------- AUDIO UTILITIES --------------------
export const compressAudio = (base64) => {
  const buffer = Buffer.from(base64, "base64"); // convert to binary
  return zlib.deflateSync(buffer);               // compress
};

export const decompressAudio = (buffer) => {
  const decompressed = zlib.inflateSync(buffer);
  return decompressed.toString("base64");        // back to base64 for frontend
};