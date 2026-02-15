const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const localesDir = path.join(__dirname, '..', 'locales');
const outputDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

async function compilePo() {
  console.log('Compiling .po files to JSON...');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const languages = ['en', 'ro'];

  for (const lang of languages) {
    const poFile = path.join(localesDir, lang, 'translation.po');
    const jsonFile = path.join(outputDir, `${lang}.json`);

    if (fs.existsSync(poFile)) {
      try {
        // Use i18next-conv to convert .po to .json
        const command = `npx i18next-conv -l ${lang} -s ${poFile} -t ${jsonFile}`;
        await execAsync(command);
        console.log(`��� Compiled ${lang}.po to ${lang}.json`);
      } catch (error) {
        console.error(`✗ Error compiling ${lang}.po:`, error.message);
      }
    } else {
      console.warn(`⚠ ${poFile} not found, skipping...`);
    }
  }

  console.log('Translation compilation complete!');
}

compilePo().catch(console.error);
