const fs = require('fs');
const path = 'd:/Zippy/Kwiq Bill Files/Kwiq_Bill_demo/Zilling-mobile/src/context/TransactionContext.js';
let content = fs.readFileSync(path, 'utf8');

const helperFunction = `
    const adjustInvoiceEffects = (invoice, direction = 1) => {
        // 1. Stock Update
        if (invoice.items && Array.isArray(invoice.items)) {
            invoice.items.forEach(item => {
                const pid = item.productId || item.id;
                const qty = parseFloat(item.quantity) || 0;
                if (pid && qty > 0) {
                    try {
                        const operator = direction === 1 ? '-' : '+';
                        db.runSync(\`UPDATE products SET stock = stock \${operator} ? WHERE id = ?\`, [Number(qty), String(pid)]);
                        if (item.variantName) {
                            const productRow = db.getFirstSync('SELECT variants FROM products WHERE id = ?', [pid]);
                            if (productRow && productRow.variants) {
                                let variantsArr = [];
                                try { variantsArr = JSON.parse(productRow.variants); } catch (e) { variantsArr = []; }
                                if (Array.isArray(variantsArr) && variantsArr.length > 0) {
                                    let updated = false;
                                    const newVariants = variantsArr.map(v => {
                                        if (v.name && v.name.trim() === item.variantName.trim()) {
                                            const currentStock = parseFloat(v.stock) || 0;
                                            v.stock = direction === 1 ? Math.max(0, currentStock - qty) : (currentStock + qty);
                                            updated = true;
                                        }
                                        return v;
                                    });
                                    if (updated) {
                                        db.runSync('UPDATE products SET variants = ? WHERE id = ?', [JSON.stringify(newVariants), pid]);
                                    }
                                }
                            }
                        }
                    } catch (stockErr) {
                        console.error(\`[TransactionContext] Failed to adjust stock for \${pid}:\`, stockErr);
                    }
                }
            });
        }
        // 2. Customer Ledger Update
        if (invoice.customerId) {
            try {
                const received = parseFloat(invoice.amountReceived) || 0;
                const total = parseFloat(invoice.total) || 0;
                const outstandingDelta = Math.max(0, total - received);
                const redeemed = parseInt(invoice.loyaltyPointsRedeemed) || 0;
                const earned = parseInt(invoice.loyaltyPointsEarned) || 0;
                const operator = direction === 1 ? '+' : '-';
                const reverseOp = direction === 1 ? '-' : '+';
                db.runSync(
                    \`UPDATE customers SET 
                        loyaltyPoints = loyaltyPoints \${reverseOp} ? \${operator} ?,
                        amountPaid = amountPaid \${operator} ?,
                        outstanding = outstanding \${operator} ?
                     WHERE id = ?\`,
                    [redeemed, earned, received, outstandingDelta, String(invoice.customerId)]
                );
            } catch (custUpdateErr) {
                console.error('[TransactionContext] Failed to adjust customer ledger:', custUpdateErr);
            }
        }
    };
`;

// 1. Insert helper function above addTransaction
content = content.replace('    const addTransaction = async (data) => {', helperFunction + '\n    const addTransaction = async (data) => {');

// 2. In addTransaction, remove loyalty and stock updates. Replace with adjustInvoiceEffects.
// Delete from "// [Loyalty Points" until "// [Sync]" that triggers INVOICE_CREATED but keep trigger
const loyaltyStr = `            // [Loyalty Points & Balance Update]`;
const split1 = content.split(loyaltyStr);
if (split1.length > 1) {
    const endStr = `            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_CREATED, newTx);`;
    
    const split2 = split1[1].split(endStr);
    if (split2.length > 1) {
        content = split1[0] + `
            // Apply Ledger & Stock Effects
            adjustInvoiceEffects(newTx, 1);
            
` + endStr + split2.slice(1).join(endStr);
    }
}

// 3. Edit editTransaction
const editFindStr = `db.runSync(
                \`UPDATE invoices SET `;
const editReplaceStr = `
            // 1. Revert Old Invoice Effects
            const oldRow = db.getFirstSync('SELECT * FROM invoices WHERE id = ?', [id]);
            if (oldRow) {
                const oldInvoice = {
                    ...oldRow,
                    items: typeof oldRow.items === 'string' ? JSON.parse(oldRow.items) : (oldRow.items || []),
                    payments: typeof oldRow.payments === 'string' ? JSON.parse(oldRow.payments) : (oldRow.payments || []),
                    customerId: oldRow.customer_id
                };
                adjustInvoiceEffects(oldInvoice, -1);
            }

            db.runSync(
                \`UPDATE invoices SET `;
content = content.replace(editFindStr, editReplaceStr);

const triggerAutoSaveStr = `triggerAutoSave();

            // [Sync]`;
const triggerAutoSaveReplaceStr = `
            // 3. Apply New Effects
            const newInvoiceForEffects = {
                ...data,
                customerId: data.customerId || oldRow?.customer_id,
            };
            adjustInvoiceEffects(newInvoiceForEffects, 1);

            triggerAutoSave();

            // [Sync]`;
content = content.replace(triggerAutoSaveStr, triggerAutoSaveReplaceStr);

// 4. Edit deleteTransaction
const delFindStr = `// 1. Restore Stock locally
            if (invoice.items && Array.isArray(invoice.items)) {
                for (const item of invoice.items) {
                    if (item.productId || item.id) {
                        db.runSync(\`UPDATE products SET stock = stock + ? WHERE id = ?\`, [item.quantity, item.productId || item.id]);
                    }
                }
            }`;
content = content.replace(delFindStr, `// 1. Revert Invoice Effects (Stock & Ledger)
            adjustInvoiceEffects(invoice, -1);`);

// 5. Edit restoreTransaction
const resFindStr = `// 1. Re-deduct Stock
            if (invoice.items && Array.isArray(invoice.items)) {
                for (const item of invoice.items) {
                    if (item.productId || item.id) {
                        db.runSync(\`UPDATE products SET stock = stock - ? WHERE id = ?\`, [item.quantity, item.productId || item.id]);
                    }
                }
            }`;
content = content.replace(resFindStr, `// 1. Re-apply Invoice Effects (Stock & Ledger)
            adjustInvoiceEffects(invoice, 1);`);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully refactored TransactionContext.js');
