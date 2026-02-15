const mongoose = require('mongoose');

const settingsSchema = mongoose.Schema(
    {
        userId: {
            type: String, // email-<base64>
            required: true,
            unique: true
        },
        userEmail: { type: String }, // Top level email as requested
        // --- Store Profile ---
        store: {
            name: { type: String, default: 'My Billing Co.' }, // Display Name
            legalName: { type: String, default: '' }, // Legal Business Name
            businessType: { type: String, default: 'Proprietorship' }, // Proprietorship, Partnership, LLP, Pvt Ltd
            contact: { type: String, default: '' },
            email: { type: String, default: '' },
            website: { type: String, default: '' },
            // Detailed Address
            address: {
                street: { type: String, default: '' },
                area: { type: String, default: '' },
                city: { type: String, default: '' },
                state: { type: String, default: '' },
                pincode: { type: String, default: '' },
                country: { type: String, default: 'India' }
            },
            footer: { type: String, default: 'Thank you for shopping with us!' },
            terms: { type: Boolean, default: true },

            // Statutory
            gstin: { type: String, default: '' },
            fssai: { type: String, default: '' },
            pan: { type: String, default: '' },
            logo: { type: String, default: '' }, // Changed from Boolean to String to hold base64/URL
            logoUrl: { type: String, default: '' },
            signatureUrl: { type: String, default: '' }
        },

        // --- Bank Details ---
        bankDetails: {
            accountName: { type: String, default: '' },
            accountNumber: { type: String, default: '' },
            ifsc: { type: String, default: '' },
            bankName: { type: String, default: '' },
            branch: { type: String, default: '' }
        },

        // --- Owner Profile (Onboarding) ---
        user: {
            fullName: { type: String, default: '' },
            mobile: { type: String, default: '' },
            email: { type: String, default: '' },
            role: { type: String, default: 'Owner' },
            consent: {
                analytics: { type: Boolean, default: true },
                contact: { type: Boolean, default: true }
            }
        },

        // --- Tax & localization ---
        tax: {
            gstEnabled: { type: Boolean, default: true },
            defaultType: { type: String, default: 'Exclusive' }, // Inclusive/Exclusive
            gstin: { type: String, default: '' }, // Keep top level for backward compat or migrate? Better keep inside store or here. Let's keep duplicate/primary here if used by calculation logic. Actually schema had it here.

            // Tax Matrix / Groups
            taxGroups: [
                {
                    id: String,
                    name: String, // e.g. "GST 18%"
                    rate: Number, // 18
                    cgst: Number, // 9
                    sgst: Number, // 9
                    igst: Number, // 18
                    cess: { type: Number, default: 0 },
                    active: { type: Boolean, default: true }
                }
            ],
            // Statutory Info
            registrationType: { type: String, default: 'Regular' }, // Regular, Composition
            state: { type: String, default: '' },
            priceMode: { type: String, default: 'Exclusive' },
            automaticTax: { type: Boolean, default: true },
            slabs: [ // Keep backward compatibility for now, but UI uses taxGroups
                {
                    id: String,
                    name: String,
                    rate: Number,
                    active: Boolean,
                },
            ],
        },

        // --- Preferences ---
        defaults: {
            currency: { type: String, default: 'INR' },
            timeZone: { type: String, default: 'Asia/Kolkata' },
            language: { type: String, default: 'en' },
            printLanguage: { type: String, default: 'en' }, // For invoice text
            hsnCode: { type: String, default: '' }
        },

        // --- Invoice Customization ---
        invoice: {
            // Layout & Format
            template: { type: String, default: 'Classic' }, // Classic, Compact, Modern, GST-Detailed
            paperSize: { type: String, default: 'A4' }, // A4, A5, Thermal-3inch, Thermal-2inch

            // Visual Elements Toggles
            showLogo: { type: Boolean, default: true },
            showWatermark: { type: Boolean, default: false },
            showStoreAddress: { type: Boolean, default: true },
            showSignature: { type: Boolean, default: true },

            // Content Toggles
            showTaxBreakup: { type: Boolean, default: true },
            showHsn: { type: Boolean, default: true },
            showMrp: { type: Boolean, default: false }, // MRP vs Selling Price
            showSavings: { type: Boolean, default: true }, // "You saved ₹X"
            showCustomerGstin: { type: Boolean, default: true },
            showLoyaltyPoints: { type: Boolean, default: false },
            showQrcode: { type: Boolean, default: true }, // UPI QR
            showTerms: { type: Boolean, default: true },
            showB2bGstin: { type: Boolean, default: true },

            // Text Content
            headerTitle: { type: String, default: 'Tax Invoice' },
            footerNote: { type: String, default: 'Thank you for your business!' },
            termsAndConditions: { type: String, default: '1. Goods once sold will not be taken back.\n2. Interest @18% pa will be charged if not paid within due date.' },

            // Logic
            roundingType: { type: String, default: 'Nearest' }, // Nearest, Up, Down, None
        },

        lastUpdatedBy: { type: String }, // User name/ID
        lastUpdated: { type: Date }, // Requested explicitly
        onboardingCompletedAt: { type: Date },
        lastUpdatedAt: { type: Date },
        // Soft delete fields
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'companyprofiles' // Force specific collection name
    }
);

// Query middleware to filter out soft-deleted records
settingsSchema.pre('find', function () {
    this.where({ isDeleted: false });
});

settingsSchema.pre('findOne', function () {
    this.where({ isDeleted: false });
});

settingsSchema.pre('countDocuments', function () {
    this.where({ isDeleted: false });
});

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
