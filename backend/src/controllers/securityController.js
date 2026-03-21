const SecurityBackup = require('../models/SecurityBackup');
const crypto = require('crypto');

// @desc    Upload pre-encrypted Master Key Escrow to MongoDB
// @route   POST /security/backup-key
// @access  Private
const backupKey = async (req, res) => {
    try {
        const { encryptedMasterKeyBackup } = req.body;
        let backup = await SecurityBackup.findOne({ user: req.user._id });
        if (backup) {
           backup.encryptedMasterKeyBackup = encryptedMasterKeyBackup;
           await backup.save();
        } else {
           backup = await SecurityBackup.create({
               user: req.user._id,
               encryptedMasterKeyBackup
           });
        }
        res.status(200).json({ success: true, message: 'Google Zero-Knowledge Backup saved.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// @desc    Initiate self-service OTP Flow
// @route   POST /security/initiate-recovery
// @access  Private
const initiateRecovery = async (req, res) => {
    try {
        let backup = await SecurityBackup.findOne({ user: req.user._id });
        if (!backup) {
             // Create a new backup record just for OTP purposes for now
             backup = await SecurityBackup.create({
                 user: req.user._id,
                 encryptedMasterKeyBackup: null // User hasn't synced yet
             });
        }
        
        // Anti-Brute Force Rate Limiting
        if (backup.failedOtpAttempts >= 3 && backup.otpExpiresAt && backup.otpExpiresAt > new Date()) {
           return res.status(429).json({ error: 'Too many failed recovery attempts. Try again in 1 hour.' });
        }

        // Generate 8-character Alphanumeric Code (e.g. 7A9D-2FGH)
        const otp = crypto.randomBytes(4).toString('hex').toUpperCase(); 
        
        // Save SHA-256 hash instead of plaintext OTP for security
        backup.otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        backup.otpExpiresAt = new Date(Date.now() + 15 * 60000); // 15 mins expiry
        
        if (backup.failedOtpAttempts >= 3) {
            // Reset attempts if lockout expired
            backup.failedOtpAttempts = 0;
        }
        await backup.save();

        // Fix #13: Only log OTP in development — never expose in production server logs
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n================================`);
            console.log(`[SECURITY] MANUAL ADMIN OVERRIDE CODE GENERATED: ${otp}`);
            console.log(`[SECURITY] Provide this to manager for: ${req.user.email}`);
            console.log(`================================\n`);
        } else {
            console.log(`[SECURITY] Recovery code generated for: ${req.user.email} (code redacted from logs)`);
        }

        res.status(200).json({ success: true, message: 'Recovery initiated. Please contact your Super Admin to receive your 8-character manual override code.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// @desc    Validate OTP (admin override OR self-service) and release Zero-Knowledge Escrow String
// @route   POST /security/recover
// @access  Public — OTP is the authentication factor (user is locked out and has no JWT)
const recoverKey = async (req, res) => {
    try {
        const { otp, userId } = req.body;
        if (!otp) return res.status(400).json({ error: 'Recovery OTP is required' });
        if (!userId) return res.status(400).json({ error: 'userId is required for recovery' });

        const trimmedOtp = otp.trim().toUpperCase();
        const inputHash = crypto.createHash('sha256').update(trimmedOtp).digest('hex');

        // Find backup record using userId from body (no req.user available on public route)
        const backup = await SecurityBackup.findOne({ user: userId });

        if (!backup) {
            console.log(`[RECOVERY-ERROR] No backup record found for userId: ${userId}`);
            return res.status(400).json({ error: 'No recovery record exists for this account.' });
        }

        // Get user email for logging (optional, non-blocking)
        let userEmail = userId;
        try {
            const User = require('../models/userModel');
            const u = await User.findById(userId).select('email');
            if (u) userEmail = u.email;
        } catch (_) {}

        // Debug info
        console.log(`[RECOVERY-DEBUG] User: ${userEmail} | adminOtpHash: ${backup.adminOtpHash ? 'SET' : 'NULL'} | otpHash: ${backup.otpHash ? 'SET' : 'NULL'}`);
        console.log(`[RECOVERY-DEBUG] adminOtpExpiresAt: ${backup.adminOtpExpiresAt} | otpExpiresAt: ${backup.otpExpiresAt}`);

        const now = new Date();

        // --- PRIORITY 1: Try Admin Override Code ---
        if (backup.adminOtpHash) {
            if (backup.adminOtpExpiresAt && backup.adminOtpExpiresAt < now) {
                console.log(`[RECOVERY-ERROR] Admin code EXPIRED for User: ${userEmail}. Expired at: ${backup.adminOtpExpiresAt}`);
                // Don't return yet — fall through to self-service OTP check
            } else if (inputHash === backup.adminOtpHash) {
                // Admin code matches!
                backup.adminOtpHash = null;
                backup.adminOtpExpiresAt = null;
                backup.failedOtpAttempts = 0;
                await backup.save();
                console.log(`[AUDIT-ALERT] Vault Recovered via ADMIN code for user: ${userEmail}`);
                return res.status(200).json({ success: true, encryptedMasterKeyBackup: backup.encryptedMasterKeyBackup });
            }
        }

        // --- PRIORITY 2: Try Self-Service OTP ---
        if (backup.otpHash) {
            if (backup.otpExpiresAt && backup.otpExpiresAt < now) {
                console.log(`[RECOVERY-ERROR] Self-service code EXPIRED for User: ${userEmail}. Expired at: ${backup.otpExpiresAt}`);
                backup.failedOtpAttempts += 1;
                await backup.save();
                return res.status(400).json({ error: 'Code has expired. Please generate a new one from the dashboard.' });
            }
            if (inputHash === backup.otpHash) {
                backup.otpHash = null;
                backup.otpExpiresAt = null;
                backup.failedOtpAttempts = 0;
                await backup.save();
                console.log(`[AUDIT-ALERT] Vault Recovered via self-service OTP for user: ${userEmail}`);
                return res.status(200).json({ success: true, encryptedMasterKeyBackup: backup.encryptedMasterKeyBackup });
            }
        }

        // --- Neither code matched ---
        const hasAnyCode = backup.adminOtpHash || backup.otpHash;
        if (!hasAnyCode) {
            console.log(`[RECOVERY-ERROR] No active code on record for User: ${userEmail}`);
            return res.status(400).json({ error: 'Invalid code or it has already been used.' });
        }

        // Code exists but didn't match — wrong code entered
        backup.failedOtpAttempts += 1;
        await backup.save();
        console.log(`[RECOVERY-ERROR] Wrong code for User: ${userEmail}. Attempts: ${backup.failedOtpAttempts}`);
        return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    } catch (e) {
        console.error('[RECOVERY-ERROR] Exception:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
};



// @desc    Silent audit logging for terminal PIN attempts
// @route   POST /security/audit
// @access  Private
const auditSecurityEvent = async (req, res) => {
    try {
        const { event, details } = req.body;
        console.log(`\n[SECURITY AUDIT] Event: ${event} | User: ${req.user.email}`);
        if (details) console.log(`[SECURITY AUDIT] Details: ${JSON.stringify(details)}`);
        
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// @desc    Admin-initiated generation of override code for a specific user
// @route   POST /security/admin/generate-reset-code/:userId
// @access  Private/Admin
const generateAdminResetCode = async (req, res) => {
    try {
        const { userId } = req.params;
        let backup = await SecurityBackup.findOne({ user: userId });
        
        if (!backup) {
            // Check if user exists
            const User = require('../models/userModel');
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });
            
            // Create a new backup record just for OTP purposes for now
            backup = await SecurityBackup.create({
                user: userId,
                encryptedMasterKeyBackup: null // User hasn't synced yet
            });
        }

        // Generate 8-character Alphanumeric Code
        const otp = crypto.randomBytes(4).toString('hex').toUpperCase(); 
        
        // Save SHA-256 hash in the ADMIN-SPECIFIC fields
        // (This prevents self-service initiateRecovery from overwriting admin codes)
        backup.adminOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
        backup.adminOtpExpiresAt = new Date(Date.now() + 120 * 60000); // 2 hours expiry for admin codes
        backup.failedOtpAttempts = 0;
        await backup.save();

        // Fix #13: Only log OTP in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n[SECURITY-ADMIN] RESET CODE GENERATED by Admin for userId:${userId}: ${otp}\n`);
            console.log(`[SECURITY-ADMIN] adminOtpExpiresAt: ${backup.adminOtpExpiresAt}`);
        } else {
            console.log(`[SECURITY-ADMIN] Reset code generated for userId:${userId} (code redacted)`);
        }

        res.status(200).json({ 
            success: true, 
            code: otp,
            expiresAt: backup.adminOtpExpiresAt
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

module.exports = { backupKey, initiateRecovery, recoverKey, auditSecurityEvent, generateAdminResetCode };
