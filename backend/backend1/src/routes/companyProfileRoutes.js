const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const companyProfileController = require('../controllers/companyProfileController');

/**
 * @route   POST /api/company-profile
 * @desc    Save or update company profile to MongoDB
 * @access  Protected
 */
router.post('/', protect, companyProfileController.saveCompanyProfile);

/**
 * @route   GET /api/company-profile/:userId
 * @desc    Get company profile by userId
 * @access  Protected
 */
router.get('/:userId', protect, companyProfileController.getCompanyProfile);

/**
 * @route   GET /api/company-profile
 * @desc    Get all company profiles (admin only)
 * @access  Protected (admin)
 */
router.get('/', protect, companyProfileController.getAllProfiles);

module.exports = router;
