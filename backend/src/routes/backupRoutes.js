const express = require('express');
const router = express.Router();
const { 
    uploadEvent, 
    syncEvents, 
    getBackupStatus, 
    pushAllData 
} = require('../controllers/backupController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/event', uploadEvent);
router.post('/sync', syncEvents);
router.get('/status', getBackupStatus);
router.post('/push-all', pushAllData);

module.exports = router;
