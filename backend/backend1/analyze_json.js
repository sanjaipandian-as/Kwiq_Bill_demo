const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:\\Users\\john\\Documents\\BillingSoftware\\google-116609331518824508785\\data\\invoices\\invoices.json', 'utf-8'));

const today = '2026-02-11';
const todayInvoices = data.filter(inv => {
    const dateStr = inv.date || inv.created_at;
    if (!dateStr) return false;
    // Handle both ISO strings and local date strings
    const datePart = dateStr.split('T')[0];
    return datePart === today;
});

console.log(`Summary for ${today}:`);
console.log(`Total bills: ${todayInvoices.length}`);

// Sort by date to see sequence
todayInvoices.sort((a, b) => new Date(a.date) - new Date(b.date));

todayInvoices.forEach((inv, index) => {
    console.log(`${index + 1}. ID: ${inv.id}, Bill #: ${inv.bill_number}, Date: ${inv.date}, Total: ${inv.total}`);
});

// Check sequence
const billNums = todayInvoices.map(inv => inv.bill_number).filter(n => n !== null);
console.log('\nBill Number Sequence:', billNums.join(', '));

const duplicates = billNums.filter((item, index) => billNums.indexOf(item) !== index);
if (duplicates.length > 0) {
    console.log('Duplicates found:', duplicates);
}

const gaps = [];
for (let i = 1; i < billNums.length; i++) {
    if (billNums[i] !== billNums[i - 1] + 1) {
        gaps.push({ prev: billNums[i - 1], current: billNums[i] });
    }
}
if (gaps.length > 0) {
    console.log('Gaps found:', gaps);
} else {
    console.log('No sequence gaps found.');
}
