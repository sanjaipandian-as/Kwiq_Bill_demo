const fs = require('fs');
const CryptoJS = require('crypto-js');

const profiles = JSON.parse(fs.readFileSync('all_company_profiles.json', 'utf8'));

const decryptContent = (encryptedText, email, keyOrSalt, testName) => {
  if (!encryptedText) return null;

  if (keyOrSalt && typeof keyOrSalt === 'string' && keyOrSalt.length >= 32) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, keyOrSalt);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return `Success with predefined key (${testName}): ${result}`;
    } catch (e) { }
  }

  const staticKeys = ['kwiq-bill-shared-salt-2024', 'kwiq_bill_shared_salt_2024', 'kwiq-bill-secret-2024', 'kwiq_bill_secret_salt', 'kwiq-bill-master-2024'];
  for (const sKey of staticKeys) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, sKey);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return `Success with staticKey ${sKey}: ${result}`;
    } catch (e) { }
  }

  if (email) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, email);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return `Success with exact raw email (${email}): ${result}`;
    } catch (e) { }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, email.toLowerCase().trim());
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return `Success with normalized email (${email.toLowerCase().trim()}): ${result}`;
    } catch (e) { }
  }

  return null;
};

for (const profile of profiles) {
  const encName = profile.store?.name;
  if (!encName || !encName.startsWith('U2FsdGVk')) continue;

  const email = profile.userEmail;
  const legacySalt = 'kwiq_bill_secret_salt';
  const standardSalt = 'kwiq-bill-shared-salt-2024';

  const PBKDF2_legacy = CryptoJS.PBKDF2(email.toLowerCase().trim(), legacySalt, { keySize: 256/32, iterations: 10000, hasher: CryptoJS.algo.SHA256 }).toString(CryptoJS.enc.Hex);
  const PBKDF2_standard = CryptoJS.PBKDF2(email.toLowerCase().trim(), standardSalt, { keySize: 256/32, iterations: 10000, hasher: CryptoJS.algo.SHA256 }).toString(CryptoJS.enc.Hex);
  const PBKDF2_standard_20000 = CryptoJS.PBKDF2(email.toLowerCase().trim(), standardSalt, { keySize: 256/32, iterations: 20000, hasher: CryptoJS.algo.SHA256 }).toString(CryptoJS.enc.Hex);
  const PBKDF2_standard_1000 = CryptoJS.PBKDF2(email.toLowerCase().trim(), standardSalt, { keySize: 256/32, iterations: 1000, hasher: CryptoJS.algo.SHA256 }).toString(CryptoJS.enc.Hex);

  const keys = [
    { key: PBKDF2_standard, name: "PBKDF2_standard" },
    { key: PBKDF2_legacy, name: "PBKDF2_legacy" },
    { key: PBKDF2_standard_20000, name: "PBKDF2_standard_20000" },
    { key: PBKDF2_standard_1000, name: "PBKDF2_standard_1000" }
  ];

  let res = null;
  for (const k of keys) {
    res = decryptContent(encName, email, k.key, k.name);
    if (res) break;
  }
  
  if (!res) res = decryptContent(encName, email, null, "null_key");

  console.log(`Email: ${email}`);
  console.log(`Encrypted: ${encName}`);
  console.log(`Decrypted: ${res}`);
  console.log('---');
}
