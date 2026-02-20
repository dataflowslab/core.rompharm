/**
 * Simple PO to JSON converter
 * Converts .po files to flat JSON structure for i18next
 */
const fs = require('fs');
const path = require('path');

function parsePo(content) {
  const translations = {};
  const lines = content.split('\n');
  let currentMsgid = null;
  let currentMsgstr = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('msgid "') && !line.includes('msgid ""')) {
      currentMsgid = line.substring(7, line.length - 1);
    } else if (line.startsWith('msgstr "')) {
      currentMsgstr = line.substring(8, line.length - 1);
      
      if (currentMsgid && currentMsgstr) {
        translations[currentMsgid] = currentMsgstr;
      }
      currentMsgid = null;
      currentMsgstr = null;
    }
  }
  
  return translations;
}

function convertPoToJson(poFile, jsonFile) {
  console.log(`Converting ${poFile} to ${jsonFile}...`);
  
  const content = fs.readFileSync(poFile, 'utf-8');
  const translations = parsePo(content);
  
  // Ensure output directory exists
  const dir = path.dirname(jsonFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(jsonFile, JSON.stringify(translations, null, 2));
  console.log(`[OK] Created ${jsonFile}`);
}

// Convert EN and RO
const localesDir = path.join(__dirname, '..', 'locales');
const outputDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

convertPoToJson(
  path.join(localesDir, 'en', 'translation.po'),
  path.join(outputDir, 'en.json')
);

convertPoToJson(
  path.join(localesDir, 'ro', 'translation.po'),
  path.join(outputDir, 'ro.json')
);

console.log('\n[OK] All translations compiled!');
