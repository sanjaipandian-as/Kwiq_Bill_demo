const mongoose = require('mongoose');

const backupSchema = mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    size: {
        type: String
    },
    status: {
        type: String, // success, failed
        default: 'success'
    },
    type: {
        type: String, // manual, automated
        default: 'manual'
    },
    cloudProvider: {
        type: String,
        default: 'Google Drive'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Backup', backupSchema);
