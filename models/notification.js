// models/Notification.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true
    },
    body: {
      type: String
    },
    icon: {
      type: String
    },
    url: {
      type: String
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Notification = model("Notification", notificationSchema);

export default Notification;
