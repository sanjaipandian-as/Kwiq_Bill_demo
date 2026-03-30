/**
 * Convert expenses data to CSV format and trigger download
 * @param {Array} expenses - Array of expense objects
 * @param {string} filename - Optional filename (defaults to expenses-{timestamp}.csv)
 */
export const exportToCSV = (expenses, filename) => {
    if (!expenses || expenses.length === 0) {
        alert('No expenses to export');
        return;
    }

    // CSV header
    const headers = [
        'Title',
        'Amount',
        'Category',
        'Date',
        'Payment Method',
        'Reference',
        'Tags',
        'Recurring',
        'Frequency',
        'Next Due Date',
        'Notes'
    ];

    // Escape CSV values
    const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    // Format date
    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    // Convert expenses to CSV rows
    const rows = expenses.map(expense => {
        return [
            escapeCSV(expense.title),
            escapeCSV(expense.amount),
            escapeCSV(expense.category),
            formatDate(expense.date),
            escapeCSV(expense.paymentMethod || ''),
            escapeCSV(expense.reference || ''),
            escapeCSV(expense.tags?.join('; ') || ''),
            expense.isRecurring ? 'Yes' : 'No',
            escapeCSV(expense.frequency || ''),
            formatDate(expense.nextDueDate),
            escapeCSV(expense.description || '')
        ].join(',');
    });

    // Combine header and rows
    const csv = [headers.join(','), ...rows].join('\n');

    if (window.electron && window.electron.saveFile) {
        window.electron.saveFile({
            title: 'Save Expenses CSV',
            defaultPath: filename || `expenses-${Date.now()}.csv`,
            content: csv,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        }).then(result => {
            if (result.success) {
                if (window.electron.showAlert) window.electron.showAlert('Export successful!', 'info');
            } else if (result.error) {
                console.error(result.error);
                if (window.electron.showAlert) window.electron.showAlert('Failed to save file.', 'error');
            }
        });
    } else {
        // Fallback
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename || `expenses-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

/**
 * Download CSV from backend API
 * @param {string} apiUrl - Backend API URL
 * @param {string} token - Auth token
 */
export const downloadCSVFromAPI = async (apiUrl, token) => {
    try {
        const response = await fetch(`${apiUrl}/expenses/export/csv`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to export expenses');
        }

        const csvContent = await response.text();

        if (window.electron && window.electron.saveFile) {
            window.electron.saveFile({
                title: 'Save Expenses CSV',
                defaultPath: `expenses-${Date.now()}.csv`,
                content: csvContent,
                filters: [{ name: 'CSV Files', extensions: ['csv'] }]
            });
        } else {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `expenses-${Date.now()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }

    } catch (error) {
        console.error('Error exporting CSV:', error);
        throw error;
    }
};