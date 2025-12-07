# Background Images

Place your custom background images here:

- **sidebar_bg.png** - Background for the left sidebar menu
- **main_bg.png** - Background for the main content area

## Recommended Specifications

### sidebar_bg.png
- **Dimensions**: 250px width (or larger for retina displays)
- **Format**: PNG, JPG, or WebP
- **File size**: Keep under 500KB for performance
- **Style**: Subtle patterns work best, avoid busy images

### main_bg.png
- **Dimensions**: 1920x1080 or larger
- **Format**: PNG, JPG, or WebP
- **File size**: Keep under 1MB for performance
- **Style**: Light, subtle patterns or gradients work best for readability

## Tips

1. **Use subtle patterns**: Busy backgrounds can make text hard to read
2. **Light colors**: Keep backgrounds light for better contrast with dark text
3. **Optimize images**: Use tools like TinyPNG to reduce file size
4. **Test readability**: Make sure text is still readable with your backgrounds
5. **Adjust opacity**: Edit `overrides.css` to change overlay opacity if needed

## Customization

To adjust the overlay opacity, edit `src/frontend/src/styles/overrides.css`:

```css
/* For sidebar - change 0.85 to your preferred value (0.0 to 1.0) */
.mantine-AppShell-navbar::before {
  background: rgba(255, 255, 255, 0.85);
}

/* For main area - change 0.9 to your preferred value (0.0 to 1.0) */
.mantine-AppShell-main::before {
  background: rgba(255, 255, 255, 0.9);
}
```

## Removing Backgrounds

To remove backgrounds, simply delete the image files or comment out the CSS in `overrides.css`.
