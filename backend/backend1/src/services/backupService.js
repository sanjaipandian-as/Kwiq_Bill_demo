const { google } = require('googleapis');
const keytar = require('keytar');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const SERVICE_NAME = 'BillingSoftware-Drive';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback";

/**
 * Get Authenticated Drive Client
 */
async function getDriveClient(rawUserId) {
    const userId = String(rawUserId); // 🔑 Ensure string
    try {
        const refreshToken = await keytar.getPassword(SERVICE_NAME, userId);
        if (!refreshToken) {
            const error = new Error("No refresh token found. User needs to re-authenticate.");
            error.code = 'AUTH_REQUIRED';
            throw error;
        }

        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        auth.setCredentials({ refresh_token: refreshToken });

        // Test the credentials by attempting to refresh the token
        try {
            await auth.getAccessToken();
        } catch (tokenError) {
            // Check for expired/revoked token errors
            if (tokenError.message && (
                tokenError.message.includes('invalid_grant') ||
                tokenError.message.includes('Token has been expired or revoked')
            )) {
                const error = new Error("Google authentication has expired. Please log out and log back in.");
                error.code = 'AUTH_EXPIRED';
                throw error;
            }
            throw tokenError;
        }

        return google.drive({ version: 'v3', auth });
    } catch (error) {
        console.error("Drive Auth Error:", error);
        // Re-throw the error instead of returning null so caller can handle it properly
        throw error;
    }
}

/**
 * Ensure core folder structure exists
 * Returns the folder IDs for { root, daily, weekly, monthly, events }
 */
async function ensureFolderStructure(drive) {
    const findOrCreateFolder = async (name, parentId = null) => {
        let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
        if (parentId) query += ` and '${parentId}' in parents`;

        const res = await drive.files.list({ q: query, fields: 'files(id, name)' });
        if (res.data.files.length > 0) return res.data.files[0].id;

        const fileMetadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : undefined
        };
        const folder = await drive.files.create({ resource: fileMetadata, fields: 'id' });
        return folder.data.id;
    };

    const rootId = await findOrCreateFolder('Kwiqbill'); // Updated root folder name per request
    const backupsId = await findOrCreateFolder('backups', rootId);

    // Create backup subfolders inside 'backups'
    const dailyId = await findOrCreateFolder('daily', backupsId);
    const weeklyId = await findOrCreateFolder('weekly', backupsId);
    const monthlyId = await findOrCreateFolder('monthly', backupsId);

    // Create events folder inside root
    const eventsId = await findOrCreateFolder('events', rootId);

    // Create snapshots folder inside root
    const snapshotsId = await findOrCreateFolder('snapshots', rootId);

    return { rootId, backupsId, dailyId, weeklyId, monthlyId, eventsId, snapshotsId };
}

/**
 * Upload a flat JSON Snapshot to Drive
 * @param {string} userId - Google User ID
 * @param {string} filename - name of the json file
 * @param {array|object} payload - the data to stringify
 */
