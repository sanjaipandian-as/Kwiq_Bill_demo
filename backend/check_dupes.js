const mongoose = require('mongoose');
require('dotenv').config();

const checkDuplicates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const results = await mongoose.connection.db.collection('companyprofiles').aggregate([
            { $group: { _id: '$userEmail', count: { $sum: 1 }, ids: { $push: '$userId' } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (results.length > 0) {
            console.log('DUPLICATE EMAILS FOUND:');
            console.log(JSON.stringify(results, null, 2));
        } else {
            console.log('No duplicate emails found in companyprofiles.');
        }
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

checkDuplicates();
