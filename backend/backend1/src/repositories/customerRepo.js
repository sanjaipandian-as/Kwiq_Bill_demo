function createCustomer(db, data) {
  const stmt = db.prepare(`
    INSERT INTO customers (
      customer_id, first_name, last_name, customer_type, gstin,
      email, phone, street, area, city, pincode, state,
      source, loyalty_points, notes, user_id,
      created_at, updated_at
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `);

  return stmt.run(
    data.customerId,
    data.firstName,
    data.lastName,
    data.customerType,
    data.gstin,
    data.email,
    data.phone,
    data.address?.street,
    data.address?.area,
    data.address?.city,
    data.address?.pincode,
    data.address?.state,
    data.source,
    data.loyaltyPoints || 0,
    data.notes || "",
    data.userId,
    new Date().toISOString(),
    new Date().toISOString()
  );
}

module.exports = { createCustomer };