async function uploadSnapshot(userId, filename, payload) {
    try {
        const drive = await getDriveClient(userId);
        if (!drive) throw new Error("Authentication failed");

        const folders = await ensureFolderStructure(drive);

        // Check if file already exists to update it, or just create/overwrite
        const q = `'${folders.snapshotsId}' in parents and name='${filename}' and trashed=false`;
        const existing = await drive.files.list({ q, fields: 'files(id)' });

        const tempPath = path.join(require('os').tmpdir(), filename);
        fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2));

        const media = {
            mimeType: 'application/json',
            body: fs.createReadStream(tempPath)
        };

        if (existing.data.files && existing.data.files.length > 0) {
            // Update existing
            const fileId = existing.data.files[0].id;
            await drive.files.update({
                fileId,
                media,
            });
        } else {
            // Create new
            await drive.files.create({
                resource: {
                    name: filename,
                    parents: [folders.snapshotsId]
                },
                media,
                fields: 'id'
            });
        }

        fs.unlinkSync(tempPath);
        return { success: true };
    } catch (error) {
        console.error("Upload Snapshot Failed:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Upload Event to Drive
 * @param {string} userId - Google User ID
 * @param {object} eventEnvelope - { eventId, type, createdAt, payload, ... }
 */
async function uploadEvent(userId, eventEnvelope) {
    try {
        const drive = await getDriveClient(userId);
        if (!drive) throw new Error("Authentication failed");

        const folders = await ensureFolderStructure(drive);

        // Construct filename: event_{TIMESTAMP}_{TYPE}_{UUID}.json
        // Timestamp helps with initial sorting/listing, UUID ensures uniqueness.
        // We use eventEnvelope.createdAt for the timestamp part.
        const safeType = (eventEnvelope.type || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '');
        const safeTime = (eventEnvelope.createdAt || new Date().toISOString()).replace(/[:.]/g, '-');
        const filename = `event_${safeTime}_${safeType}_${eventEnvelope.eventId}.json`;

        // Create temporary file
        const tempPath = path.join(require('os').tmpdir(), filename);
        fs.writeFileSync(tempPath, JSON.stringify(eventEnvelope, null, 2));

        const res = await drive.files.create({
            resource: {
                name: filename,
                parents: [folders.eventsId]
            },
            media: {
                mimeType: 'application/json',
                body: fs.createReadStream(tempPath)
            },
            fields: 'id'
        });

        // Cleanup
        fs.unlinkSync(tempPath);

        return { success: true, fileId: res.data.id };
    } catch (error) {
        console.error("Upload Event Failed:", error.message);
        // Suppress error to prevent crash
        return { success: false, error: error.message };
    }
}

/**
 * List Events from Drive
 * @param {string} userId 
 * @param {string} [pageToken] 
 * @param {string} [lastSyncAt] - ISO timestamp string format
 */
async function listEvents(userId, pageToken = null, lastSyncAt = null) {
    try {
        const drive = await getDriveClient(userId);
        if (!drive) throw new Error("Authentication failed");

        const folders = await ensureFolderStructure(drive);

        let q = `'${folders.eventsId}' in parents and trashed=false`;
        if (lastSyncAt) {
            q += ` and createdTime > '${lastSyncAt}'`;
        }

        // List files in events folder
        // Order by name (which starts with timestamp) ensures approximate chronological order
        // But caller must sort by payload.createdAt for strict correctness.
        const res = await drive.files.list({
            q,
            fields: 'nextPageToken, files(id, name, createdTime)',
            // orderBy: 'name', // Removed to avoid potential API 500 errors, we sort in memory
            pageSize: 100, // Fetch in batches
            pageToken: pageToken
        });

        return {
            files: res.data.files,
            nextPageToken: res.data.nextPageToken
        };
    } catch (error) {
        console.error("List Events Failed:", error);
        throw error;
    }
}

/**
 * Download Event Content
 * @param {string} userId 
 * @param {string} fileId 
 */
async function downloadEvent(userId, fileId) {
    try {
        const drive = await getDriveClient(userId);
        if (!drive) throw new Error("Authentication failed");

        const res = await drive.files.get({
            fileId,
            alt: 'media'
        });

        return res.data; // The JSON object
    } catch (error) {
        console.error(`Download Event ${fileId} Failed:`, error);
        throw error;
    }
}

/**
 * Perform Full Backup (Legacy support, moved to 'backups/' subfolder)
 */
async function performBackup(rawUserId, userBaseDir) {
    const userId = String(rawUserId); // 🔑 Ensure string
    console.log(`📦 Starting Backup for ${userId}...`);

    try {
        const drive = await getDriveClient(userId);
        const folders = await ensureFolderStructure(drive);

        // Determine Backup Type (Simple logic: Default to daily)
        const now = new Date();
        const type = 'daily'; // Default
        const targetFolderId = folders[`${type}Id`];

        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const tables = ['invoices', 'customers', 'products', 'expenses'];
        let backedUpFiles = [];

        for (const table of tables) {
            const localPath = path.join(userBaseDir, 'data', table, `${table}.json`);
            if (fs.existsSync(localPath)) {
                await drive.files.create({
                    resource: {
                        name: `${table}_${timestamp}.json`,
                        parents: [targetFolderId]
                    },
                    media: {
                        mimeType: 'application/json',
                        body: fs.createReadStream(localPath)
                    },
                    fields: 'id'
                });
                backedUpFiles.push(table);
            }
        }

        // Upload Metadata
        const metadata = {
            createdAt: now.toISOString(),
            backupType: type,
            appVersion: '1.0.0',
            tables: backedUpFiles
        };

        await drive.files.create({
            resource: {
                name: `metadata_${timestamp}.json`,
                parents: [targetFolderId]
            },
            media: {
                mimeType: 'application/json',
                body: JSON.stringify(metadata, null, 2)
            }
        });

        // Enforce Retention
        await enforceRetention(drive, targetFolderId, 7);

        console.log("✅ Backup Complete");
        return { success: true, timestamp: now.toISOString() };

    } catch (error) {
        console.error("❌ Backup Failed:", error);

        // FAIL SAFE: Do not re-throw auth errors to prevent backend crash
        if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED') {
            console.warn("Backup Skipped: Authentication required");
            return { success: false, error: error.message, requiresAuth: true };
        }

        return { success: false, error: error.message };
    }
}

/**
 * Keep only N most recent backups
 */
async function enforceRetention(drive, folderId, maxCount) {
    try {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc'
        });

        const files = res.data.files;
        const SAFE_LIMIT = maxCount * 6; // ~6 files per backup
        if (files.length > SAFE_LIMIT) {
            const toDelete = files.slice(SAFE_LIMIT);
            for (const file of toDelete) {
                await drive.files.delete({ fileId: file.id });
                console.log(`🗑️ Pruned old backup file: ${file.name}`);
            }
        }
    } catch (e) {
        console.error("Retention Error:", e);
    }
}

/**
 * Clear all events from Drive (for fresh push)
 */
async function clearEvents(userId) {
    try {
        const drive = await getDriveClient(userId);
        if (!drive) throw new Error("Authentication failed");

        const folders = await ensureFolderStructure(drive);

        let pageToken = null;
        let deletedCount = 0;

        do {
            const res = await drive.files.list({
                q: `'${folders.eventsId}' in parents and trashed=false`,
                fields: 'nextPageToken, files(id, name)',
                pageSize: 100,
                pageToken: pageToken
            });

            const files = res.data.files;
            for (const file of files) {
                try {
                    await drive.files.delete({ fileId: file.id });
                    deletedCount++;
                } catch (e) {
                    console.error(`Failed to delete event file ${file.id}`, e);
                }
            }

            pageToken = res.data.nextPageToken;
        } while (pageToken);

        console.log(`🧹 Cleared ${deletedCount} old events from Drive.`);
        return { success: true, deletedCount };
    } catch (error) {
        console.error("Clear Events Failed:", error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    performBackup,
    uploadEvent,
    uploadSnapshot,
    listEvents,
    downloadEvent,
    clearEvents,
    getDriveClient // Exported for controller use if needed
};
