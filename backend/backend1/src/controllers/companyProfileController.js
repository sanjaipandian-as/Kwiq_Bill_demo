const CompanyProfile = require('../models/CompanyProfile');
const { connectMongo } = require('../config/mongoose');

/**
 * Save or update company profile to MongoDB
 * POST /api/company-profile
 */
exports.saveCompanyProfile = async (req, res) => {
    try {
        // Connect to MongoDB
        await connectMongo();

        const { userId, userEmail, store, tax, user, onboardingCompletedAt } = req.body;

        // Validate required fields
        if (!userId || !userEmail || !store || !user) {
            console.error('❌ Missing fields:', { userId: !!userId, userEmail: !!userEmail, store: !!store, user: !!user });
            console.log('Received body:', JSON.stringify(req.body, null, 2));
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, userEmail, store, or user',
                details: { userId, userEmail }
            });
        }

        // Upsert (update if exists, insert if not)
        const profile = await CompanyProfile.findOneAndUpdate(
            { userId },
            {
                userId,
                userEmail,
                store,
                tax,
                user,
                onboardingCompletedAt: onboardingCompletedAt || new Date(),
                lastUpdated: new Date()
            },
            {
                upsert: true, // Create if doesn't exist
                new: true,    // Return updated document
                runValidators: true // Validate on update
            }
        );

        console.log(`✅ Company profile saved/updated for user: ${userId}`);

        res.json({
            success: true,
            profile,
            message: 'Company profile synced to MongoDB successfully'
        });
    } catch (error) {
        console.error('❌ Failed to save company profile:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Get company profile by userId
 * GET /api/company-profile/:userId
 */
exports.getCompanyProfile = async (req, res) => {
    try {
        await connectMongo();

        const { userId } = req.params;
        const profile = await CompanyProfile.findOne({ userId });

        if (!profile) {
            return res.status(404).json({
                success: false,
                error: 'Company profile not found for this user'
            });
        }

        res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('❌ Failed to get company profile:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get all company profiles (admin only)
 * GET /api/company-profile
 */
exports.getAllProfiles = async (req, res) => {
    try {
        await connectMongo();

        const profiles = await CompanyProfile.find()
            .sort({ createdAt: -1 })
            .select('-__v');

        res.json({
            success: true,
            count: profiles.length,
            profiles
        });
    } catch (error) {
        console.error('❌ Failed to get company profiles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
