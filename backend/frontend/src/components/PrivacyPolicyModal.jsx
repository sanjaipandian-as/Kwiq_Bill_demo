import React from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Shield, Lock, Cloud, ServerOff } from 'lucide-react';

const PrivacyPolicyModal = ({ isOpen, onClose }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Data Privacy & Security"
            className="w-full max-w-2xl"
        >
            <div className="space-y-6 text-slate-700">
                {/* Introduction */}
                <div className="bg-blue-50 p-4 rounded-lg flex gap-4 items-start">
                    <Shield className="h-8 w-8 text-blue-600 flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-blue-800 text-lg">Your data is yours.</h4>
                        <p className="text-sm text-blue-700">
                            We believe in complete data ownership. This application follows a <strong>Local-First</strong> architecture, meaning your business data never leaves your device unless you explicitly back it up.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Local Storage */}
                    <div className="border border-slate-200 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <ServerOff className="h-5 w-5 text-indigo-600" />
                            <h3 className="font-bold text-slate-900">Local & Encrypted</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                            All your invoices, customers, and products are stored locally on your computer in an encrypted database (`billing.db`).
                        </p>
                        <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                            <li>No central server sees your data.</li>
                            <li>Encryption keys are stored safely Keytar/Windows Credential Manager.</li>
                            <li>You can work 100% offline.</li>
                        </ul>
                    </div>

                    {/* Drive Backup */}
                    <div className="border border-slate-200 p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                            <Cloud className="h-5 w-5 text-emerald-600" />
                            <h3 className="font-bold text-slate-900">Google Drive Backup</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                            To prevent data loss (e.g., if your computer breaks), we automatically backup encrypted copies to your Google Drive.
                        </p>
                        <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                            <li>Backups live in <code>/BillingSoftware</code> in <strong>your</strong> Drive.</li>
                            <li>We only access files created by this app.</li>
                            <li>We cannot see your other Drive files.</li>
                        </ul>
                    </div>
                </div>

                {/* Consent Info */}
                <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg">
                    <p className="mb-2 font-semibold">Why do we ask for Google Drive permissions?</p>
                    <p>
                        When you sign in with Google, we request the <code>drive.file</code> permission.
                        This strictly limits our access to <strong>only files and folders created by this application</strong>.
                        We absolutely cannot access your photos, documents, or personal emails.
                    </p>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800">
                        I Understand
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default PrivacyPolicyModal;
