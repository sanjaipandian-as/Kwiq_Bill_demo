import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generate a comprehensive PDF report with modern design
 * @param {Object} data - Report data
 * @param {Object} data.stats - Statistics data (totalSales, totalOrders, totalCustomers, totalExpenses)
 * @param {Array} data.recentTransactions - Recent transactions array
 * @param {Object} data.expenseStats - Expense statistics
 */
export const generateDashboardReport = (data) => {
    const { stats, recentTransactions, expenseStats } = data;

    // Create new PDF document
    const doc = new jsPDF();

    // Set document properties
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 25;
    let yPosition = 0;

    // ==================== ELEGANT HEADER ====================
    // Deep blue gradient header
    doc.setFillColor(30, 58, 138); // Deep blue
    doc.rect(0, 0, pageWidth, 55, 'F');

    // Accent bar
    doc.setFillColor(59, 130, 246); // Lighter blue accent
    doc.rect(0, 50, pageWidth, 5, 'F');

    // Company Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('times', 'bold');
    doc.text('Kwiqbill', pageWidth / 2, 22, { align: 'center' });

    // Report Title
    doc.setFontSize(16);
    doc.setFont('times', 'italic');
    doc.text('Business Performance Dashboard', pageWidth / 2, 35, { align: 'center' });

    // Date and Time
    doc.setFontSize(10);
    doc.setFont('courier', 'normal');
    const reportDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const reportTime = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    doc.text(`Report Generated: ${reportDate} | ${reportTime}`, pageWidth / 2, 47, { align: 'center' });

    yPosition = 75;

    // ==================== SECTION 1: FINANCIAL OVERVIEW ====================
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text('1. Financial Overview', margin, yPosition);

    yPosition += 2;

    // Section underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.8);
    doc.line(margin, yPosition, margin + 70, yPosition);

    yPosition += 12;

    // Calculate key metrics
    const netProfit = stats.totalSales - (expenseStats?.totalExpenses || 0);
    const profitMargin = stats.totalSales > 0
        ? (((stats.totalSales - (expenseStats?.totalExpenses || 0)) / stats.totalSales) * 100).toFixed(2)
        : '0.00';

    // Format currency properly
    const formatCurrency = (amount) => {
        return `Rs ${Number(amount).toFixed(2)}`;
    };

    // Financial metrics with numbering
    const financialData = [
        ['1.1', 'Total Revenue', formatCurrency(stats.totalSales)],
        ['1.2', 'Total Expenses', formatCurrency(expenseStats?.totalExpenses || 0)],
        ['1.3', 'Net Profit', formatCurrency(netProfit)],
        ['1.4', 'Profit Margin', `${profitMargin}%`]
    ];

    autoTable(doc, {
        startY: yPosition,
        body: financialData,
        theme: 'grid',
        styles: {
            fontSize: 11,
            cellPadding: 5,
            font: 'times',
            lineColor: [203, 213, 225],
            lineWidth: 0.2
        },
        columnStyles: {
            0: {
                cellWidth: 20,
                fontStyle: 'bold',
                textColor: [30, 58, 138],
                halign: 'center',
                fillColor: [239, 246, 255]
            },
            1: {
                cellWidth: 80,
                fontStyle: 'bold',
                textColor: [51, 65, 85]
            },
            2: {
                cellWidth: 70,
                halign: 'right',
                fontStyle: 'bold',
                textColor: [22, 163, 74],
                fillColor: [240, 253, 244]
            }
        },
        margin: { left: margin, right: margin }
    });

    yPosition = doc.lastAutoTable.finalY + 18;

    // ==================== SECTION 2: OPERATIONAL METRICS ====================
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text('2. Operational Metrics', margin, yPosition);

    yPosition += 2;

    // Section underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.8);
    doc.line(margin, yPosition, margin + 70, yPosition);

    yPosition += 12;

    // Calculate operational metrics
    const avgOrderValue = stats.totalOrders > 0
        ? (stats.totalSales / stats.totalOrders).toFixed(2)
        : '0.00';

    const operationalData = [
        ['2.1', 'Total Orders Processed', stats.totalOrders.toString()],
        ['2.2', 'Active Customer Base', stats.totalCustomers.toString()],
        ['2.3', 'Average Order Value', formatCurrency(avgOrderValue)],
        ['2.4', 'Recent Transactions', `${recentTransactions?.length || 0} transactions`]
    ];

    autoTable(doc, {
        startY: yPosition,
        body: operationalData,
        theme: 'grid',
        styles: {
            fontSize: 11,
            cellPadding: 5,
            font: 'times',
            lineColor: [203, 213, 225],
            lineWidth: 0.2
        },
        columnStyles: {
            0: {
                cellWidth: 20,
                fontStyle: 'bold',
                textColor: [30, 58, 138],
                halign: 'center',
                fillColor: [239, 246, 255]
            },
            1: {
                cellWidth: 80,
                fontStyle: 'bold',
                textColor: [51, 65, 85]
            },
            2: {
                cellWidth: 70,
                halign: 'right',
                fontStyle: 'bold',
                textColor: [59, 130, 246]
            }
        },
        margin: { left: margin, right: margin }
    });

    yPosition = doc.lastAutoTable.finalY + 18;

    // ==================== SECTION 3: TRANSACTION DETAILS ====================
    if (recentTransactions && recentTransactions.length > 0) {
        // Check if we need a new page
        if (yPosition > pageHeight - 100) {
            doc.addPage();
            yPosition = 30;
        }

        doc.setTextColor(30, 58, 138);
        doc.setFontSize(18);
        doc.setFont('times', 'bold');
        doc.text('3. Recent Transaction History', margin, yPosition);

        yPosition += 2;

        // Section underline
        doc.setDrawColor(59, 130, 246);
        doc.setLineWidth(0.8);
        doc.line(margin, yPosition, margin + 70, yPosition);

        yPosition += 12;

        const transactionData = recentTransactions.map((transaction, index) => [
            `3.${index + 1}`,
            (transaction.id || 'N/A').toString(),
            (transaction.customerName || transaction.customer || 'Guest').toString(),
            (transaction.method || transaction.paymentMethod || 'Cash').toString(),
            (transaction.status || 'Paid').toString(),
            formatCurrency(transaction.total || transaction.amount || 0)
        ]);

        autoTable(doc, {
            startY: yPosition,
            head: [['#', 'Invoice ID', 'Customer Name', 'Payment Method', 'Status', 'Amount']],
            body: transactionData,
            theme: 'striped',
            headStyles: {
                fillColor: [30, 58, 138],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'center',
                cellPadding: 6,
                font: 'times'
            },
            bodyStyles: {
                fontSize: 9,
                cellPadding: 5,
                textColor: [51, 65, 85],
                font: 'courier',
                overflow: 'linebreak'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center', fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 58, 138] },
                1: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
                2: { cellWidth: 40 },
                3: { cellWidth: 28, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' },
                5: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] }
            },
            margin: { left: margin, right: margin }
        });

        yPosition = doc.lastAutoTable.finalY + 18;
    }

    // ==================== SECTION 4: EXECUTIVE SUMMARY ====================
    if (yPosition > pageHeight - 90) {
        doc.addPage();
        yPosition = 30;
    }

    doc.setTextColor(30, 58, 138);
    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text('4. Executive Summary', margin, yPosition);

    yPosition += 2;

    // Section underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.8);
    doc.line(margin, yPosition, margin + 70, yPosition);

    yPosition += 12;

    // Summary box with elegant border
    const summaryBoxY = yPosition;
    const boxHeight = 65;

    doc.setFillColor(252, 252, 253); // Very light gray background
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1);
    doc.roundedRect(margin, summaryBoxY, pageWidth - (margin * 2), boxHeight, 4, 4, 'FD');

    yPosition += 12;

    doc.setFontSize(11);
    doc.setFont('times', 'normal');
    doc.setTextColor(51, 65, 85);

    const summaryPoints = [
        { num: '4.1', text: `Business generated a total revenue of Rs ${Number(stats.totalSales).toFixed(2)} during this period.` },
        { num: '4.2', text: `Successfully processed ${stats.totalOrders} orders with an average value of Rs ${avgOrderValue}.` },
        { num: '4.3', text: `Net profit stands at Rs ${Number(netProfit).toFixed(2)} with a profit margin of ${profitMargin}%.` },
        { num: '4.4', text: `Active customer base comprises ${stats.totalCustomers} registered customers.` },
        { num: '4.5', text: `Total operational expenses recorded at Rs ${Number(expenseStats?.totalExpenses || 0).toFixed(2)}.` }
    ];

    summaryPoints.forEach((point, index) => {
        doc.setFont('times', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.text(point.num, margin + 5, yPosition + (index * 11));

        doc.setFont('times', 'normal');
        doc.setTextColor(51, 65, 85);
        const textLines = doc.splitTextToSize(point.text, pageWidth - (margin * 2) - 20);
        doc.text(textLines, margin + 15, yPosition + (index * 11));
    });

    // ==================== PROFESSIONAL FOOTER ====================
    const totalPages = doc.internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        const footerY = pageHeight - 20;

        // Footer separator line
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

        // Left footer text
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('courier', 'normal');
        doc.text('Generated by ', margin, footerY);

        // Center - Confidential
        doc.setFont('times', 'bolditalic');
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.text('CONFIDENTIAL BUSINESS REPORT', pageWidth / 2, footerY, { align: 'center' });

        // Right - Page numbers
        doc.setFont('courier', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(9);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
    }

    // Generate filename with timestamp
    const filename = `Business_Report_${new Date().toISOString().split('T')[0]}.pdf`;

    // Save the PDF
    doc.save(filename);

    return filename;
};

