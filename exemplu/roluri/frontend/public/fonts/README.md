# Custom Fonts

This directory contains custom fonts for DataFlows Core.

## Fonts Used

- **Inter**: Regular text (italic, regular, bold)
- **Montserrat**: Titles and headings (bold)

## Download Instructions

### Option 1: Google Fonts (Recommended)

**Inter:**
1. Visit: https://fonts.google.com/specimen/Inter
2. Click "Get font" → "Download all"
3. Extract the ZIP file
4. Navigate to `static/` folder
5. Copy these files to this directory:
   - `Inter-Italic.ttf` → Convert to WOFF2 or use as is
   - `Inter-Regular.ttf` → Convert to WOFF2 or use as is
   - `Inter-Bold.ttf` → Convert to WOFF2 or use as is

**Montserrat:**
1. Visit: https://fonts.google.com/specimen/Montserrat
2. Click "Get font" → "Download all"
3. Extract the ZIP file
4. Navigate to `static/` folder
5. Copy this file to this directory:
   - `Montserrat-Bold.ttf` → Convert to WOFF2 or use as is

### Option 2: Direct Download (WOFF2 format)

You can use online tools to convert TTF to WOFF2 for better web performance:
- https://cloudconvert.com/ttf-to-woff2
- https://everythingfonts.com/ttf-to-woff2

### Option 3: Use CDN (Alternative)

If you prefer not to host fonts locally, you can use Google Fonts CDN by editing `src/frontend/public/fonts/fonts.css`:

```css
/* Replace @font-face declarations with: */
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@700&display=swap');
```

## Required Files

Place these files in this directory:

```
src/frontend/public/fonts/
├── fonts.css              # Font declarations (already created)
├── Inter-Italic.woff2     # ← DOWNLOAD THIS
├── Inter-Regular.woff2    # ← DOWNLOAD THIS
├── Inter-Bold.woff2       # ← DOWNLOAD THIS
└── Montserrat-Bold.woff2  # ← DOWNLOAD THIS
```

## Converting TTF to WOFF2

If you downloaded TTF files, convert them to WOFF2 for better performance:

**Using online tools:**
1. Go to https://cloudconvert.com/ttf-to-woff2
2. Upload your TTF file
3. Download the WOFF2 file
4. Rename to match the expected filename

**Using command line (if you have fonttools):**
```bash
pip install fonttools brotli
pyftsubset Inter-Regular.ttf --output-file=Inter-Regular.woff2 --flavor=woff2
```

## Verification

After placing the font files:

1. Rebuild the frontend:
   ```bash
   cd src/frontend
   npm run build
   cd ../..
   ```

2. Start the application:
   ```bash
   python -m invoke run
   ```

3. Open browser DevTools (F12) → Network tab
4. Reload the page
5. Check if font files are loaded (look for .woff2 files)

## Font Usage

- **Inter** is automatically applied to all body text
- **Montserrat** is automatically applied to all headings (h1-h6, Title components)
- Configured in `src/frontend/src/styles/overrides.css`

## Troubleshooting

**Fonts not loading?**
- Check file names match exactly (case-sensitive)
- Check files are in correct directory
- Clear browser cache (Ctrl+F5)
- Check browser console for 404 errors

**Fonts look wrong?**
- Verify font files are not corrupted
- Try re-downloading from Google Fonts
- Check font-family names in CSS match font files

## License

Both Inter and Montserrat are open-source fonts:
- **Inter**: SIL Open Font License 1.1
- **Montserrat**: SIL Open Font License 1.1

You are free to use them in commercial and personal projects.
