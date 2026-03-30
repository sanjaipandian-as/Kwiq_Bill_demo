const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const Joi = require('joi');

// @desc    Auth user & get token (Deprecated)
// @route   POST /auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    res.status(400);
    throw new Error('Email/Password login is no longer supported. Please use Google Login.');
});

// @desc    Register a new user (Deprecated)
// @route   POST /auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    res.status(400);
    throw new Error('Registration via email/password is no longer supported. Please use Google Login.');
});

// @desc    Logout user / clear cookie
// @route   POST /auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
    // Since we are using stateless JWT, mostly frontend just clears token.
    // We can respond with a success message.
    res.json({ message: 'Logged out successfully' });
});

// @desc    Google Login
// @route   POST /auth/google
// @access  Public
const googleLogin = asyncHandler(async (req, res) => {
    console.log('--- RECV: Google Login Request ---');
    const { token } = req.body;
    const { OAuth2Client } = require('google-auth-library');

    if (!token) {
        res.status(400);
        throw new Error('Google token is missing');
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    try {
        console.log('Attempting to verify Google token...');
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: [
                process.env.GOOGLE_CLIENT_ID,
                process.env.ANDROID_CLIENT_ID
            ],
        });

        const payload = ticket.getPayload();
        console.log('Google token verified successfully for:', payload.email);

        const { name, email, sub: googleId } = payload;

        // Look up user by email (case-insensitive)
        let user = await User.findOne({
            email: email.toLowerCase(),
        });

        let needsSave = false;

        if (!user) {
            // NEW USER: Auto-register them — they'll see the onboarding form
            console.log(`🆕 New user signing up: ${email} (${name})`);
            const trialExpiresAt = new Date();
            trialExpiresAt.setFullYear(trialExpiresAt.getFullYear() + 100); // 100 years trial

            user = await User.create({
                name: name,
                email: email.toLowerCase(),
                googleId: googleId,
                role: 'employee',
                trialExpiresAt: trialExpiresAt,
            });
            console.log('✅ New user created:', user.email, '| Trial expires:', trialExpiresAt);
        } else {
            console.log('✅ Existing user found:', user.email);

            // Update googleId if not set
            if (!user.googleId) {
                user.googleId = googleId;
                needsSave = true;
            }

            // Backfill trialExpiresAt for users created before the trial feature
            if (!user.trialExpiresAt) {
                const trialExpiresAt = new Date(user.createdAt || Date.now());
                trialExpiresAt.setFullYear(trialExpiresAt.getFullYear() + 100); // 100 years trial
                user.trialExpiresAt = trialExpiresAt;
                needsSave = true;
                console.log('Backfilled trialExpiresAt for existing user:', user.email, '->', trialExpiresAt);
            }

            if (needsSave) {
                await user.save();
            }
        }

        // Fix #14: Return the Zero-Knowledge Master Key backup for automatic restoration on new devices
        const SecurityBackup = require('../models/SecurityBackup');
        const backup = await SecurityBackup.findOne({ user: user._id }).select('encryptedMasterKeyBackup');

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                trialExpiresAt: user.trialExpiresAt,
                plan: user.plan,
                planExpiresAt: user.planExpiresAt,
                isBlocked: user.isBlocked,
                encryptedMasterKeyBackup: backup ? backup.encryptedMasterKeyBackup : null,
            },
            token: generateToken(user._id),
        });

    } catch (error) {
        console.error('Google Auth Error Details:', error.message);
        res.status(401);
        throw new Error('Google authentication failed: ' + error.message);
    }
});

// @desc    Get user profile
// @route   GET /auth/me
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        const SecurityBackup = require('../models/SecurityBackup');
        const backup = await SecurityBackup.findOne({ user: user._id }).select('encryptedMasterKeyBackup');

        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            trialExpiresAt: user.trialExpiresAt,
            plan: user.plan,
            planExpiresAt: user.planExpiresAt,
            isBlocked: user.isBlocked,
            encryptedMasterKeyBackup: backup ? backup.encryptedMasterKeyBackup : null,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = {
    loginUser,
    registerUser,
    logoutUser,
    getUserProfile,
    googleLogin,
};
