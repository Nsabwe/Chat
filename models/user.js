// models/User.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    online: {
      type: Boolean,
      default: false,
    },
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    seenStories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Story", // assuming you have a Story model
      },
    ],
    messageHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const User = model("User", userSchema);

export default User;
