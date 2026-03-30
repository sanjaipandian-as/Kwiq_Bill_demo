const mongoose = require('mongoose');

const broadcastSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    target: {
        type: String, // all, pro, trial
        default: 'all'
    },
    type: {
        type: String, // announcement, maintenance, critical
        default: 'announcement'
    },
    sentBy: {
        type: String,
        default: 'Admin'
    },
    recipientCount: {
        type: Number,
        default: 0
    },
    transmissionRate: {
        type: Number,
        default: 100 // Default to 100% since we send it globally
    },
    interactionRate: {
        type: Number,
        default: 0
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    expiryTime: {
        type: Date,
        default: null
    },
    priority: {
        type: String, // low, medium, high
        default: 'medium'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Broadcast', broadcastSchema);
