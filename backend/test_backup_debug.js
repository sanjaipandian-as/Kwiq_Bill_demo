require('dotenv').config();
const mongoose = require('mongoose');

const testBackup = async () => {
    console.log('Starting Backup Test...');
    console.log('Source URI:', process.env.MONGO_URI);
    console.log('Backup URI:', process.env.MONGO_BACKUP_URI);

    try {
        // Connect to Source
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Source DB');

        // Connect to Target
        const backupConn = mongoose.createConnection(process.env.MONGO_BACKUP_URI);
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            backupConn.on('connected', () => {
                console.log('Connected to Target DB');
                resolve();
            });
            backupConn.on('error', (err) => {
                console.error('Target DB Connection Error:', err);
                reject(err);
            });
            // Timeout after 10s
            setTimeout(() => reject(new Error('Connection Timeout')), 10000);
        });

        const sourceDb = mongoose.connection.db;
        const targetDb = backupConn.db;

        console.log('Source DB Name:', sourceDb.databaseName);
        console.log('Target DB Name:', targetDb.databaseName);

        // List all databases in target to confirm where we are
        const dbs = await backupConn.db.admin().listDatabases();
        console.log('Available databases on target cluster:', dbs.databases.map(d => d.name));

        const collections = await sourceDb.listCollections().toArray();
        console.log('Collections to copy:', collections.map(c => c.name));

        for (const col of collections) {
            const colName = col.name;
            if (colName.startsWith('system.')) continue;

            console.log(`Copying collection: ${colName}`);
            const data = await sourceDb.collection(colName).find().toArray();
            console.log(`Found ${data.length} documents in ${colName}`);

            if (data.length > 0) {
                await targetDb.collection(colName).deleteMany({});
                await targetDb.collection(colName).insertMany(data);
                console.log(`Successfully copied ${colName}`);
            }
        }

        await backupConn.close();
        await mongoose.disconnect();
        console.log('Backup Test Finished Successfully!');
    } catch (err) {
        console.error('Backup Test Failed:', err);
    }
};

testBackup();
