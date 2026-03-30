const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['BASIC', 'PRO'], default: 'BASIC' },
    startDate: { type: Date },
    endDate: { type: Date },
    isBlocked: { type: Boolean, default: false },
    status: { type: String, default: 'active' },
    deviceId: { type: String, default: 'N/A' },
    appVersion: { type: String, default: '1.0.0' },
    lastOnlineCheck: { type: Date },
    lastBackupDate: { type: Date }
}, { collection: 'subscriptions', timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
