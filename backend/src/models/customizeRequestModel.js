const mongoose = require('mongoose');

const customizeRequestSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    businessName: {
        type: String,
        required: true
    },
    businessType: {
        type: String,
        required: true
    },
    features: [{
        type: String
    }],
    platform: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['New', 'In Progress', 'Completed', 'Rejected'],
        default: 'New'
    }
}, {
    timestamps: true
});

const CustomizeRequest = mongoose.model('CustomizeRequest', customizeRequestSchema);

module.exports = CustomizeRequest;
