const asyncHandler = require('express-async-handler');
const Settings = require('../models/settingsModel');
const { uploadToCloudinary } = require('../config/cloudinary');

// @desc    Get settings
// @route   GET /settings
// @access  Private
const getSettings = asyncHandler(async (req, res) => {
    // Derive userId: email-<base64(email)>
    const email = req.user.email;
    const base64Email = Buffer.from(email).toString('base64');
    const derivedUserId = `email-${base64Email}`;

    console.log(`[SettingsController] Fetching for: ${derivedUserId}`);

    let settings = await Settings.findOne({ userId: derivedUserId });

    if (!settings) {
        settings = await Settings.create({
            userId: derivedUserId,
            userEmail: email,
            store: { email: email },
            user: { email: email }
        });
    }

    res.json(settings);
});

// @desc    Update settings
// @route   PUT /settings
// @access  Private
const updateSettings = asyncHandler(async (req, res) => {
    // Derive userId: email-<base64(email)>
    const email = req.user.email;
    const base64Email = Buffer.from(email).toString('base64');
    const derivedUserId = `email-${base64Email}`;

    console.log(`[SettingsController] Update request for: ${derivedUserId}`);
    // console.log('[SettingsController] Payload:', JSON.stringify(req.body, null, 2));

    const updateData = {
        ...req.body,
        userId: derivedUserId,
        userEmail: email,
        lastUpdated: new Date()
    };

    let settings = await Settings.findOne({ userId: derivedUserId });

    if (!settings) {
        console.log('[SettingsController] Creating new record');
        settings = await Settings.create(updateData);
    } else {
        console.log('[SettingsController] Updating existing record');
        settings = await Settings.findOneAndUpdate(
            { userId: derivedUserId },
            { $set: updateData },
            { new: true, upsert: false }
        );
    }

    if (settings) {
        console.log('[SettingsController] Success: Saved to companyprofiles');
    } else {
        console.error('[SettingsController] Failed to save');
    }

    res.json(settings);
});

// @desc    Upload store logo
// @route   POST /settings/logo
// @access  Private
const uploadLogo = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    const email = req.user.email;
    const base64Email = Buffer.from(email).toString('base64');
    const derivedUserId = `email-${base64Email}`;

    const uploadOptions = {
        folder: 'store-logos',
        resource_type: 'image',
        type: 'upload',
        access_mode: 'public',
        public_id: `logo_${derivedUserId}`, // Unique per user/store
        overwrite: true
    };

    try {
        const result = await uploadToCloudinary(req.file.buffer, uploadOptions);
        const logoUrl = result.secure_url;

        let settings = await Settings.findOne({ userId: derivedUserId });
        if (settings) {
            settings.store.logo = logoUrl;
            settings.lastUpdated = new Date();
            await settings.save();
        }

        res.json({
            message: 'Logo uploaded successfully',
            logoUrl: logoUrl
        });
    } catch (error) {
        console.error('Logo Upload Error:', error);
        res.status(500);
        throw new Error(`Failed to upload logo: ${error.message}`);
    }
});

module.exports = {
    getSettings,
    updateSettings,
    uploadLogo,
};
