# Header spacing — 28 September 2026

Final owner direction: retain original logo and tagline side by side, space menu labels, shrink quote actions first and show/hide the online quote action according to screen space.

Links keep intrinsic width and 24px gaps with midpoint separators. Original brand/tagline layout remains. Full navigation starts at 1440px; smaller windows use compact navigation. Engineer CTA is compact/two-line below 1920px. Online CTA is hidden below 1600px and shown from 1600px; phone from 1800px. Wide screens retain original one-line buttons. Compact menu includes every destination and both quote links.

Also fix reproduced footer contact overflow at 1024px with two/three columns before the six-column layout. Protected Hero, object solutions, manufacturing claims and legal/contact text unchanged.

Production build, lint and 17 existing navigation/accessibility tests passed. Chrome verified 16 widths (390–2560px), including 1439/1440 and 1599/1600 boundaries: both CTA visibility rules, inline desktop tagline, 24px link separation, neighboring block spacing, no page overflow, compact menu and Escape focus return. RELEASE VERIFIED: PR #185; exact-head CI 36400013528 success for 3323b8d. Main 31a7d92; Publish to Beget 36400411151 success. The same 16-width Chrome check passed on https://www.steelprodukt.ru after deployment, including online CTA visibility at 1599/1600px and keyboard menu behavior.
