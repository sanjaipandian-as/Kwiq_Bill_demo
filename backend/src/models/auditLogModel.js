const mongoose = require('mongoose');

const auditLogSchema = mongoose.Schema({
    adminId: {
        type: String,
        required: true,
        default: 'SYSTEM'
    },
    action: {
        type: String,
        required: true
    },
    targetType: {
        type: String,
        required: true
    },
    targetId: {
        type: String
    },
    details: {
        type: String
    },
    status: {
        type: String,
        default: 'success'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
