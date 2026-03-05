const asyncHandler = require('express-async-handler');
const Settings = require('../models/settingsModel');
const { uploadToCloudinary } = require('../config/cloudinary');

// @desc    Get settings
// @route   GET /settings
// @access  Private
const getSettings = asyncHandler(async (req, res) => {
    try {
        // Derive userId: email-<base64(email)>
        const email = req.user.email;
        const base64Email = Buffer.from(email).toString('base64');
        const derivedUserId = `email-${base64Email}`;

        console.log(`[SettingsController] Fetching for: ${derivedUserId} (email: ${email})`);

        // Search by both derived ID and userEmail to handle migration
        let settings = await Settings.findOne({
            $or: [
                { userId: derivedUserId },
                { userEmail: email }
            ]
        });

        if (!settings) {
            console.log(`[SettingsController] No settings found, creating new for: ${email}`);
            settings = await Settings.create({
                userId: derivedUserId,
                userEmail: email,
                store: { email: email },
                user: { email: email, fullName: req.user.name || '' }
            });
        } else if (settings.userId !== derivedUserId) {
            // Migrate legacy userId to the new derived format
            console.log(`[SettingsController] Migrating userId from ${settings.userId} to ${derivedUserId}`);
            settings.userId = derivedUserId;
            await settings.save();
        }

        res.json(settings);
    } catch (error) {
        console.error('[SettingsController] ERROR:', error);
        throw error;
    }
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

    // Strip Mongoose immutable/internal fields that may come from the client
    const { _id, __v, createdAt, updatedAt, ...cleanBody } = req.body;

    const updateData = {
        ...cleanBody,
        userId: derivedUserId,
        userEmail: email,
        lastUpdated: new Date()
    };

    // Find existing by either ID or email
    let settings = await Settings.findOne({
        $or: [
            { userId: derivedUserId },
            { userEmail: email }
        ]
    });

    if (!settings) {
        console.log(`[SettingsController] Creating new record for: ${email}`);
        settings = await Settings.create(updateData);
    } else {
        console.log(`[SettingsController] Updating existing record: ${settings.userId}`);
        // Ensure we update by internal ID to keep userId consistency
        settings = await Settings.findOneAndUpdate(
            { _id: settings._id },
            { $set: updateData },
            { new: true }
        );
    }

    if (settings) {
        console.log('\n📥 FEEDING SETTINGS DATA TO MONGODB:');
        console.log(`   - User Identity: ${settings.userId}`);
        console.log(`   - Store Name: ${settings.store?.name || 'N/A'}`);
        console.log(`   - Owner Name: ${settings.user?.fullName || 'N/A'}`);
        console.log(`   - Onboarding Completed: ${settings.onboardingCompletedAt ? 'YES' : 'NO'}`);
        console.log('✅ SETTINGS SAVED TO COMPANYPROFILES\n');
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
