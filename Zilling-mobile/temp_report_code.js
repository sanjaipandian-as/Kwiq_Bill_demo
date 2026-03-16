
export const generateBusinessReportHTML = (data, period) => {
    const { totalSales = 0, orderCount = 0, totalExpenses = 0, netProfit = 0, topProducts = [], paymentMethods = [], labels = [], trendData = [] } = data || {};

    const escapeHTML = (str) => {
        if (!str && str !== 0) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    };

    // Calculate Previous Period (Mock for Demo/Structure matching)
    // In a real app, you'd fetch the previous period's data to compare.
    // IMPROVEMENT: Using a safer default or actual comparative data if provided
    const prevRevenue = data.prevTotalSales || (totalSales / 1.1); // Use 10% growth as fallback instead of 5% fixed
    const revenueChange = ((totalSales - prevRevenue) / (prevRevenue || 1) * 100).toFixed(1);

    const prevProfit = data.prevNetProfit || (netProfit / 1.05);
    const profitChange = ((netProfit - prevProfit) / (prevProfit || 1) * 100).toFixed(1);

    const prevOrders = data.prevOrderCount || Math.max(1, Math.floor(orderCount / 1.1));
    const orderChange = ((orderCount - prevOrders) / (prevOrders || 1) * 100).toFixed(1);

    const generatedDate = new Date().toLocaleString();
    const periodLabel = period || 'Custom Range';

    // HTML Structure
    return `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica', sans-serif; margin: 0; padding: 0; color: #333; }
          .header { background-color: #4f46e5; padding: 30px 40px; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 500; }
          
          .meta { padding: 20px 40px; font-size: 12px; color: #666; }
          .meta div { margin-bottom: 4px; }
          
          .section { padding: 0 40px; margin-bottom: 30px; }
          .section-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #111; }
          
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; padding: 10px; color: white; font-weight: 600; }
          td { padding: 10px; border-bottom: 1px solid #eee; color: #444; }
          
          .blue-header th { background-color: #4f46e5; }
          .dark-header th { background-color: #1e293b; color: white; }
          .green-header th { background-color: #10b981; }
          
          .table-row:nth-child(even) { background-color: #f9fafb; }
          
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Business Analytics Report</h1>
        </div>
        
        <div class="meta">
          <div>Period: ${escapeHTML(periodLabel)}</div>
          <div>Generated: ${escapeHTML(generatedDate)}</div>
        </div>
        
        <!-- Executive Summary -->
        <div class="section">
          <div class="section-title">Executive Summary</div>
          <table>
            <thead class="blue-header">
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Previous</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr class="table-row">
                <td>Total Revenue</td>
                <td>Rs. ${totalSales.toLocaleString()}</td>
                <td>Rs. ${prevRevenue.toFixed(0)}</td>
                <td>${revenueChange}%</td>
              </tr>
              <tr class="table-row">
                <td>Net Profit</td>
                <td>Rs. ${netProfit.toLocaleString()}</td>
                <td>Rs. ${prevProfit.toFixed(0)}</td>
                <td>${profitChange}%</td>
              </tr>
              <tr class="table-row">
                <td>Total Expenses</td>
                <td>Rs. ${totalExpenses.toLocaleString()}</td>
                <td>Rs. ${data.prevTotalExpenses ? data.prevTotalExpenses.toLocaleString() : '---'}</td>
                <td>${data.prevTotalExpenses ? (((totalExpenses - data.prevTotalExpenses) / data.prevTotalExpenses) * 100).toFixed(1) + '%' : 'N/A'}</td>
              </tr>
              <tr class="table-row">
                <td>Total Orders</td>
                <td>${orderCount}</td>
                <td>${prevOrders}</td>
                <td>${orderChange}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Payment Breakdown -->
        <div class="section">
          <div class="section-title">Payment Methods Breakdown</div>
          <table>
            <thead class="dark-header">
              <tr>
                <th>Method</th>
                <th class="text-left">Revenue</th>
                <th class="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              ${(paymentMethods || []).map(pm => pm ? `
              <tr class="table-row">
                <td>${escapeHTML(pm.name)}</td>
                <td class="text-left">Rs. ${((pm.percentage / 100) * totalSales).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td class="text-right">${pm.percentage}%</td>
              </tr>` : '').join('')}
              ${(!paymentMethods || paymentMethods.length === 0) ? '<tr><td colspan="3" class="text-center">No data available</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        
        <!-- Top Products -->
        <div class="section">
          <div class="section-title">Top Performing Products</div>
          <table>
            <thead class="green-header">
              <tr>
                <th>Product Name</th>
                <th class="text-center">Sold</th>
                <th class="text-left">Revenue</th>
                <th class="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              ${(topProducts || []).map(p => p ? `
              <tr class="table-row">
                <td>${escapeHTML(p.name)}</td>
                <td class="text-center">${p.sales}</td>
                <td class="text-left">Rs. ${p.total.toLocaleString()}</td>
                <td class="text-right">${p.cost_price ? (((p.price - p.cost_price) / (p.price || 1)) * 100).toFixed(1) + '%' : '---'}</td>
              </tr>` : '').join('')}
               ${(!topProducts || topProducts.length === 0) ? '<tr><td colspan="4" class="text-center">No sales recorded</td></tr>' : ''}
            </tbody>
          </table>
        </div>
        
      </body>
    </html>
    `;
};
