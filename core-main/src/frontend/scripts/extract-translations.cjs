const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all t('...') calls in TypeScript/TSX files
function extractTranslations(content) {
  const regex = /t\(['"`]([^'"`]+)['"`]\)/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

// Read all TypeScript/TSX files
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/i18n/**']
});

const translations = new Set();

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const found = extractTranslations(content);
  found.forEach(t => translations.add(t));
});

console.log(`Found ${translations.size} unique translation keys`);

// Read existing PO files
const enPoPath = path.join(__dirname, '../locales/en/translation.po');
const roPoPath = path.join(__dirname, '../locales/ro/translation.po');

function readPoFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return new Map();
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const entries = new Map();
  const lines = content.split('\n');
  
  let currentMsgid = null;
  let currentMsgstr = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('msgid "')) {
      currentMsgid = line.substring(7, line.length - 1);
    } else if (line.startsWith('msgstr "')) {
      currentMsgstr = line.substring(8, line.length - 1);
      if (currentMsgid !== null) {
        entries.set(currentMsgid, currentMsgstr);
        currentMsgid = null;
        currentMsgstr = null;
      }
    }
  }
  
  return entries;
}

function writePoFile(filePath, translations, existingTranslations, isEnglish) {
  const header = `# Translation file
# Generated automatically
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: ${isEnglish ? 'en' : 'ro'}\\n"

`;

  const sortedKeys = Array.from(translations).sort();
  const entries = sortedKeys.map(key => {
    const existing = existingTranslations.get(key);
    const msgstr = existing !== undefined ? existing : (isEnglish ? key : '');
    
    return `msgid "${key}"
msgstr "${msgstr}"
`;
  }).join('\n');

  fs.writeFileSync(filePath, header + entries, 'utf8');
}

// Read existing translations
const enExisting = readPoFile(enPoPath);
const roExisting = readPoFile(roPoPath);

// Write updated PO files
writePoFile(enPoPath, translations, enExisting, true);
writePoFile(roPoPath, translations, roExisting, false);

console.log(`✓ Updated ${enPoPath}`);
console.log(`✓ Updated ${roPoPath}`);
console.log('\nNext steps:');
console.log('1. Edit locales/ro/translation.po to add Romanian translations');
console.log('2. Run: npm run i18n:compile');
