const express = require('express');
const router = express.Router();
const { backupKey, initiateRecovery, recoverKey, auditSecurityEvent, generateAdminResetCode } = require('../controllers/securityController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/backup-key', protect, backupKey);
router.post('/initiate-recovery', protect, initiateRecovery);
router.post('/recover', recoverKey); // Public: OTP is the auth factor — user is locked out and has no token
router.post('/audit', protect, auditSecurityEvent);

// Admin-only: generate a manual override reset code for a specific user
router.post('/admin/generate-reset-code/:userId', protect, admin, generateAdminResetCode);

module.exports = router;
