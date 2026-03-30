const mongoose = require('mongoose');

const paymentSchema = mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    paymentId: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['created', 'pending', 'paid', 'failed'],
        default: 'created'
    },
    email: {
        type: String,
        default: 'anonymous'
    },
    receiptId: {
        type: String
    },
    description: {
        type: String
    },
    verificationAttempts: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
