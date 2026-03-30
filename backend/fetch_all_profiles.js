const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const fetchAllProfiles = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI not found in .env');
            return;
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('companyprofiles');

        console.log('Fetching all company profiles...');
        const records = await collection.find({}).toArray();

        console.log(`Found ${records.length} records.`);

        // Save to file
        const outputFile = path.join(__dirname, 'all_company_profiles.json');
        fs.writeFileSync(outputFile, JSON.stringify(records, null, 2));
        console.log(`All profiles exported to ${outputFile}`);

        // Table-like output for summary
        console.log('\n--- Profiles Summary ---');
        records.forEach((r, index) => {
            console.log(`${index + 1}. User Email: ${r.userEmail || 'N/A'} | Store Name: ${r.store?.name || 'N/A'} | Completed: ${r.onboardingCompletedAt ? 'YES' : 'NO'}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

fetchAllProfiles();
