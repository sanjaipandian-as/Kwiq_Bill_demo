const mongoose = require("mongoose");
const { initDB } = require("./index");

async function migrate(user) {
  await mongoose.connect(process.env.MONGO_URI);

  const Customer = require("../models/customerModel");
  const customers = await Customer.find({ userId: user._id });

  const db = await initDB(user.googleSub);

  const insert = db.prepare(`
    INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  customers.forEach(c => {
    insert.run(
      c._id.toString(),
      c.customerId,
      c.firstName,
      c.lastName,
      c.customerType,
      c.gstin,
      c.email,
      c.phone,
      JSON.stringify(c.address),
      c.source,
      JSON.stringify(c.tags),
      c.loyaltyPoints,
      c.notes,
      c.totalVisits,
      c.totalSpent,
      c.due,
      c.createdAt.toISOString(),
      c.updatedAt.toISOString()
    );
  });

  console.log("Migration complete");
}

module.exports = migrate;
