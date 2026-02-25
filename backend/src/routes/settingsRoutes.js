const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, uploadLogo } = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');
const { checkTrial } = require('../middleware/trialMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/', protect, checkTrial, getSettings);
router.put('/', protect, checkTrial, updateSettings);

// Logo upload
router.post('/logo', protect, checkTrial, upload.single('logo'), uploadLogo);

module.exports = router;
