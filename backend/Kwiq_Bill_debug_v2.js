require('dotenv').config();
const mongoose = require('mongoose');

const testBackup = async () => {
    console.log('Starting Backup Test...');
    
    try {
        console.log('Connecting to Source...');
        const sourceConn = await mongoose.connect(process.env.MONGO_URI);
        const sourceDb = mongoose.connection.db;
        console.log('Connected to Source DB:', sourceDb.databaseName);

        console.log('Connecting to Target:', process.env.MONGO_BACKUP_URI);
        const targetConn = mongoose.createConnection(process.env.MONGO_BACKUP_URI);
        
        await new Promise((resolve, reject) => {
            targetConn.once('open', resolve);
            targetConn.once('error', reject);
            setTimeout(() => reject(new Error('Target Connect Timeout')), 15000);
        });
        
        const targetDb = targetConn.db;
        console.log('Connected to Target DB:', targetDb.databaseName);

        const dbs = await targetDb.admin().listDatabases();
        console.log('All databases on target cluster:', dbs.databases.map(d => d.name));

        const collections = await sourceDb.listCollections().toArray();
        console.log('Collections to copy:', collections.map(c => c.name));

        for (const col of collections) {
            const colName = col.name;
            if (colName.startsWith('system.')) continue;

            console.log(`Working on collection: [${colName}]`);
            const data = await sourceDb.collection(colName).find().toArray();
            console.log(`Found ${data.length} records in [${colName}]`);

            if (data.length > 0) {
                console.log(`Checking target existence for [${colName}]...`);
                await targetDb.collection(colName).deleteMany({});
                console.log(`Inserting ${data.length} records into [${colName}]...`);
                const result = await targetDb.collection(colName).insertMany(data);
                console.log(`Insert complete for [${colName}]. Result:`, result.insertedCount);
            }
        }

        console.log('Closing connections...');
        await targetConn.close();
        await mongoose.disconnect();
        
        console.log('BACKUP PROCESS COMPLETED SUCCESSFULLY');
    } catch (err) {
        console.error('CRITICAL BACKUP FAILURE:', err);
    } finally {
        process.exit(0);
    }
};

testBackup();
