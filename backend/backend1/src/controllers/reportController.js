const { withDB } = require("../db/db");
const { exportReport } = require("../db/exportReport");
/**
 * Dashboard summary
 */
exports.getDashboardStats = async (req, res) => {
  const db = await withDB(req);
  const { startDate, endDate } = req.query;

  // Helper to fetch stats for a specific range
  const fetchPeriodStats = (start, end) => {
    // 1. Sales & Orders
    const salesStats = db.prepare(`
      SELECT 
        COALESCE(SUM(total), 0) as sales, 
        COALESCE(SUM(total_cost), 0) as cogs,
        COALESCE(SUM(discount), 0) as discounts,
        COUNT(*) as orders 
      FROM invoices 
      WHERE date >= ? AND date <= ?
    `).get(start, end);

    // 2. Expenses
    const expenseStats = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM expenses 
        WHERE date >= ? AND date <= ?
    `).get(start, end);

    const sales = salesStats.sales || 0;
    const cogs = salesStats.cogs || 0;
    const orders = salesStats.orders || 0;
    const discounts = salesStats.discounts || 0;
    const expenses = expenseStats.total || 0;

    const grossProfit = sales - cogs;
    const netProfit = grossProfit - expenses;
    const aov = orders > 0 ? (sales / orders) : 0;

    return { sales, orders, expenses, netProfit, aov, grossProfit, discounts };
  };

  // Current Period
  const current = fetchPeriodStats(startDate || new Date(0).toISOString(), endDate || new Date().toISOString());

  // Previous Period Calculation
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates - avoid "Invalid Date" toISOString() crash
  if (!startDate || !endDate || isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.warn("⚠️ Invalid or missing date range provided for dashboard stats, using all-time fallback:", { startDate, endDate });
    return res.json({
      sales: { value: current.sales, prev: 0, change: 0 },
      orders: { value: current.orders, prev: 0, change: 0 },
      expenses: { value: current.expenses, prev: 0, change: 0 },
      netProfit: { value: current.netProfit, prev: 0, change: 0 },
      discounts: { value: current.discounts, prev: 0, change: 0 },
      returns: { value: 0, prev: 0, change: 0 },
      margins: { gross: { value: 0, change: 0 }, net: { value: 0, change: 0 } },
      aov: { value: current.aov, prev: 0, change: 0 },
      totalSales: current.sales,
      totalOrders: current.orders,
      totalCustomers: 0,
      totalExpenses: current.expenses,
      pendingInvoices: 0
    });
  }

  const duration = end.getTime() - start.getTime();

  const prevEnd = new Date(start.getTime() - 1); // 1ms before current start
  const prevStart = new Date(prevEnd.getTime() - duration);

  const prevStats = fetchPeriodStats(prevStart.toISOString(), prevEnd.toISOString());

  // Helper for % change
  const calcChange = (curr, prev) => {
    if (prev === 0) return null; // Return null to indicate no prior data
    return ((curr - prev) / prev) * 100;
  };

  // Counts (Snapshot, not period change usually)
  const totalCustomers = db.prepare(`SELECT COUNT(*) as count FROM customers`).get().count || 0;
  const pendingInvoices = db.prepare(`
    SELECT COUNT(*) as count FROM invoices WHERE status = 'Unpaid' OR status = 'Pending'
  `).get().count || 0;

  // Margins (Current)
  const grossMargin = current.sales > 0 ? (current.grossProfit / current.sales) * 100 : 0;
  const netMargin = current.sales > 0 ? (current.netProfit / current.sales) * 100 : 0;

  // Margins (Previous)
  const prevGrossMargin = prevStats.sales > 0 ? (prevStats.grossProfit / prevStats.sales) * 100 : 0;
  const prevNetMargin = prevStats.sales > 0 ? (prevStats.netProfit / prevStats.sales) * 100 : 0;

  res.json({
    sales: {
      value: current.sales,
      prev: prevStats.sales,
      change: calcChange(current.sales, prevStats.sales)
    },
    orders: {
      value: current.orders,
      prev: prevStats.orders,
      change: calcChange(current.orders, prevStats.orders)
    },
    expenses: {
      value: current.expenses,
      prev: prevStats.expenses,
      change: calcChange(current.expenses, prevStats.expenses)
    },
    netProfit: {
      value: current.netProfit,
      prev: prevStats.netProfit,
      change: calcChange(current.netProfit, prevStats.netProfit)
    },
    discounts: {
      value: current.discounts,
      prev: prevStats.discounts,
      change: calcChange(current.discounts, prevStats.discounts)
    },
    returns: {
      value: 0, // Placeholder
      prev: 0,
      change: 0
    },
    margins: {
      gross: { value: grossMargin, change: calcChange(grossMargin, prevGrossMargin) },
      net: { value: netMargin, change: calcChange(netMargin, prevNetMargin) }
    },
    aov: {
      value: current.aov,
      prev: prevStats.aov,
      change: calcChange(current.aov, prevStats.aov)
    },

    // Legacy (for backward compat if needed anywhere else, though Dashboard.jsx will use new structure)
    totalSales: current.sales,
    totalOrders: current.orders,
    totalCustomers,
    totalExpenses: current.expenses,
    pendingInvoices
  });
};

/**
 * Financial summary
 */
exports.getFinancials = async (req, res) => {
  const db = await withDB(req);
  const { startDate, endDate } = req.query;

  // Build Filter
  let querySales = `SELECT COALESCE(SUM(total), 0) AS value FROM invoices WHERE 1=1`;
  let queryExpenses = `SELECT COALESCE(SUM(amount), 0) AS value FROM expenses WHERE 1=1`;
  const args = [];

  if (startDate) {
    querySales += ` AND date >= ?`;
    queryExpenses += ` AND date >= ?`;
    args.push(startDate);
  }
  if (endDate) {
    querySales += ` AND date <= ?`;
    queryExpenses += ` AND date <= ?`;
    args.push(endDate);
  }

  // Execute
  // Note: args need to be doubled for expenses if we used a single query, but here we run two separate queries
  // We need to re-construct args for each query

  const argsSales = [];
  const argsExpenses = [];
  if (startDate) { argsSales.push(startDate); argsExpenses.push(startDate); }
  if (endDate) { argsSales.push(endDate); argsExpenses.push(endDate); }

  const income = db.prepare(querySales).get(...argsSales).value;
  const expenses = db.prepare(queryExpenses).get(...argsExpenses).value;

  res.json({
    income,
    totalExpenses: expenses,
    netProfit: income - expenses,
  });
};

/**
 * Top products
 */
exports.getTopProducts = async (req, res) => {
  const db = await withDB(req);
  const { startDate, endDate, groupBy = 'product' } = req.query;

  // 1. Fetch current valid products with details
  const activeProducts = db.prepare('SELECT id, name, category, brand FROM products').all();
  const productMap = new Map();
  activeProducts.forEach(p => productMap.set(p.id, {
    name: p.name,
    category: p.category || 'Uncategorized',
    brand: p.brand || 'No Brand'
  }));

  let query = `SELECT items FROM invoices WHERE 1=1`;
  const params = [];

  if (startDate) {
    query += ` AND date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND date <= ?`;
    params.push(endDate);
  }

  const invoices = db.prepare(query).all(...params);
  const statsMap = {};

  invoices.forEach(inv => {
    try {
      const items = JSON.parse(inv.items);
      if (Array.isArray(items)) {
        items.forEach(item => {
          const pId = item.productId || item.id || item._id;

          if (pId && productMap.has(pId)) {
            const product = productMap.get(pId);

            // Determine Group Key
            let key = product.name; // default
            if (groupBy === 'category') key = product.category;
            else if (groupBy === 'brand') key = product.brand;

            if (!statsMap[key]) {
              statsMap[key] = {
                quantity: 0,
                revenue: 0,
                cost: 0,
                hasCostData: false
              };
            }

            const qty = (parseFloat(item.quantity) || 0);
            const rev = (parseFloat(item.total) || 0);

            statsMap[key].quantity += qty;
            statsMap[key].revenue += rev;

            // Cost Calculation
            if (item.costPrice !== undefined) {
              const unitCost = parseFloat(item.costPrice) || 0;
              statsMap[key].cost += (unitCost * qty);
              statsMap[key].hasCostData = true;
            }
          }
        });
      }
    } catch (e) { }
  });

  const sortedResults = Object.entries(statsMap)
    .map(([name, stats]) => {
      let marginPercent = 0;
      if (stats.hasCostData && stats.revenue > 0) {
        const profit = stats.revenue - stats.cost;
        marginPercent = (profit / stats.revenue) * 100;
      }

      return {
        name,
        quantity: stats.quantity,
        revenue: stats.revenue,
        marginPercent
      };
    })
    .sort((a, b) => b.revenue - a.revenue) // Sort by revenue by default for top lists
    .slice(0, 10); // increased limit slightly

  res.json(sortedResults);
};

exports.getPaymentMethods = async (req, res) => {
  const db = await withDB(req);
  const { startDate, endDate } = req.query;

  let query = `SELECT payments FROM invoices WHERE 1=1`;
  const params = [];

  if (startDate) {
    query += ` AND date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND date <= ?`;
    params.push(endDate);
  }

  const invoices = db.prepare(query).all(...params);
  const methodStats = {};

  invoices.forEach(inv => {
    try {
      const payments = JSON.parse(inv.payments);
      if (Array.isArray(payments)) {
        payments.forEach(p => {
          if (p.method && p.amount) {
            methodStats[p.method] = (methodStats[p.method] || 0) + parseFloat(p.amount);
          }
        });
      }
    } catch (e) {
      // ignore
    }
  });

  const result = Object.entries(methodStats).map(([method, amount]) => ({
    name: method,
    value: amount
  }));

  res.json(result);
};

exports.getSalesTrend = async (req, res) => {
  const db = await withDB(req);
  const { startDate, endDate } = req.query;

  let query = `SELECT date, total, 1 as count FROM invoices WHERE 1=1`;
  const params = [];

  if (startDate) {
    query += ` AND date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND date <= ?`;
    params.push(endDate);
  }
  query += ` ORDER BY date ASC`;

  const invoices = db.prepare(query).all(...params);

  // Determine Aggregation Level
  let isHourly = false;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationHours = (end - start) / (1000 * 60 * 60);
    if (durationHours <= 48) {
      isHourly = true;
    }
  }

  // Aggregate
  const trend = {};

  invoices.forEach(inv => {
    let key;
    if (isHourly) {
      // YYYY-MM-DDTHH:00:00.000Z format approx
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) {
        key = inv.date.split('T')[0] || 'Invalid Date';
      } else {
        d.setMinutes(0, 0, 0);
        key = d.toISOString(); // Keep ISO for consistency
      }
    } else {
      key = inv.date ? inv.date.split('T')[0] : 'Invalid Date'; // Simple YYYY-MM-DD extraction
    }
    trend[key] = {
      sales: (trend[key]?.sales || 0) + (inv.total || 0),
      orders: (trend[key]?.orders || 0) + 1
    };
  });

  const result = Object.entries(trend)
    .map(([date, data]) => ({ date, sales: data.sales, orders: data.orders }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(result);
};

exports.getCustomerMetrics = async (req, res) => {
  const db = await withDB(req);
  const { startDate, endDate } = req.query;

  // New Customers in period
  let newCustQuery = `SELECT COUNT(*) as count FROM customers WHERE 1=1`;
  const newCustParams = [];
  if (startDate) {
    newCustQuery += ` AND date(createdAt) >= date(?)`;
    newCustParams.push(startDate);
  }
  if (endDate) {
    newCustQuery += ` AND date(createdAt) <= date(?)`;
    newCustParams.push(endDate);
  }
  const newCustomers = db.prepare(newCustQuery).get(...newCustParams)?.count || 0;

  // Returning customers (bought in period and has previous orders, or just > 1 order total?)
  // Let's go with: customers who bought in this period and have > 1 invoice total.
  // Optimized Query:
  let activeCustQuery = `SELECT customer_id FROM invoices WHERE 1=1`;
  const activeCustParams = [];
  if (startDate) {
    activeCustQuery += ` AND date >= ?`;
    activeCustParams.push(startDate);
  }
  if (endDate) {
    activeCustQuery += ` AND date <= ?`;
    activeCustParams.push(endDate);
  }

  // Get unique customers active in this period
  const activeCustomers = db.prepare(`SELECT DISTINCT customer_id FROM (${activeCustQuery})`).all(...activeCustParams).map(c => c.customer_id);

  let returningCustomers = 0;
  if (activeCustomers.length > 0) {
    const placeholders = activeCustomers.map(() => '?').join(',');
    // Check which of these have > 1 invoice
    // We only need count, faster to group
    const returningRows = db.prepare(`
      SELECT customer_id 
      FROM invoices 
      WHERE customer_id IN (${placeholders}) 
      GROUP BY customer_id 
      HAVING COUNT(*) > 1
    `).all(...activeCustomers);
    returningCustomers = returningRows.length;
  }

  const totalActive = activeCustomers.length;
  const repeatRate = totalActive > 0 ? (returningCustomers / totalActive) * 100 : 0;

  // CLV - Average value of all orders per customer (simplified)
  // or Total Sales / Total Unique Customers (All Time)
  const clvStats = db.prepare(`
    SELECT 
      SUM(total) as totalSales, 
      COUNT(DISTINCT customer_id) as totalCust 
    FROM invoices
  `).get();

  const clv = clvStats.totalCust > 0 ? (clvStats.totalSales / clvStats.totalCust) : 0;

  res.json({
    newCustomers,
    returningCustomers,
    repeatRate,
    clv
  });
};
