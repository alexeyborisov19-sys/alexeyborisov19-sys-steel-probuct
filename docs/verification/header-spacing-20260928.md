# Header spacing — 28 September 2026

Owner photo shows adjacent navigation labels merging. Desktop header previously allowed each flex link to shrink below its unwrapped text width while a fixed-width logo/tagline and actions occupied the remaining row.

Fix: links retain intrinsic width, 24 px gaps and midpoint separators; wider shell capped at 1760 px. Owner explicitly retains the tagline: between 1280 and 1799 px it is stacked below the logo; on wider screens it stays alongside. Phone appears at 1600 px, second calculation CTA at 1800 px. Mobile navigation retains every destination and both calculation links. Logo, destination labels, protected Hero copy and object solutions unchanged.

Chrome production-build verification: 390, 768, 1024, 1279, 1280, 1366, 1440, 1536, 1600, 1799, 1800, 1920, 2560 px. Desktop link gaps at least 24 px; brand/navigation/actions do not overlap; keyboard Escape returns focus from mobile and mega menus. Screenshots inspected at 1280 and 1920 px.

Additional reproduced defect: footer contacts overflowed the page at 1024 px because six columns activated too early. Use two/three columns at intermediate widths; public six-column footer starts at 1800 px. No contact/legal content changes.

17 existing navigation/accessibility/discovery tests passed. Final production build and live verification are recorded after release.
