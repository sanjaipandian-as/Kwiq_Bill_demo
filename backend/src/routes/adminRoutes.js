const express = require('express');
const router = express.Router();
const { 
    getAllUsers, 
    updateUserPlan, 
    toggleUserBlock, 
    inviteUser,
    getAuditLogs,
    getRevenueStats,
    getSystemMetrics,
    createBroadcast,
    getBroadcasts,
    triggerBackup,
    getBackups,
    generateAdminResetCode
} = require('../controllers/adminController');

// All routes are protected via adminKey check inside the controller for now.
router.get('/users', getAllUsers);
router.put('/users/:id/plan', updateUserPlan);
router.put('/users/:id/block', toggleUserBlock);
router.post('/users/invite', inviteUser);
router.get('/logs', getAuditLogs);
router.get('/revenue', getRevenueStats);
router.get('/system/metrics', getSystemMetrics);
router.post('/broadcast', createBroadcast);
router.get('/broadcast', getBroadcasts);
router.post('/backup', triggerBackup);
router.get('/backup', getBackups);
router.post('/security/admin/generate-reset-code/:userId', generateAdminResetCode);

module.exports = router;
