const fs = require('fs');
const CryptoJS = require('crypto-js');

const inputFile = 'd:\\Zippy\\Kwiq Bill Files\\Kwiq_Bill_demo\\backend\\all_company_profiles.json';
const outputFile = 'd:\\Zippy\\Kwiq Bill Files\\Kwiq_Bill_demo\\backend\\decrypted_company_profiles.json';

const profiles = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Exhaustive decryption
const decryptContent = (encryptedText, email) => {
  if (!encryptedText) return encryptedText;
  if (!encryptedText.startsWith('U2FsdGVk') && !encryptedText.startsWith('KWIQV2:')) return encryptedText;

  // 1. Static keys & basic pins
  const staticKeys = [
    'kwiq-bill-shared-salt-2024', 
    'kwiq_bill_shared_salt_2024', 
    'kwiq-bill-secret-2024', 
    'kwiq_bill_secret_salt', 
    'kwiq-bill-master-2024',
    '1234', '0000', '1111', '123456', '2580', 'admin', 'password'
  ];
  for (const sKey of staticKeys) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, sKey);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
  }

  // 2. Direct email as passphrase
  if (email) {
    try {
      let bytes = CryptoJS.AES.decrypt(encryptedText, email);
      let result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
    try {
      let bytes = CryptoJS.AES.decrypt(encryptedText, email.toLowerCase().trim());
      let result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
  }

  // 3. PBKDF2 derived keys (as passphrase)
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  const salts = [
    'kwiq_bill_shared_supreme_salt_2024_x922_long_v5_vulnerability_proof_6002',
    'kwiq-bill-shared-salt-2024',
    'kwiq_bill_secret_salt'
  ];
  const iterations = [10000, 20000, 5000, 1000];
  const hashers = [CryptoJS.algo.SHA256, CryptoJS.algo.SHA1];
  const passwords = [normalizedEmail, email, '1234', '0000', '123456'].filter(Boolean);

  for (const salt of salts) {
    for (const iter of iterations) {
      for (const hashAlgo of hashers) {
        for (const pass of passwords) {
          try {
             const keyHex = CryptoJS.PBKDF2(pass, salt, { 
               keySize: 256 / 32, 
               iterations: iter, 
               hasher: hashAlgo 
             }).toString(CryptoJS.enc.Hex);
             
             let bytes = CryptoJS.AES.decrypt(encryptedText, keyHex);
             let result = bytes.toString(CryptoJS.enc.Utf8);
             if (result && result.length > 0) return result;
          } catch (e) { }
        }
      }
    }
  }

  return encryptedText; // If all failed
};

const decryptedProfiles = profiles.map(profile => {
  const email = profile.userEmail || profile.user?.email || '';
  const newProfile = { ...profile };

  if (profile.store) {
    newProfile.store = { ...profile.store };
    const fieldsToDecrypt = ['name', 'legalName', 'contact', 'email', 'address', 'gstin', 'fssai'];
    
    for (const field of fieldsToDecrypt) {
      const val = profile.store[field];
      if (typeof val === 'string' && (val.startsWith('U2FsdGVk') || val.startsWith('KWIQV2:'))) {
         newProfile.store[field] = decryptContent(val, email);
      }
    }
    if (typeof profile.store.address === 'string' && profile.store.address.startsWith('U2FsdGVk')) {
      const decAddress = decryptContent(profile.store.address, email);
      if (decAddress.startsWith('{')) {
          try { newProfile.store.address = JSON.parse(decAddress); } catch (e) { newProfile.store.address = decAddress; }
      } else {
          newProfile.store.address = decAddress;
      }
    }
  }

  if (profile.user) {
    newProfile.user = { ...profile.user };
    const userFields = ['fullName', 'mobile', 'email'];
    for (const field of userFields) {
      if (typeof profile.user[field] === 'string' && (profile.user[field].startsWith('U2FsdGVk') || profile.user[field].startsWith('KWIQV2:'))) {
         newProfile.user[field] = decryptContent(profile.user[field], email);
      }
    }
  }

  return newProfile;
});

// Helper to remove any instances showing encrypted strings in console.
const unDecryptables = [];
decryptedProfiles.forEach(p => {
  if (p.store && p.store.name && String(p.store.name).startsWith('U2FsdGVk')) {
     unDecryptables.push(p.userEmail);
  }
});

fs.writeFileSync(outputFile, JSON.stringify(decryptedProfiles, null, 2), 'utf8');
console.log(`Successfully decrypted and saved to ${outputFile}`);
if (unDecryptables.length > 0) {
   console.log('Could not decrypt data for:', unDecryptables.join(', '));
}