/**
 * Generate a detailed sales report with date range
 * @param {Object} data - Report data with date range
 */
export const generateSalesReport = (data) => {
    const { transactions, startDate, endDate, stats } = data;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('times', 'bold');
    doc.text('Sales Performance Report', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('courier', 'normal');
    if (startDate && endDate) {
        doc.text(`Reporting Period: ${startDate} to ${endDate}`, pageWidth / 2, 30, { align: 'center' });
    }

    let yPosition = 55;

    // Sales Summary
    const summaryData = [
        ['Metric', 'Value'],
        ['Total Sales', `Rs ${stats.totalSales.toFixed(2)}`],
        ['Total Transactions', stats.totalTransactions.toString()],
        ['Average Transaction Value', `Rs ${stats.avgTransactionValue.toFixed(2)}`]
    ];

    autoTable(doc, {
        startY: yPosition,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], font: 'times' },
        bodyStyles: { font: 'courier' }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Transactions Table
    if (transactions && transactions.length > 0) {
        const transactionData = transactions.map(t => [
            new Date(t.date).toLocaleDateString('en-IN'),
            t.id,
            t.customerName || 'Guest',
            `Rs ${Number(t.total).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: yPosition,
            head: [['Date', 'Invoice ID', 'Customer', 'Amount']],
            body: transactionData,
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138], font: 'times' },
            bodyStyles: { font: 'courier' }
        });
    }

    const filename = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    return filename;
};
