# Header spacing — 28 September 2026

Final owner direction: retain original logo and tagline side by side; only separate navigation labels properly. No stacked or hidden desktop tagline.

Links keep intrinsic width, 24 px gaps and midpoint separators. Shell max width 1760 px. Full navigation begins at 1536 px; below that use the existing compact menu instead of crushing the row. Phone appears at 1800 px; secondary CTA at 1920 px. All destinations and both calculation links remain available in the compact menu. Logo, original tagline layout, Hero sentence and object solutions unchanged.

Also retain the reproduced footer overflow fix: intermediate widths use two/three columns and public six-column layout starts at 1800 px. Contact/legal text unchanged.

Production build, lint and 17 existing tests passed. Chrome at 390/768/1024/1279/1280/1366/1440/1535/1536/1600/1799/1800/1920/2560 px: no horizontal overflow; desktop tagline visible alongside logo; link gaps and neighboring blocks do not overlap; mobile and mega-menu Escape focus behavior passed. Screenshots inspected. Exact-head CI/publication pending.
