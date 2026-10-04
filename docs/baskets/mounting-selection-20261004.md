# Wall and ventilated-facade selection — local review

Base: ce4d9af. Scope: the existing basket configurator only; no publication, no legal/consent or price-tier changes.

## Behaviour

- Direct wall: facade layer is zero; the outdoor unit's rear clearance is retained.
- Ventilated facade: the full layer from bearing wall to exterior cladding is entered separately. Wall-to-unit-rear distance is layer + rear clearance.
- This is not the full bracket arm length. Unit feet, basket fixings, substrate, combined loads and structural design still determine the bracket and anchors. No unsupported thickness/load rating is assigned.
- The basket attaches to the outdoor-unit brackets. Its rear panel folds do not attach to the wall. The approved open-top illustration is unchanged.
- One rear-clearance value is shared with the size step. A facade change never enlarges the basket envelope or panel price. Empty values remain unknown; zero is an intentional value.
- Existing saved specifications stay compatible. New wall kind is retained in JSON and the engineer/TXT brief. Conflicting legacy offset does not override an existing fit's rear clearance.
- All result screens and text briefs state that the calculation is approximate.

## Primary-source checks

Read 4 October 2026. External products establish reference practices, not Steel Produkt structural approvals.

- Mitsubishi Electric MUY-GK18VA, PDF page 2 (printed page8): rear clearance 100mm or more, subject to the displayed free-space conditions on the other sides. The UI exposes100mm only as an explicit optional example with the original instruction link and model-specific caveat. It never replaces an entered clearance automatically. https://www.mitsubishielectric.com.hk/uploads/download/430/MSY-GK18VA_GF24VA.pdf
- Daikin RXM20–35R/ARXM25–35R, PDF page26: rear >100mm for one rear wall; >150mm in the shown three-sided arrangement. The published file is marked draft, so it is not used to assert a universal setting. https://www.daikin.eu/content/dam/document-library/Installer-reference-guide/ac/split/RXM-R,ARXM-R_Installer%20reference%20guide_4PEN519439-8L_English.pdf
- CTC bracket catalogue distinguishes ordinary and ventilated facades and describes a separate embedded part for ventilated systems. Its listed component sizes/thicknesses are not imported as our approved load ratings. https://www.korziny-ctc.ru/nasha-produktsiya/kronshteyny/
- Korbas differentiates brackets for uninsulated walls and ventilated facades. https://korbas.ru/produkciya/korzina-dlya-kondicionera/

## Verification

- 47 focused basket tests passed, including unknown/zero, wall-mode switching, stale legacy values, manual-to-auto gap preservation, specification roundtrip, and unchanged quantity price when only facade depth changes.
- Production build, type checks and lint passed. Browser mounting workflow at320/390/1440 and automatic-sizing regressions at390/1440 passed without axe violations, overflow or runtime errors; verified against the updated local preview. Mobile and desktop screenshots inspected.

No real enquiry or customer data submitted. No production deployment performed.
