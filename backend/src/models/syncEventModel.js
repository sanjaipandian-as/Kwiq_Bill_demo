const mongoose = require('mongoose');

const syncEventSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    eventId: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String, // e.g., 'INVOICE_CREATED', 'PRODUCT_UPDATED'
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed, // Storing the actual data
        required: true
    },
    deviceId: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for fast syncing by user and date
syncEventSchema.index({ user: 1, createdAt: 1 });

module.exports = mongoose.model('SyncEvent', syncEventSchema);
