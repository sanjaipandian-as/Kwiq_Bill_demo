const { withDB } = require("../db/db");
const { syncTableToJson } = require("../db/syncToJson");
const CompanyProfile = require('../models/CompanyProfile');
const { connectMongo } = require('../config/mongoose');

exports.getSettings = async (req, res) => {
  try {
    console.log(`[Settings] Fetching 'singleton' for user: ${req.user?.googleSub}`);
    const db = await withDB(req);

    // 🔑 Explicitly fetch the 'singleton' row
    let row = db.prepare(`SELECT data FROM settings WHERE id = 'singleton'`).get();

    if (req.user?.googleSub || req.user?.email) {
      try {
        await connectMongo();

        const conditions = [];
        if (req.user?.googleSub) conditions.push({ userId: req.user.googleSub });
        if (req.user?.email) {
          const base64Email = Buffer.from(req.user.email).toString('base64').replace(/=/g, '');
          conditions.push({ userId: `email-${base64Email}` });
          conditions.push({ userEmail: req.user.email });
        }

        const profile = conditions.length > 0 ? await CompanyProfile.findOne({ $or: conditions }).sort({ createdAt: -1 }) : null;

        if (profile) {
          // If local row is missing, restore it from Atlas
          if (!row) {
            console.log(`[Settings] Found profile in MongoDB Atlas (userId: ${profile.userId}). Restoring to localDB...`);

            if (req.user?.googleSub && profile.userId !== req.user.googleSub) {
              console.log(`[Settings] Migrating MongoDB Profile userId from ${profile.userId} to ${req.user.googleSub}`);
              profile.userId = req.user.googleSub;
              await profile.save().catch(err => console.error("Warning: Could not update profile userId in Mongo:", err));
            }

            const initialSettings = {
              store: profile.store,
              tax: profile.tax,
              user: profile.user,
              onboardingCompletedAt: profile.onboardingCompletedAt
            };
            const dataStr = JSON.stringify(initialSettings);

            db.prepare(`
                INSERT INTO settings (id, data, updated_at)
                VALUES ('singleton', ?, ?)
              `).run(dataStr, new Date().toISOString());

            row = { data: dataStr };
          }
        } else {
          // Profile NOT found in MongoDB explicitly!
          if (row) {
            console.log(`[Settings] Local settings found but missing in MongoDB Atlas. Migrating local data to cloud...`);
            try {
              const localData = JSON.parse(row.data);
              const base64Email = req.user?.email ? Buffer.from(req.user.email).toString('base64').replace(/=/g, '') : null;

              const newProfile = new CompanyProfile({
                userId: req.user?.googleSub || `email-${base64Email}`,
                userEmail: req.user?.email || localData.user?.email || 'unknown@example.com',
                store: localData.store,
                tax: localData.tax,
                user: localData.user,
                onboardingCompletedAt: localData.onboardingCompletedAt || new Date(),
                lastUpdated: new Date()
              });
              await newProfile.save();
              console.log(`[Settings] ✅ Successfully migrated local profile to MongoDB Atlas.`);
            } catch (migrateErr) {
              console.error(`[Settings] ❌ Failed to migrate local profile to MongoDB:`, migrateErr.message);
            }
          }
        }
      } catch (mongoErr) {
        // Atlas is offline or timed out — log it and fall through to serve local SQLite data.
        // We NEVER block the response for a cloud sync failure.
        const isTimeout = mongoErr.message?.includes('buffering timed out') || mongoErr.message?.includes('timed out');
        console.warn(`[Settings] MongoDB ${isTimeout ? 'timeout' : 'sync error'} (offline mode — serving local data):`, mongoErr.message);
        // Continue below — 'row' already holds whatever SQLite has.
      }
    }

    if (!row) {
      console.warn(`[Settings] 'singleton' row NOT found and no user context. Checking generic LIMIT 1 for debugging...`);
      const fallback = db.prepare(`SELECT * FROM settings LIMIT 1`).get();
      if (fallback) console.log(`[Settings] Different row found: ID=${fallback.id}`);
    }

    if (row) {
      try {
        const parsed = JSON.parse(row.data);
        console.log(`[Settings] Loaded. Onboarding: ${parsed.onboardingCompletedAt}`);
      } catch (e) {
        console.error("[Settings] JSON Parse Error:", e);
      }
    }

    res.json(row ? JSON.parse(row.data) : {});
  } catch (err) {
    console.error(`[Settings] Get Error:`, err);
    res.status(500).json({ message: "Failed to load settings", error: err.message });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    console.log(`[Settings] Saving for user: ${req.user?.googleSub}`);
    const db = await withDB(req);

    const dataStr = JSON.stringify(req.body);

    // Explicit transaction for safety
    const saveTx = db.transaction(() => {
      db.prepare(`
            INSERT INTO settings (id, data, updated_at)
            VALUES ('singleton', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        `).run(dataStr, new Date().toISOString());
    });

    saveTx();
    console.log(`[Settings] Saved successfully to SQLite`);

    // 🔄 AUTO JSON SYNC
    try {
      syncTableToJson({
        db,
        table: "settings",
        userBaseDir: req.userBaseDir,
        map: s => JSON.parse(s.data || "{}")
      });
    } catch (syncErr) {
      console.error("JSON Sync failed (non-fatal):", syncErr);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(`[Settings] Save Error:`, err);
    res.status(500).json({ message: "Failed to save settings", error: err.message });
  }
};
