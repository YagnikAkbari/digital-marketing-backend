const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // Ensure uniqueness of email addresses
  },
  subscribedAt: {
    type: Date,
    default: Date.now, // Store the subscription date
  },
});

const Subscriber = mongoose.model("Subscriber", subscriberSchema);

module.exports = Subscriber;
