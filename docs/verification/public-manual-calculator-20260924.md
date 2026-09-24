# Public manual calculator — 24 September 2026

Website `/online-order`; separate from the 100-position desktop application.

- Maximum five positions across manual and uploaded CAD, enforced in client/server.
- Five hole groups per part. Counts are positive integers within safe numeric and physical area bounds. No five-hole quantity cap or allocation of one object per hole.
- Manual DXF declaration is revalidated on the server; noncanonical geometry and extra pricing fields are rejected. Rectangles/holes are estimates requiring engineering review.
- Editing retains part ID, services and quantity. Additions invalidate previous totals; concurrent ingestion is guarded.
- Server-only arithmetic mean of configured laser volume tiers for the same material/thickness. Original metal prices, other operation rates and commercial policy remain private. No invented missing rates; protected recalculation retains the shop book.
- Public DTO exposes totals and necessary warnings, no rates, supplier purchase prices, coefficients or direct costs.

Validation:

- 1,399 tests passed, including 2,304 synthetic cases: 128 service subsets × three materials × three quantities × with/without holes.
- 768 isolated private-basis estimates: 128 service subsets × three materials × quantities 1/50, five hole groups. All prices finite; all selected operations included; no confidential DTO fields.
- Browser: five-position/five-group limits, disabled hole controls, editing, all seven services, quantity 50, removal/addition, 200,000 holes with engineering warning, responsive 390/768/1440, no JS errors.
- Browser caught delayed focus stealing rapid numeric input. Layout-commit focus fixed it and the same scenario passed.
- Existing CAD browser flow passed: DXF, missing/filled service inputs, explicit subtotal with unread CAD, bent STEP preview/price and responsive layouts.
- Production build, typecheck and lint passed. No dependencies or legal/consent changes. No lead/CRM submission. Extended browser and deployment progress is recorded in the journal.
