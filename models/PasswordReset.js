const mongoose = require("mongoose");

const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true },
  userType: { type: String, enum: ['intern', 'employee', 'hr'], required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Automatically delete expired tokens after 5 minutes (using TTL index)
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasswordReset", PasswordResetSchema);
