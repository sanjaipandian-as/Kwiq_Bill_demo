const { db } = require('./src/services/database');
async function check() {
  try {
    const deleted = await db.getAllAsync('SELECT * FROM products WHERE is_deleted = 1');
    console.log('Deleted products count:', deleted.length);
    console.log('Deleted products:', deleted);
  } catch (e) {
    console.error(e);
  }
}
check();
