const mongoose = require('mongoose');

const securityBackupSchema = new mongoose.Schema({
  user: {
     type: mongoose.Schema.Types.ObjectId,
     ref: 'User',
     required: true,
     unique: true
  },
  encryptedMasterKeyBackup: {
    type: String,
    required: false
  },
  recoveryEmail: { // Secondary Channel
     type: String,
     default: null
  },
  recoveryPhone: { // Secondary Channel
     type: String,
     default: null
  },
  // Self-service OTP (initiated by user via mobile app)
  otpHash: {
     type: String,
     default: null
  },
  otpExpiresAt: {
     type: Date,
     default: null
  },
  failedOtpAttempts: {
     type: Number,
     default: 0
  },
  // Admin-generated override code (initiated by admin dashboard)
  adminOtpHash: {
     type: String,
     default: null
  },
  adminOtpExpiresAt: {
     type: Date,
     default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('SecurityBackup', securityBackupSchema);
