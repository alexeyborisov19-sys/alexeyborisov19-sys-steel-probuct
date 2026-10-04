## Live checkpoint — basket visual preview, 4 October 2026

Base d12c47ea5e9e859b970ced22d619b13d82112575 (unchanged prior price-display candidate). Current redesign is local for owner review; not a published release. DONE: four-step light calculator, photorealistic open-top reference and reactive pattern/RAL model, keyboard inputs, specification import/export, 10-slot approved price eligibility, corrected common-bracket mounting description. Independent review findings corrected: invalid hidden settings, visible insufficient-space warning, exact pattern in exports and old-project imports, pattern-independent 10-slot preview. Build/lint, focused tests and responsive browser checks are recorded in docs/baskets/visual-preview-20261004.md. DONE: final production build, ESLint, all21 focused tests, four responsive browser runs and actual photo decode. Preview prepared for3158. NEXT ACTION: owner reviews local design; any later publication requires exact-commit checks and live verification. No change to legal/consent, advertising or other calculators; no fake real enquiry sent.

## 2026-10-04 — Simplify customer price display
Owner requests removal of base-price and quantity-tier displays. Preserved approved quantity calculation internally. Show preliminary result for supported 900×600×550 dimensions only; other dimensions retain engineer quote instead of misleading baseline. No invented custom-price formula. Build, lint, quantity boundary test passed; local preview updated.

## 2026-10-04 — Owner authorizes publication of basket calculator and free-services navigation
Latest user explicitly requests publication, superseding local-only restriction for this basket/site change. Homepage and tools list share five service entries; basket SEO metadata updated. No checkout/payment enabled. Release pending exact-head tests and deployment verification.

## Basket configurator draft — 4 October 2026

Base951c26e (PR229); reviewed intervening PR224–229 and preserved attribution, analytics, schema and service navigation. Owner authorized starting basket calculator and directed source lookup to local Bitrix. Indexed942 candidate files; private PDF text/provenance at /Users/alex/.codex/reports/basket-design-20261004/. Visually inspected actual assembly and3mm bracket drawings. Different components have different thicknesses; project36/60kg conditions are not universal capacity. DONE draft: four-step configuration, exact round/capsule rectangular-field perforation metrics, separate front/side patterns, complete validated engineer/TXT handoff. Unknown facade dimensions remain unknown. No private drawings/rates published. Price/BOM/bracket applicability, model catalog and batch input remain IN PROGRESS. Final build/lint,1516 tests and browser390/1440 passed; no accessibility/overflow/runtime failures. NEXT ACTION: finish checks and preserve draft; then derive reference BOM and verified bracket applicability from source drawings before publishing a whole-basket price. This is not a completed priced calculator.

## Search visibility checkpoint — 3 October 2026

Owner authorizes visibility improvements and publication. Base73e8f57; read-only Yandex audit37106575205 succeeded. Top500 of909 queries for23–29September show stronger exhibition traffic than commercial traffic; not an all-query ranking estimate. BIM page appeared in search2October. Added commercial direction links on home and fixed Hero attribution loss with existing allowlisted AttributionLink. Regression first: four Hero cases failed before fix, all14 attribution cases passed after fix. Production build, lint,1508 tests, npm audit0, SEO99URLs/18redirects/8retired0errors,24 browser desktop/mobile cases0axe/runtime/overflow/budget errors. Screenshots reviewed. No extra JS dependency or images; consent and lead sending unchanged. DONE: exact-head CI37107354660/37107354636 passed; PR223 merged as0c5109e9 and deploy37107681926 succeeded. IndexNow37107977327, legal runtime37107977323 and live attribution37107977314 passed. Local live14 attribution scenarios and24 responsive browser cases passed. NEXT ACTION: compare subsequent commercial impressions/clicks/enquiries against baseline after recrawl; no remaining release action. No ranking guarantee or budget change.

## Live checkpoint — customer resources, 3 October 2026

Base deployed86ff426 (PR221). Owner requests necessary pages and niche-leading site quality/SEO; no ranking guarantees. DONE: audit existing service/product inventory, competitor resource patterns (Protolabs/Protocase), Yandex duplicate/useful-content guidance; four task-oriented customer pages, contextual links, corrected footer quality/material targets, matching FAQ/breadcrumb/metadata/sitemap and llms discovery. No duplicated product/city landing pages, new commercial promises, analytics/consent changes or dependencies. Browser baseline404 confirmed; candidate eight responsive cases pass with axe0, working links/download/attribution and unknown-guide404.1508 tests, build/type/lint, dependency audit0 and99-page SEO/18redirects/8retired gates passed. Screenshot review completed. DONE: candidate7c98a79 CI37104245013/37104244992 passed; PR222 merged73e8f57 and deployment37104565116 succeeded. Live8-case browser audit passed after deployment; first probe during switch correctly saw old404 and was rerun after completion. IndexNow accepted65URLs including four explicitly requested guides. Proof: /Users/alex/.codex/reports/customer-resources-20261003/. NEXT ACTION: observe search indexing and enquiry quality; no pending release work for this scope.

## Live checkpoint — commercial pages, 3 October 2026

Base main2723824 includes calculator Clean-param consolidation after employee release522c93f. Prior employee task complete: Windows installer/activation published and independently verified. Current owner request: redesign existing basket and custom-fabrication canonical pages based on researched competitors; retain all legal controls and calculators. DONE: research, design plan, bounded basket dimensional brief and tests, two dedicated page layouts. DONE: 1504 tests, production build/type/lint; 95-page SEO and 18 redirects/8 retired URLs; 8 browser cases at320/390/768/1440 with no overflow, broken images, runtime errors or axe violations. TXT download and basket→contacts attribution/consent verified without sending leads. Reviewed desktop/mobile screenshots. Release CI found newly reviewed GHSA-vfj7-8cjw-p6xm in braces3.0.3 (no upstream patch). Added explicitly named MIT vendored depth-guard fork, documented review deadline, dependency override and four regressions; clean npm ci, unchanged npm audit (0 vulnerabilities), lint/build and1508 tests pass. macOS tests use canonical /private/tmp to avoid OS temporary-directory symlink mismatch. DONE: candidate c819193 passed CI37102567716/37102567689; PR221 merged as86ff426 and deployed via37102939157. Live8-case responsive/browser/interaction/consent audit passed; IndexNow37103148005 succeeded. Evidence: /Users/alex/.codex/reports/commercial-landings-20261003/. NEXT ACTION: observe real enquiries; no remaining release action for these pages. No external catalog dimensions claimed as our inventory or universal standard.

## Employee calculator checkpoint — 2 October 2026

Base 1831871 (PR219); this worktree adds an isolated, disabled-by-default employee activation service. Owner explicitly requests Windows installation without Google Drive, local editable rates, per-device activation/revocation and update download; existing owner Mac installation must remain unchanged. DONE: Windows CI 37029125262 verified packaging, login, password change, editable settings, activation gate and install/reinstall/uninstall preservation; four server regressions; administrator page desktop/mobile overflow checks and HTTP step-up/CSRF/create/revoke checks. IN PROGRESS: final fixed-directory installer CI, server PR220 and protected production setup. NEXT ACTION: enable only after exact-head CI and check live activation/download; do not distribute a candidate as ready. No owner credentials, actual basis or client projects committed. No claim that downloadable local code provides tamper-proof licensing.

## Legal review publication — 2 October 2026

Owner explicitly requests removing republished reviews and reducing legal risks. Base af0efa6 tree matches published b86df43. Removed three review excerpts and author names from public data/rendering; retained outbound source links only. Included previously authorized Russian cookie labels and regulator-journal validation/dual-store fixes. Full local suite1496 passed, build/lint passed. Independent live scan13 pages before this release found no external requests/cookies before consent; third-party152scan five-page report flagged only personal-data publication requiring manual evidence. IN PROGRESS: responsive browser gate, exact-head CI and deployment. NEXT ACTION: verify live removal and cookie gating. Signed approvals, processor agreements and historical consent evidence cannot be certified by code/scanners; no automatic lead deletion or fabricated approvals introduced.

## Scanner follow-up — 2 October 2026

Owner authorizes independent review and necessary wording fixes. Changed cookie settings/link labels consistently to Russian explanatory wording; preserved vendor equipment names, consent logic and historical live snapshot.54 targeted tests/typecheck passed. Live clean-browser checks on four public pages again show no mc.yandex requests or preconnect/dns-prefetch before choice. Changes local, not deployed; hidden scanner findings cannot be certified resolved without evidence.

## Regulator export check — 1 October 2026

Owner requested storage-register export verification. Local fixes: aggregate quote and assistant lead stores (deduplicate roots), reject non-object JSON records without crashing, reject nonexistent calendar request dates. Passed24 targeted journal/storage/stage4 tests, typecheck, targeted ESLint, and actual synthetic CLI generation of private JSON/Markdown with both sources and no planted subject name. Stage4 fixture covers protected ZIP lifecycle and expiry. No real customer exports or official transfers performed. Changes not deployed; production verification and broader legal completeness remain separate.

## Runtime verification — 1 October 2026, legal controls

PR216 merged55f3965; deployment36916757795 succeeded on third attempt. Audit36920246184:26/26 leads indexed, expired0, missing consent audit7, missing/corrupt files0; expiry/index timers active;28 old local archives removed,0 older than30days remain. Cold SQLite WAL failure SQLITE_CANTOPEN reproduced immediately after index/export close. PR217 grants backup service RW only private admin for sidecars; source connection remains mode=ro. Installer36919907956 verified two cold cycles successfully. PR217 mergedb86df43 after green CI36919967497; automatic main deployment36920784468 and post-deploy legal audit36921382321 both succeeded. All8 legal pages live390/1440 passed. User confirms RKN notification submitted; registry number/content unverified, no resubmission. Signed internal approvals/processor acceptance and7 historical consent cases require actual evidence. No automatic lead deletion; do not claim otherwise. Final private package/report: /Users/alex/.codex/reports/legal-controls-20261001/. DONE: b86df43 deploy verified and final ZIP saved to /Users/alex/Downloads/Сталь-Продукт_Юрдокументы_Проверено_2026-10-01.zip; never fabricate signatures/consent or mark legal compliance complete from code alone.

## Legal controls implementation — 1 October 2026

Read-only production audit 36913357939: PD_ADMIN_ENABLED=true, quote records26 / indexed11, consent records19, expired0; local archives58 / older than30days28; backup timer active. Corrected outdated disabled-admin statements. Implemented consistent SQLite backup staging, narrowly scoped local archive retention after successful restore verification, daily index/expiry monitoring and expired-export timer installation after deployment. No automatic lead deletion, fake approvals or fabricated consent records. Added free nonexclusive BIM/calculator-output permission to terms. Local: build/lint passed,1493 suite tests plus daily-index regression; responsive eight legal pages390/1440 passed. IN PROGRESS: exact-head CI, deployment, server verification. RKN/processor-contract/signature evidence remains separate from technical controls.

## Legal controls closure — 1 October 2026

Prior PR215 is published at d2da86e. Current branch inherits equivalent source a552794 plus owner-requested internal document corrections. Owner authorizes closing remaining legal/technical gaps. IN PROGRESS: consistent SQLite backup and local rotation; BIM use terms; retention runtime audit. Existing legal statements must not be treated as verified contractual facts. NEXT ACTION: test changes, exact-head review/CI and publish only validated controls. RKN registry and processor acceptance remain evidence requirements.

## Legal review checkpoint — 1 October 2026

Base main 2ef9c0c (#213) includes named processors and separate analytics consent. Earlier attribution work #211 is published and live verified. Owner now expressly requests review and correction of legal documents. Scope: immediate advertising opt-out, current localization wording, privacy disclosure without internal architecture; preserve consent gates, retention, email-only delivery. DONE: immediate advertising opt-out, collection-localization clarification and removal of internal architecture from privacy; public drafts synchronized. Build/lint passed; 38 focused regressions passed. Eight legal pages passed mobile/desktop browser checks; live consent gating/withdrawal passed. Full suite exposed three macOS temporary-path alias failures (pass with canonical TMPDIR) and one localization wording assertion now fixed and retested. NEXT ACTION: exact-head CI, authorized publication and live document verification. Organizational facts (RKN notification, processor contracts) must not be inferred from website code.

## Live checkpoint — attribution navigation, 30 September 2026

Base main 53b1ec7 (#210), deployed successfully via 36712126864. Since the prior BIM checkpoint, #207 published STEP-based BIM, #208/#209 repaired selected enquiry links and BIM headings, and #210 improved enquiry options and multipart diagnostics. Existing browser/SEO gates passed for that deployed revision. Read-only live recheck 36714999966 reproduced lost campaign parameters through header Contacts; production-to-calculator and cassette handoff also contain plain links. This is an attribution defect, not proof that all enquiries failed or that Semrush visibility loss came from #205/#206.

Owner explicitly authorized fixes and publication on 30 September. DONE: repaired public navigation, catalog/product links and calculator/engineer handoffs using existing same-origin allowlisted attribution. Preserved the in-page calculator anchor and all calculation query fields. Browser regression failed on all 10 baseline journeys, then passed all 10 on the built candidate with UTM/yclid in intercepted multipart payloads. Full local gate: build/type/lint, 1485 tests, zero dependency vulnerabilities, 94 SEO URLs, 18 redirects/7 retired URLs and 24 responsive browser cases with no runtime, overflow or axe violations. No real enquiries or emails sent; consent, prices, manufacturing facts and advertising settings unchanged. Added PR and post-deploy attribution gates. Final review found no remaining blocking issue in this change. IN PROGRESS: exact-head CI and authorized publication. NEXT ACTION: merge only after green CI, verify deployed source and live intercepted enquiry journeys; acquisition volume and Semrush visibility still require separate measurement.

## Live checkpoint — STEP-based BIM geometry, 29 September 2026

Base c83242918, branch fix/bim-cassette-geometry-20260929. DONE: four owner STEP meshes imported with native bends/holes, shared preview/IFC geometry, proportional non-overlapping diagram, source-specific profiles. v6 and 48-DXF audit recovered; older uploaded HTML formulas disagree with verified OT allowance, so unfolding is not used as folded geometry. Independent IFC checks passed native/adapted profiles; 1461 tests passed before final colour-area correction. Corner remains explicitly simplified from drawing. DONE: final colour-area correction, build/lint, 1461 tests and Chrome390/1440 regression. IN PROGRESS: independent exported IFC and publication gate. NEXT ACTION: publish after exact-head CI, then verify live page and downloads.

## BIM geometry correction — 29 September 2026

Owner reports overlapping/unrealistic cassettes. Base c83242918 deployed. Source PDFs inspected privately in Bitrix24:25-3022 closed545x545x0.7, depth20, side returns10, bottom15, top28/hook11.5 at35deg;25-2581 open700x590x1, depth20, single-fold sides;25-1351 corner290/330x380x1, depth20. Existing generator only generic5-prism tray; UI clamps proportions and constantgap unrelated to dimensions. NEXT ACTION: reproduce array behaviour, add source-based profile geometry/shared preview/export, test real IFC geometry and clearances. Never publish customer source files or claim fabrication-ready/RFA.

## Funnel completion — 29 September 2026

Base cfbcf7c (#205) deployed36616027013, live owner DXF attribution verified. Mail read-only36617332802 confirms all12 saved IDs in INBOX;2 explicitly test-marked. Owner forbids duplicate resends and Bitrix integration. Runtime check390/1440:tag HTTP200 and collection attempted only after consent; test collector requests blocked to avoid pollution. DONE: prior NEXT ACTION complete. DONE: BIM export goal and duplicate form-start focus regression fixed. Lint/build and all1457 tests passed. Browser390/1440 verified IFC/CSV downloads and consent; intercepted quote submit counts one form start. Read-only history36617780897: counter created13Sep, no visits14–20Sep,72 visits21–28Sep. Temporary audit workflows removed from final diff. NEXT ACTION: exact-head CI, publish and goal sync; historical loss remains partly unexplained.

## Acquisition attribution fix — 29 September 2026

DONE: live CAD→contacts lost UTM/yclid reproduced; same-origin allowlisted URL forwarding and email source fields added without persistent tracking.1457 tests passed; final focused44 tests, build/lint passed; local browser handoff and intercepted submit verified. Direct6 observed negative phrases added in4 groups; budget/state unchanged, verified readback36613939778. Matched audit36612512714 confirms1569 clicks vs31 ad visits; aggregate12 SMTP-sent records are not proof of12 commercial customers. Owner says email only, no Bitrix, no duplicate resends. NEXT ACTION: exact-head CI, publish, live CAD handoff test; actual inbox receipt and attribution gap remain unproven.

## Acquisition audit — 29 September 2026

Live main94d3467 (#204), CI and deploy36605296423 succeeded. Website16.5% verified on original DXF:2706.45RUB, no exposed surcharge; desktop unchanged. NEXT ACTION: matched-period Metrika/Direct and funnel audit; preserve consent and budgets. Browser session expired, use protected read-only API.

## Website final percentage — 29 September 2026

Owner explicitly restores 16.5% in final website prices only, with no visible percentage or breakdown. Apply once in existing protected commercial formula; fixed1000RUB stays disabled. Desktop unchanged. Base62377d7 deployed and actual1.dxf verified. NEXT ACTION: policy tests, exact-head CI, publish and compare live quote.

## Verified release — owner 1.dxf, 29 September 2026

DONE: PR203 exact head1173a04 passed both CI runs36600836058/36600836119; main62377d7 deployed via36603266718. Live original file returns HTTP200, estimate2323.14RUB for cold steel1mm/quantity1/laser only, with explicit open-path and stale-price warnings. Mac staged packaged app tested through isolated authenticated session: estimate3041.65RUB using local tariffs, then installed and launched; desktop health OK, source commit32005c1. Neither result is production approval; original file remains private. Tests1455 passed. NEXT ACTION: owner can re-upload original or recalculate; investigate supplier fallback freshness separately. This documentation update is not a new functional release.

## Live checkpoint — owner DXF failure, 29 September 2026

Base 422e48f (#202) published, consent browser checks passed. Intervening #200 IndexNow, #201 compact reviews and #202 analytics do not alter CAD. Owner supplies /Users/alex/Downloads/1.dxf and requests both calculators fixed; earlier authorization permits preliminary prices with explicit manufacturing warnings. File remains private, do not commit original.
Reproduced live: 132 shapes (71 lines, 61 circles), 2938.19 x 700.89 mm, 16.2815 m total paths. Parser succeeds but flat-feature reconstruction flags branched/open paths, factual pricing blocks, client hides cause. Investigate measured-path estimate without repairing/approving production topology; preserve unsupported/nonfinite/self-intersection protections. NEXT ACTION: focused regression, both client/internal pricing verification, publish and update installed application.

## Live checkpoint — free-services publication verified, 29 September 2026

Base 973420f (#199) deployed (36529147768), goal sync succeeded. Live /tools mobile/desktop accessibility, attribution, manual entry and brief download passed. SEO 94 URLs / 18 redirects / 7 retired URLs and 1453 tests passed. Yandex Business BIM/services post persisted and is on moderation.
FOUND: post-deploy IndexNow check expected Avito immediately after profile heading; adding official Yandex Maps earlier changed ordering. All other live checks passed. Fix marker ordering without dropping URL/profile checks; keep HTML diagnostic output bounded to matches.
NEXT ACTION: exact-head CI and publish workflow fix; verify successful indexing submission. No ranking guarantee.

## Live checkpoint — free services and acquisition, 29 September 2026

Base cd701224 (#198) deployed successfully (36483063532), 7 Metrika goals created (36483063619); live controlled failure/retry returned price and correct events. Previous NEXT ACTION complete.
DONE: free-services hub, earlier homepage calculator entry, manual-input deep link, downloadable manufacturing brief, Yandex promotion within current budgets. Preserve hero/header/industry content, calculation formulas and consent.
Validation: initial build/lint/type/1453 tests, mobile/desktop tools-page axe, attribution and manual deep-link checks passed.
NEXT ACTION: final browser/SEO checks, exact-head CI, publication and live verification; publish Yandex materials without increasing spend.

## Live checkpoint — measurable calculator acquisition, 28 September 2026

Base b9ca18c (#197): exact-head checks, deploy 36479862704, live 12 browser scenarios and 93 SEO URLs passed. Previous NEXT ACTION completed.
DONE: public calculator funnel via existing consented analytics; distinguish complete/partial/no-price results from transport errors and lead success. No prices, consent policy, protected content or advertising budgets changed.
Validation: lint/type/build and 1453 tests passed. macOS temporary-directory alias caused three unrelated initial path assertions; rerun with canonical TMPDIR passed all.
NEXT ACTION: browser verification, exact-head CI, publish and verify goal sync.

## Live checkpoint — browser quality gate, 28 September 2026

Base 4c3e668 (#196): candidate hero warmup deployed successfully (36477260192), all 12 encodes ran on origin before promotion and public AVIF response returned image-cache HIT. Prior #195 reduced speculative JS; no universal field-LCP improvement claimed.
DONE: Playwright/axe browser gate for six representative public routes at 390/1440, contrast fixes, keyboard-focusable product table and visibly underlined consent links. Consent wording/behavior, rates, calculator internals, protected header/hero/industry sections unchanged. Lint/build/type/1452 tests passed. Gate also checks homepage JS budget, overflow, runtime errors, keyboard skip and navigation to manual calculation.
Security follow-up: patched Next.js 15.5.24, Sharp 0.35.5, Nodemailer 9.1.1 and js-yaml; full npm audit zero, rebuild and 1452 tests passed.
NEXT ACTION: exact-head browser + full CI, authorized publish, live browser/SEO verification. Automated axe does not constitute complete WCAG certification; field INP/SEO rankings remain unmeasured.

## Live checkpoint — public loading performance, 28 September 2026

Base main b435300a (#194), published via successful deploy 36470988095. Since the prior journal entry, surcharge fix #193 was published and verified, and #194 added verified reviews. Owner requests faster loading. Scope: marketing showcase and navigation only; no calculation or consent changes.
DONE: disabled automatic route prefetch in Header, Footer, Hero and CAD entry; showcase now server-rendered with existing CSS hover treatment, no Framer dependency or hidden pre-hydration cards. Brand, preloader, consent and calculation logic unchanged. Build/lint/type, 1452 tests, SEO 93 URLs and browser 390/1440 navigation/manual-input checks passed. Local initial bytes 274 KB vs baseline live 430 KB; not a same-server timing claim.
NEXT ACTION: exact-head CI, authorized deploy and repeated live performance comparison.

## Live checkpoint — remove per-part surcharges, 28 September 2026

Base published b6b6a874 (#192), deploy 36463011132 and exact-head CI succeeded. Owner explicitly requests disabling 1000 RUB per part and 16.5% final surcharge. Shared commercial policy currently loads fixed/final charges from private environment.
DONE: both disabled in active loader regardless of legacy environment. Other coefficients and historical formula retained. Build/lint/type and 1452 tests passed; regression covers 1/5/100 quantities, missing old env and hand-computed 1420→170 example. Live pre-change DXF 100x60 gives 24.3/121.5/1215 RUB for 1/5/50, so no fixed 1000 uplift reproduced in that live scenario. Publication authorized.
NEXT ACTION: exact-head CI, deploy and live DXF verification.

## Live checkpoint — calculator discovery clarity, 28 September 2026

Base published main d42cc4f (#191); exact-head checks, deploy 36461132102 and IndexNow 36461688643 succeeded. Owner authorizes further evidence-based visibility fixes and publication. Public search returns branded site and CAD page, but CAD snippet still reflects older content; not a measurement of ChatGPT citations or ranking.
DONE: context links from laser/bending services; visible DXF/STEP/manual comparison; qualified STEP claims. Build/lint/type and 1451 tests passed; Chromium 390/1440 links/schema and SEO 93 URLs passed. Existing metadata already describes free manual/CAD calculation; do not repeatedly rewrite it to chase stale snapshots.
NEXT ACTION: exact-head CI, publish and verify live. Evidence: docs/verification/discovery-clarity-20260928.md.

## Live checkpoint — Alice search access, 28 September 2026

Base published main 4c5fbda (#190); CI 36458580792/36458581281 and deploy 36459149004 succeeded, live Chromium/text endpoints passed. Owner requests Yandex Alice availability.
DONE: explicit YandexAdditional / YandexAdditionalBot public-content rules with existing private exclusions. Build/lint/type and 1451 tests passed. Local emitted rules and 12 live baseline responses passed for YandexBot/Additional/AdditionalBot. Post-deploy workflow checks both Alice tokens. Official guidance: https://yandex.ru/support/webmaster/ru/adding-site/indexing-prohibition. Public content was already permitted through wildcard; do not describe this as removing a pre-existing block. No claim of actual Alice citations.
NEXT ACTION: exact-head CI, publish and verify live explicit rules and responses. Preserve calculators, legal controls and content.

## Live checkpoint — ChatGPT search readiness, 28 September 2026

Base published main 3fbbc870 (#189); exact-head checks and deployment 36430240448 succeeded. Owner authorizes search readiness improvements and publication. Existing OAI-SearchBot access is already enabled. Preserve privacy, pricing, header and protected content.
DONE: shared public tool facts for human-readable company facts and optional AI discovery documents; synchronized dates. Build/lint/type, 1451 tests, SEO 93 URLs and Chromium 390/1440 passed; production bot-UA HTTP checks returned 200. No claim of guaranteed ChatGPT inclusion. Native RFA and source-based open/closed/corner BIM work remain incomplete, in a separate checkout.
NEXT ACTION: exact-head CI, authorized publication and live verification. Evidence: docs/verification/chatgpt-search-20260928.md.

## Live checkpoint — BIM workspace redesign, 28 September 2026

Base ae8c8cad (#188); exact-head CI and publication 36427077927 succeeded; live 390/1440 colour/export checks passed. Owner requests clearer layout and colour workflow, more RAL choices, publication remains authorized.
DONE: light branded workspace, compact dimensions, numbered selection; 76 approximate RAL swatches with global code/name search and family filters; explicit whole-block/selection application, row/column selection, undo and organised export. Existing IFC geometry unchanged. Build/lint/type, 1451 tests and browser checks at 320/390/768/1440 passed, including 400 panels. Final polish sets native light controls and wider narrow-mobile palette targets. No pricing/privacy/header changes.
NEXT ACTION: functional/browser accessibility checks at mobile/tablet/desktop, exact-head CI and live release verification.

## Live checkpoint — cassette RAL selection, 28 September 2026

Base d1acd97 (#187). Owner authorizes individual/group/block RAL colouring and publication.
DONE: keyboard/click multiselection; whole-block painting/reset; stable row/column colour identities; approximate preview presets and custom RAL; per-instance IFC finish properties and surface styles; individually tagged CSV rows and UI colour totals. Initial local lint/type/build, 1449 tests and browser 390/1440 passed. Independent IFC4 EXPRESS and OpenCascade geometry/style validation passed.
LIMIT: all 48 reference DXFs remain iCloud dataless placeholders (zero allocated blocks); corner/open/closed source geometry cannot yet be verified. RFA 2022 still pending an available Revit engine. Do not represent existing simplified straight-return models as verified manufacturing models.
NEXT ACTION: final exact-head CI and authorized publication of colouring; live browser export verification. Hydrate source drawings before completing accurate cassette library.

## Live checkpoint — cassette drawings and corner elements, 28 September 2026

Base published main d1acd97 (#187): deployment 36422349149 succeeded; live IFC/CSV browser exports and SEO 93 URLs passed. Owner requests a full drawing block including corner, open and closed cassette variants based on supplied CAD. Revit 2022 native-family requirement remains pending; do not present flat outlines as verified folded geometry.
IN PROGRESS: complete source inventory, DXF entity/units/dimension audit and SolidWorks preview extraction. Verify geometry rather than infer dimensions from filenames. Preserve existing calculator/pricing/privacy and approved site sections.
NEXT ACTION: build the drawing library from verified source evidence, test controls/downloads and dimensional consistency, publish only after exact-head checks.

## Live checkpoint — free calculator promotion and BIM library, 28 September 2026

Base main 8efbce6 (#186), prior publication 36404222443 succeeded. Owner authorizes advertisements, free-calculation SEO, BIM page and publication. Revit 2022 selected explicitly; no Windows/Revit environment available.
DONE: 3 additional Direct ads submitted to moderation within existing budget; 3 Business ads persisted with use-in-advertising checked. Free-calculation copy and visible/schema FAQ. IFC4 coordination generator, parameter passport, CSV quantities, mobile UI and product link. Independent IFC schema/geometry/property checks passed for 1/6/400 panels. Local browser 390/1440 passed; 1448 tests passed. Native RFA remains unfinished and is not offered for download. See docs/bim/COMPETITOR-REVIEW.md and VERIFICATION.md.
NEXT ACTION: final build/SEO/browser validation, exact-head CI, authorized publication and live checks. No claim of Revit readiness until actual Revit 2022 verification. Protected Hero/logo/object solutions/calculation rules/privacy unchanged.

## Live checkpoint — seven expert customer scenarios, 28 September 2026

Base main 46fd1a3 (#183); previous journal checkpoint reconciled with the published customer-journey release. Owner authorizes expert scenarios, corrections and publication. This is not research with recruited users. No real leads or CRM messages; quote POSTs intercepted. Protected Hero sentence, logo and object solutions unchanged.
DONE: seven expert scenarios recorded in docs/verification/expert-customer-scenarios-20260928.md. Live cassette handoff loss reproduced; type/mode/wall/openings and pending-result inputs now retained. No URL-supplied money accepted. Build/type/lint, 1443 tests, local corrected handoff and existing browser recovery suites passed; live manual/STEP/service scenarios passed. Calculation/pricing logic unchanged.
NEXT ACTION: regressions, browser verification, exact-head CI, authorized publication and live verification.

## Live checkpoint — customer journey reliability, 28 September 2026

Owner authorizes further website quality fixes/publication. Base 54f2a9a (#182). Hero protected sentence, logo and object solutions excluded. Relevant site-director, technical writer, website-development, UI/UX, accessibility/performance/security and quality gate applied.
DONE: reproduced failed-storage retry returning false duplicate (429); reservation released only for owner attempt before durable quote storage. Concurrent duplicate protection retained. Mobile lab baseline (150 ms / 1.6 Mbps / CPU x4): home LCP 3.756 s / CLS 0; CAD LCP 2.376 s / CLS 0.268; contacts LCP 2.172 s / CLS 0. No real leads submitted.
IN PROGRESS: quote drag/drop, submission timeout and receipt validation, durable error recovery, compact contacts, server-rendered inline consent with pre-paint saved-choice presentation, keyboard-accessible article tables. Consent decisions/text/storage unchanged; presentation script does not authorize analytics or write storage.
VERIFIED: final build/type/lint and 1439 tests passed. Browser fault injection and normal/deferred receipt passed, including choice persistence across client navigation. CAD/STEP, cassette 16 variants and SEO 92 URLs passed. Local CAD CLS 0 (baseline live 0.268); production comparison pending. Evidence: docs/verification/customer-journey-20260928.md. NEXT ACTION: exact-head CI, authorized publication and live checks. No promise of literal 10/10 or real recipient receipt without evidence.

## Live checkpoint — three production journal guides, 27 September 2026

Owner explicitly requests publication of three useful manufacturing articles. Base 636a00b (PR #181 deployment 36344824222 verified). Content-only scope: nesting economics, coating masking, first-part inspection; existing welding topic deliberately not duplicated. Primary sources TRUMPF, EPSI, PCI, NIST and Autodesk checked. Hypothetical examples labelled; no invented company capabilities, tolerances or prices.
DONE: three complete articles, journal integration and sitemap date; SEO quality assertions retained for both rewritten and directly authored content. Build/type/lint and 1437 tests passed. Browser 390/1440: all three pages, images, FAQ, canonical/schema, journal links and sitemap passed; no JS errors.
NEXT ACTION: exact-head CI, authorized publication and live article checks.

## Live checkpoint — approved UX improvements, 27 September 2026

Base b4829bb; #180 and deployment 36343428755 green. Owner authorizes audit improvements and publication, explicitly preserving the full Hero sentence and Solutions for objects. Do not edit industry pages/data or the homepage object section.
IN PROGRESS: unambiguous calculation entry points, readable calculator controls, inline cookie notice on calculation pages without consent changes, removal of unavailable cassette review UI, concise repeated copy and accurate sitemap dates.
DONE: build/type/lint and 1437 tests passed; browser cassette 16 combinations plus validation/network/20s timeout/retry, both cookie flows, full manual/STEP CAD suite and responsive widths passed. SEO 89 URLs and redirects green. Protected Hero and object section compared byte-for-byte. Evidence: docs/verification/site-ux-improvements-20260927.md.
NEXT ACTION: exact-SHA CI, publish and verify the live version.

## Live checkpoint — whole-site audit, 27 September 2026

Base 9eb7dc2, previous release deployment verified. Live public CAD suite passed again; owner-specific launch failure not reproduced yet, clarification requested. Rendered all 89 sitemap URLs: 200, distinct titles/descriptions, self-canonicals, one H1. Reproduced homepage hydration error only with prefers-reduced-motion: reduce.
DONE: reduced-motion mismatch confirmed in dev stack and fixed using identical markup/CSS media classes. Production browser regression passes both preferences and CAD navigation. 89-page SEO audit, 101 targets, 18 redirects/7 gone URLs, live CAD scenarios and cassette base calculation checked. Cassette AI/market review reports unavailable. Build/type/lint and 1437 tests passed. Report: docs/verification/site-audit-20260927.md.
IN PROGRESS: exact-SHA CI and owner-authorized publication of hydration fix.
NEXT ACTION: verify exact fix and report audit boundaries; do not change legal text or production facts.

## Live checkpoint — public audit, 27 September 2026

Base 675faca, deployment verified successful for the same SHA. Reviewed intervening operation-default and SEO commits. Live manual/STEP six-calculation browser suite passed, 768 private-basis service combinations passed. Reproduced live: uploading CAD while editing manual dimensions leaves the editor targeting the newly selected CAD.
DONE: CAD upload/drop closes manual editor; reproduced against live old code and verified fixed in local production build. 1437 tests passed (TMPDIR=/private/tmp, concurrency 2 avoids macOS symlink and short worker timeout harness issues); build/type and lint passed. Live DXF/partial-service/partial-project/STEP/mobile checks passed.
IN PROGRESS: exact-SHA CI and release. Owner-authorized fixes/publication continue; no CRM test messages or leads.
NEXT ACTION: verify fix locally, current-SHA CI and live deployment.

## Live checkpoint — public manual calculator verification

DONE: manual dimensions, 5 positions / 5 hole groups, edit-in-place, private averaged laser tiers. 1399 tests including 2304 synthetic variants passed; 768 isolated private-basis variants passed. Browser manual/legacy CAD checks and build/lint passed. Fixed fast-entry focus regression discovered by browser.
IN PROGRESS: final extended browser run (operation-preserving edit and mixed STEP), then exact-SHA CI and owner-authorized publication.
NEXT ACTION: merge only after current SHA CI, verify production manual input and STEP without creating leads. See docs/verification/public-manual-calculator-20260924.md.

## Live checkpoint — public manual calculator, 24 September 2026

Base: main 9d2260cf02b42de7355ab5dc42742eb76418313b, PR #176 and deployment 36054356271 succeeded with live browser QA. Owner explicitly authorizes implementation and publication: maximum 5 positions and 5 hole groups each, private averaged tariffs, verification across operations. Desktop remains separate (100 positions).
DONE: reviewed desktop manual geometry and confidential pricing boundary.
IN PROGRESS: manual geometry entry/editing, 5/5 server limits, server-only mean laser volume-tier rates per exact material/thickness; existing metal prices and other rates retained.
NEXT ACTION: regression/matrix tests, browser, confidentiality review, exact SHA CI, deployment and live QA.

## Live checkpoint - calculation-variation verification, 24 September 2026

DONE: eight new regressions failed before the website fixes and now pass. Full website suite: 1390 tests passed; production build and lint passed. Real local browser checked DXF, bent STEP, 50-piece quantities, all seven services, missing secondary inputs, unread CAD beside a priced part, and responsive widths 390/768/1440 without JS errors. The partial subtotal is explicitly labelled and is never used as the complete printed quote total. No dependencies, private tariffs, confidential geometry, authentication or payment changes.
Mac delivery is installed and verified (desktop source commit 822a666; 292 tests plus browser and installed-package 128-service matrix including 100 positions).
IN PROGRESS / NEXT ACTION: exact-SHA PR CI, owner-authorized publication, live-site verification. Source tests and browser evidence are complete; deployment is not claimed yet.

## Live checkpoint — аудит вариаций расчёта, 24.09.2026

База актуального main: 2fec50cdb88aec04ad5709a4051f6539a8332cde, изолированная ветка fix/calculation-variants-20260924. Промежуточные изменения main (навигация и вход администратора) просмотрены и сохраняются. PR-triggered workflow runs для этого main SHA отсутствуют; GREEN для новой ветки пока не заявляется.
Владелец поручил проверить все варианты услуг, количества, добавления деталей и исправлять ошибки; ранее прямо разрешил публикацию. Старый запрет публикации ниже не отменяет последующее разрешение владельца. Платежи и выпуск в производство не включаются.
DONE: ошибки воспроизведены и исправлены в отдельном Mac-приложении; 292 теста, браузерная проверка, 128 комбинаций услуг через сервер, спецификация 100 позиций.
IN PROGRESS: перенос узких исправлений в сайт: целые счётчики операций и границы количества, явная частичная оценка при недостающей вторичной услуге, сохранение оценки при истечении необязательной ИИ-проверки.
NEXT ACTION: regression-first проверки, production build/браузер/CI точного SHA, разрешённая публикация и проверка живого сайта. Private basis, секреты и файлы заказчиков в Git не переносятся.

## Live checkpoint — настройки производства и устойчивость STEP, 22.09.2026

DONE: PR #170 (main 9873671) опубликован, защищённые расценки из Excel применены. PR #171 (main da4b8b4), workflow 35729365393: фиксированная доплата отключена. Живой сайт и приложение: пластина 075.310.04 — 21,32 ₽, 50 шт. — 1066 ₽, предупреждение и дата прайса сохранены.
IN PROGRESS: отдельные экраны системы расчёта и редактирования тарифов с сохранением в производственном приложении; накопительная загрузка до 100 позиций. На сайте подтверждён restart PM2 при превышении 600 MiB после серии STEP. Изоляция OCCT в завершающемся дочернем процессе должна освобождать память после каждого файла. Публичные тарифы и закрытые настройки не раскрывать; тестовые изменения выполнять только на временной копии private basis.
DONE locally: 100 обработок пяти STEP владельца, память родительского процесса 69→75 MiB, пик 94 MiB. Предпросмотр и предварительные цены всех пяти STEP прошли через браузер сборки сайта. 1365 тестов сайта и 212 приложения, lint/typecheck/build green. UI настроек сохраняет данные после reload, CSRF и конфликт версий проверены на временном basis. NEXT ACTION: закончить браузерную проверку 100 позиций, CI точного SHA, публикацию и проверку живого сайта, установку приложения.

## Live checkpoint — сварка и зенковка STEP, 22.09.2026

База main 3c7178698c0425069eb218ae28d851e7741f47ea, выпуск #169 опубликован и проверен. Владелец поручил учитывать сварку и зенковку по STEP в обеих версиях.
IN PROGRESS: достоверное распознавание внутренних конических зенковок, отдельная операция и количество на деталь/партию; фактический расчёт по закрытой ставке. Ставка сварки существует, тариф зенковки отсутствует — запрошен у владельца, не выдумывать. Длину сварного шва не выводить автоматически из произвольных рёбер или касания тел. При отсутствии явных данных требуется ввод длины шва.
DONE: BRep-распознавание конических отверстий (включая два полуконуса и две стороны); отдельный расчёт зенковки, количество на деталь и партию, размеры в UI; сварка по введённой длине шва. Измеренный минимум зенковок сохраняется в ревизиях, дополнительные количества разрешены. Отсутствующий тариф/длина оставляют явную оценку только известного состава, исключения видны рядом с суммой, включая мобильный интерфейс, сохранённые варианты и печать. Обнаруженный браузером пропуск операции в клиентском manifest исправлен и покрыт roundtrip-тестом.
Владелец передал Excel 20260920_205604.xlsx: расценки зенковки и сварки найдены на листе «Расчет», также подтверждена корректировка базовой резки 1 мм по «Стоимость резки». Частные значения сохраняются только в runtime basis и защищённом GitHub secret, не в коде. Дата подтверждения — получение файла 22.09; имя файла не считается доказательством даты вступления прайса. Цены металла и даты поставщика сохраняются. Гибка в книге содержит разные формулы — не подменять универсальным числом без согласования условий.
IN PROGRESS: интеграционные проверки реальных STEP с найденными расценками, сварка 1/50 шт., финальный CI точного SHA, публикация и атомарная установка приложения.
NEXT ACTION: завершить браузерные проверки, применить защищённый тарифный patch сайта, опубликовать код после CI и проверить живой расчёт.

## Live checkpoint — выпуск #169, 22.09.2026

Точный feature SHA e33a2457941958bf026cba2cffe6f72cc09be098: CI 35723001770 (lint/type/tests/build/SEO) и 35723001980 (type/tests/build) success. Локально 1339 тестов сайта / 121 приложения, обе production-сборки green. Пять реальных STEP дали предпросмотр, цену и видимую дату прайса в обеих версиях; гнутый STEP проверен для 1 и 50 шт. Предупреждения технологических нарушений и исключённых операций не скрываются ценой.
Приложение 3d36dec установлено атомарно и запущено; около 353 МБ на диске. Учётные записи, проекты и локальная модель сохранены. Проверки аутентификации, same-origin, DNS-rebinding и CSP прошли на установленном приложении. Удалена только созданная в этом выпуске устаревшая временная копия пакета.
DONE: PR #169 merged; main 3c7178698c0425069eb218ae28d851e7741f47ea; deploy 35723431488 success. На живом сайте все пять исходников владельца получили предпросмотр, preliminary estimate и видимую дату прайса, без ошибок JS. Х/к 10 мм использует сохранённый прайс 14.09 с явным предупреждением; остальные текущий прайс поставщика от 17.09. Гибка на живом сайте прошла для 1 и 50 шт.; ширины 390/1440 без переполнения и ошибок JS. NEXT ACTION: текущие исправления выпущены и проверены; новые отказы воспроизводить на конкретном исходнике, не выдавать неучтённую обработку за полную цену.

## Live checkpoint — дата прайса возле цены, 22.09.2026

PR #169, bd8736d: обе CI проверки green. Все пять STEP владельца получили предварительную цену и предпросмотр в браузере сайта и в пакете приложения; модель с гибом прошла партии 1/50. Установлена локальная версия c68fb4b, текущий сайт пока на PR #168.
Владелец дополнительно подтвердил: цену показывать с датой прайса. Последняя сохранённая точная цена уже используется с предупреждением при устаревании; теперь дата фактического прайса выводится возле любой цены и в печатной смете. Отсутствующие исходные цены и геометрия не выдумываются.
NEXT ACTION: проверки текущего изменения даты, CI нового точного SHA, публикация, проверка живых пяти STEP и финальное обновление приложения.

## Live checkpoint — цена с предупреждениями, реальные STEP, 22.09.2026

База main ff1c210, предыдущая публикация PR #168. Владелец явно изменил минимальную перемычку с 3 до 1 мм; отверстие остаётся не меньше толщины. Поручил показывать предварительную цену при нарушении технологических норм с предупреждением и без автоматического разрешения производства.
IN PROGRESS: правило 1 мм в обеих версиях; отделение проверки изготовляемости от предварительной сметы; пять предоставленных STEP, включая 184.307.01. Три модели имеют различающиеся противоположные поверхности: точная проверка призмы их отклоняет. Разрабатывается отдельная оценка заготовки, не выдаваемая за подтверждённую геометрию изготовления; неучтённые фаски/зенковки должны быть явно обозначены.
DONE: preliminary STEP-заготовка проходит точную OCCT-проверку вмещения готового тела; неучтённые фаски/зенковки явно обозначены. Четыре реальных STEP получили цену в браузере. Пятый выявил устаревшую заводскую цену х/к 10 мм: добавлена отдельная оценка по последней точной цене с исходной датой и предупреждением, без изменения прайса. Гибка прошла браузер для 1 и 50 деталей в обеих версиях. Предупреждения сохранены в печатной смете.

ПРОВЕРКИ: финальные production build обеих версий успешны; 1331 тест сайта и 113 приложения прошли. Проверяется полный браузерный набор после добавления устаревшего прайса.

NEXT ACTION: браузерная проверка всех пяти исходников и гнутой тестовой детали, обе сборки, регрессии, CI, разрешённая публикация и атомарное обновление приложения. Исходники заказчика и частные тарифы не коммитить.

## Live checkpoint — гибка STEP, 22.09.2026

База ff1c210 (PR #168 опубликован). Владелец подтвердил локальное приложение работает, STEP-предпросмотр сайта появился, но гнутый STEP не получает расчёт; просит гибку во всех калькуляторах.
REPRO: reference-angle.step содержит 1 гиб, толщину 1,5 мм и measured development с полной геометрией заготовки 250 × 157,3197 мм; устаревшие candidate warnings блокируют preliminary estimate. UI уже выбирает гибку и число гибов автоматически; добавляется явное число гибов в партии.
IN PROGRESS: server-only доказательство измеренной заготовки для предварительной сметы гнутого STEP; предупреждения сохраняются, изготовление не согласуется автоматически. Неполная/неоднозначная геометрия остаётся заблокированной.
NEXT ACTION: регрессии полного расчёта гибки и партии; браузер обеих версий; CI, публикация и локальное обновление. Путь к конкретному STEP владельца запрошен, пока неизвестен.

## Live checkpoint — опубликовано и проверено, 22.09.2026

PR #168 merged; main ff1c210cc9551f3a7ee7e2466eb1a88d497642cb; deploy 35718736198 success. CI точного feature SHA da04f3f: оба workflow success. 1291 тест сайта, build/lint/SEO green.
На живом https://www.steelprodukt.ru/online-order прошли: исходный DXF владельца (кассета 400×350, оцинковка 0,7 мм) с preliminary estimate; партия 50 шт. и 2 гиба; STEP 14 МБ с 3D-предпросмотром; цена STEP для 1 и 50 деталей. Три ширины 390/768/1440 без переполнения и ошибок JS. STEP — тестовая плоская BRep-деталь; неизвестный STEP владельца не предоставлен, универсальная развёртка гнутых деталей не заявляется.
Локальная поставка b2a7db4 установлена; 67 тестов и production build green; реальный DXF владельца проверен на установленном пакете, владелец подтвердил «заработало». Пакет 317,2 MiB логических данных, около 350 МБ на диске после запуска. Файлы и локальная модель сохранены. QA выполняется изолированно на 3151, рабочее приложение на 3140.
DONE: текущие исправления опубликованы, установлены и проверены. NEXT ACTION: если конкретный STEP владельца всё ещё не открывается, получить исходный файл и воспроизвести; не приписывать это автоматически лимиту загрузки. Не считать неподтверждённую развёртку гнутой детали фактической геометрией.

## Live checkpoint — файл владельца и предварительная цена, 22.09.2026

База main 3d158ef; текущий выпуск ещё не опубликован. Файл владельца «Развертка — 400х350 1 сливное 0,7 мм» разобран точно: 473,7515 × 423,7515 мм; площадь 195300,5379 мм²; траектория 2109,1011 мм; 6 пробивок. Вогнутость требует технологической проверки, но не должна скрывать полную предварительную смету.
Владелец отказался просто подставить тариф 0,8 мм, затем поручил вычислить отсутствующую ставку по соседним значениям. Добавляется строго ограниченная оценка 0,7 мм по 0,8 и 1,0 мм того же материала. Исходные ставки не меняются, цена металла строго по 0,7 мм, смета остаётся предварительной и не разрешает производство.
DONE: estimate-only статус, отдельная локальная ИИ-проверка стоимости, точные причины недостающих данных, проверка округления партии и недопустимой топологии. 1291 тест сайта и 67 локальных; обе production-сборки и lint прошли. Реальный DXF владельца 0,7 мм/оцинковка дал preliminary estimate в браузере; 50 шт. × 2 гиба также рассчитаны. STEP 14 МБ прошёл предпросмотр.
Отдельные CAD-лимиты исправляют отказ после 3 пересчётов/мин: сайт 6/мин и 200/день, авторизованное локальное приложение 60/мин и 2000/день; лимиты отправки заявки не меняются.
IN PROGRESS: CI и публикация; установка уменьшенного приложения и повторная браузерная проверка установленного пакета.
NEXT ACTION: итоговые проверки обеих версий, CI точного SHA, разрешённая публикация, проверка живого сайта и установленного приложения.

## Live checkpoint — рабочая поставка, STEP и общий DFM

База main 3d158ef: PR #167 / deploy 35688279187 опубликован, три реальных DXF-сценария пройдены. Владелец требует снять ограничение прямоугольника, восстановление контуров с ИИ, исправить отсутствие STEP-предпросмотра и убрать лишнее из приложения 1,8 ГБ. В локальном журнале найдено обрезание STEP на middleware 10 МБ; исходный upload-handler ограничивал файл 7 МБ.
IN PROGRESS: единые CAD-лимиты 50 МБ/файл, 100 МБ/проект, 101 МБ multipart (обычные формы сохраняют прежний лимит); аналитические контуры LINE/ARC; STEP BRep features; локальный ИИ предлагает соединения с сохранением исходника; очистка пакета от build cache, dev-deps и копий сборок.
NEXT ACTION: интеграция, реальные STEP >10 МБ и DXF, ИИ-предложение/применение, тест установленной минимальной поставки, CI и разрешённая публикация.

## Live checkpoint — утверждённые нормы, 22.09.2026

База main ad160573, PR #166 и deploy 35658195172 успешны. Владелец подтвердил: минимальное отверстие равно толщине металла; перемычка 3 мм; отдельного минимального размера нет. Рабочее поле сохраняется.
DONE: нормы подключены к серверному разбору DXF; равенства и нарушения проверены; 1240 тестов, lint, typecheck и build прошли. Автоматические измерения охватывают осевой прямоугольник с круглыми отверстиями. Непроверяемые контуры, STEP и зоны гиба сохраняют ручную проверку.
NEXT ACTION: CI точного SHA, публикация и установка отдельной сборки.

## Live checkpoint — полный рабочий выпуск калькуляторов

База main 1150337, PR #165 и deploy 35653375660 прошли; оригинальный логотип опубликован. Владелец повторно поручил завершить и публиковать весь согласованный объём: упрощённый навигационный инженер, клиентский CAD на сайте, самостоятельное производственное приложение. Платные сервисы запрещены; геометрия и производственные ставки не выдумываются. PR #163 не сливаем.

DONE: новые клиентский интерфейс и инженер; браузерные DXF/STEP на шести ширинах; 1230 тестов, lint, build; SEO 89 URL, 18 redirects, 7 gone без ошибок. Отдельное приложение: 19 тестов, реальные сохранение/восстановление CAD, копии, раскладка, экономика, документы и шесть ширин. Бесплатная локальная модель интегрирована в supervisor.

ОГРАНИЧЕНИЕ: финальная автоматическая цена удерживается старым feature-rules DFM-гейтом до появления утверждённых технологических норм. Владелец уведомлён; нормы запрошены. Не выдавать отсутствие норм за завершённую автоматизацию.
NEXT ACTION: интеграция, реальные CAD-сценарии/шесть ширин, проверки точного коммита, публикация клиентской части и отдельное обновление .app.

## Live checkpoint — оригинальный логотип калькуляторов, 21.09.2026

База main 37eeea1: клиентский PR #164 опубликован, deploy 35650219395 успешен. По прямому поручению владельца используется оригинальный public/logo/steel-product.png в клиентском CAD и обеих страницах калькулятора металлокассет. Формулы не менялись. Производственное приложение обновляется отдельной локальной поставкой.

DONE: единый компонент логотипа, lint и production build; браузерная проверка трёх маршрутов на ширине 390 px — изображения загружены, пропорции сохранены, горизонтального переполнения нет.
IN PROGRESS: выпуск логотипа.
NEXT ACTION: CI точного коммита, штатная публикация и проверка живых страниц. Глубокое исследование четырёх международных калькуляторов продолжается отдельно; этот выпуск не является завершением переработки производства.

## Live checkpoint — клиентский выпуск 21.09.2026

Владелец разрешил публикацию и уточнил: на сайте только клиентский калькулятор; производство — отдельное приложение на рабочем компьютере. Эта ветка создана от main 179d00e и содержит только клиентский CAD, проверку согласованности гибов и свежести прайса. Никакие новые production-access/production-calculator маршруты и серверный bootstrap в выпуск не входят. Автоцены обязательны в обеих версиях; существующий серверный таймер подтверждён run 35646144664. PR #163 остаётся draft и не сливается.

DONE: 1230 тестов, lint, production build; SEO 89 URL / 18 redirects / 7 gone без ошибок; реальный DXF + защита старого асинхронного результата + zoom/fit и шесть ширин экрана. Production entry 404. NEXT ACTION: отдельный PR, CI точного SHA и штатный deploy клиентского выпуска.

# Steel Product Online — постоянный журнал разработки

> Recovery/checkpoint-файл. После обрыва сначала сверить этот журнал с фактическими branch HEAD, Draft PR #90 и CI.

## Live checkpoint — 21.09.2026, выпуск ИИ-инженера

Этот блок новее исторического checkpoint от 14.09 ниже. Пользователь прямо поручил **доделать и публиковать**, затем уточнил **систему полностью с ИИ**. Оплата/checkout по-прежнему не включаются. Новые расходы требуют отдельного согласования.

- Текущий PR: **#152**, `fix/quote-engine-dialog-safety-20260921` → `main`; включает основание #151.
- Последняя подтверждённая база локального пакета: `e59cef680461c0edef0c35c68e5534383fd89458`.
- Предыдущий проверенный функциональный коммит: `52e1ff7`, GitHub Actions №723. Этот статус не переносится на новые изменения.
- Проверка production перед выпуском: run `35587857368`. В серверном окружении отсутствовали ключ, каталог и модель Yandex AI; ключи Search API; файл рыночного реестра; вебхук Битрикс24. Каталог закрытых производственных отчётов присутствовал. Значения ключей не читались в журнал.
- Публикация кода не включает платные сервисы. Пока ИИ выключен оператором, работает явно обозначенный расчёт по формулам. После включения ИИ в production его недоступность удерживает цену, если оператор явно не разрешил резервный режим.

### DONE в новом пакете
- Восемь этапов проверки доступны диалогу, CAD и отдельному расчёту кассет по площади/стене.
- Рыночное правило одинаково: `max(расчётная коммерческая цена, проверенное арифметическое среднее)`.
- CAD сравнивается только с тем же SHA-256 загруженного файла и подписью производственных параметров; нельзя подставить цену другого изделия по совпадению габаритов. Порошковая окраска без заданного цвета не считается рыночно сопоставимой.
- Для расчёта кассет по площади отдельно задаётся налоговая/технологическая база `priceBasis["facade-area"]`, диапазон площади и ставка за м². Приблизительное число кассет не подменяет оплачиваемую площадь.
- Поставщики могут автоматически обновляться через зарегистрированные структурированные JSON-первоисточники. Защита DNS/HTTPS, ограничение размера и времени, снимок исходной строки, свежесть и сопоставимость обязательны. Незарегистрированные поисковые ссылки остаются кандидатами, а не проверенными ценами.
- Последний полный расчёт с внутренними подробностями сохраняется вместе с согласованной заявкой; новое неполное уточнение удаляет старый снимок. Публичный ответ не содержит себестоимость и тарифы.
- Опциональная отправка в российский портал Битрикс24 происходит только после сохранения заявки, аудита согласия, проверки файлов и двух операторских флагов. Идентичность — номер заявки, не общий телефон; другой заказ не перезаписывается. Ошибка помечается `needs-retry`, а не «доставлено».
- Кнопка проверки кассет не запускает модель на каждом вводимом символе. При изменении параметров старая сумма скрывается сразу, устаревший запрос отменяется.
- Внутренние производственные ставки исключены из дерева выпуска. Удаление файла из Git-истории не заявляется.

### IN PROGRESS / NEXT ACTION
- Перенести протестированный пакет в PR, выполнить CI на новом SHA и проверить браузер.
- Выполнить разрешённую публикацию штатным deploy с сохранением обновлений `main`, подтвердить активный BUILD_COMMIT и публичные маршруты.
- Активация живого ИИ/поиска требует реальных серверных настроек и согласованного расхода. Не выдавать mock-тесты за live-вызовы и не включать расход автоматически.
- Нужны реальные сопоставимые предложения/адаптеры первоисточников; универсальный разбор произвольной HTML-страницы не реализован. В отсутствие источников цена честно остаётся расчётной.
- Для CRM нужен разрешённый вебхук и согласование передачи данных; автоматический фоновый retry-демон не запущен.

---

## 0. Протокол восстановления

1. Проверить `feat/steel-product-online-clean-alpha-sep14` и Draft PR #90.
2. Сравнить HEAD с `Last GREEN verified tree` и `Last functional implementation SHA`.
3. Journal-only commits не считать новой функциональностью; GREEN относится только к точному проверенному SHA.
4. Любой RED исправлять до нового functional layer.
5. Не переписывать DONE-блоки без конкретного regression/CI evidence.

---

## 1. FINAL REVIEW CHECKPOINT

**Обновлено:** 2026-09-14

- Репозиторий: `alexeyborisov19-sys/alexeyborisov19-sys-steel-probuct`
- Ветка: `feat/steel-product-online-clean-alpha-sep14`
- Draft PR: **#90 — `Steel Product Online: sanitized clean alpha snapshot`**
- Base: `main`
- PR должен оставаться: `open`, `draft`, `merged=false`
- Публикация/deploy: **НЕ ДЕЛАТЬ**
- Merge в `main`: **НЕ ДЕЛАТЬ**
- Payment/checkout: **НЕ РАЗРАБАТЫВАТЬ**

### READY FOR REVIEW BEFORE PUBLICATION

Feature development для текущей pre-release версии остановлен. Новые geometry features до проверки владельцем не добавлять.

- **Last functional implementation SHA:** `fb54a1e0d140662608a85e92b8b3bf92c898f965`
- Functional block: strict exact-safe linear planar DXF SPLINE subset + regressions.
- **Latest stabilization SHA:** `c912cafba2d2857c66bd25bc9854b6125201841c`
- Stabilization block: regression-only malformed legacy POLYLINE matrix; production parser не менялся.
- **FINAL REVIEW CANDIDATE HEAD:** `a47dccda70d2666d3cc78136b3d7f8deae87fa0a`
- **Last GREEN verified tree HEAD:** `a47dccda70d2666d3cc78136b3d7f8deae87fa0a`
- CI на `a47dccda…` полностью GREEN:
  - `Steel Product Online Alpha CI`: TypeScript ✅, Unit tests ✅, Next.js build ✅
  - `Verify project package`: Lint ✅, Typecheck ✅, Tests ✅, Build ✅, SEO audit ✅
- Draft PR #90 на момент проверки: `open`, `draft`, `merged=false`, mergeable=true.
- Этот checkpoint — окончательная версия текущего pre-release scope для ручной проверки владельцем перед решением о публикации.

---

## 2. Жёсткие решения владельца

### Продукт
`CAD → геометрия → DFM → материал/толщина → операции → фактический производственный расчёт → безопасный клиентский результат`.

### Конфиденциальность
Клиенту не показывать:
- supplier prices и private rates;
- direct cost, margin/coefficients;
- manufacturing norms;
- внутренние mass/waste/cut/pierce breakdown;
- detailed internal DFM и production evidence;
- report IDs/paths/storage evidence;
- `powderAreaM2`, `assemblyMinutes`, `surfacePreparationAreaM2`, authoritative factual provenance.

Public/client boundary содержит только безопасный CAD/preview, безопасные размеры, выбранные material/thickness/quantity/operations, coarse status и в будущем отдельно утверждённую sales price/delivery.

### Расчёт
- Laser = фактический контур.
- Material до реального nesting = bounding rectangle вокруг детали, включая scrap.
- Missing physical input/rate = `missing/partial`, не ноль.
- Реальные rates/supplier prices = private runtime basis, не Git/client bundle.
- Аппроксимацию нельзя выдавать за factual production value.
- Unverified/bent STEP остаётся fail-closed для pricing/CAM.

---

## 3. DONE — pre-release scope

### Public/client safety
- client-safe `/online-order` workspace и safe calculation DTO;
- server повторно анализирует CAD перед confidential calculation;
- private economics/DFM/report modules не входят в client boundary;
- `tests/online-order-confidentiality.test.ts` запрещает private economics/production evidence в public workspace/DTO;
- public supplier seed не содержит supplier prices;
- публичный supplier-pricing API/client price service отсутствует.

### Candidate/release safety
- `tests/deploy-candidate-build.test.ts` входит в общий `tests/*.test.ts` GREEN suite;
- candidate build проверяется до замены active build;
- build commit identity проверяется;
- rollback build сохраняется до production redirect audit;
- interrupted promotion имеет service-restore guard;
- **этим checkpoint никакой deploy/publish не выполнялся**.

### STEP
- OpenCascade/BRep analysis;
- planar/cylindrical evidence;
- topology/unfold/flat-pattern verification gates;
- verified planar STEP path;
- server-only exact STEP boundary surface area для internal coating evidence;
- authoritative factual evidence остаётся только в confidential snapshots/revisions;
- unverified/bent STEP не promoted в pricing/CAM.

### Internal factual calculation
- private runtime rate book + supplier snapshot basis;
- bending/welding/powder/assembly/surface-preparation/packaging;
- internal immutable revisions, RBAC/CSRF/report lineage;
- manual technologist override выше automatic evidence;
- missing rate/input остаётся partial/missing.

### Supplier feed
- protected Atlantik refresh/parser/snapshot flow;
- HTTPS allowlist, PDF validation, SHA-256, dry-run/persist, atomic private replacement;
- METALLSERVIS не authoritative до стабильного official machine endpoint.

### DXF — supported factual subset
- `LINE`;
- `CIRCLE`;
- `ARC` — analytic bounds/length;
- `LWPOLYLINE`;
- simple planar legacy `POLYLINE → VERTEX* → SEQEND`;
- straight closed-polyline exact area/hole topology;
- polyline bulge exact bounds + cut length + curved preview;
- `ELLIPSE` full/partial с analytic bounds и controlled numerical length; full ellipse имеет exact area/containment/hole topology;
- strict linear planar `SPLINE`: degree 1, open, non-periodic, non-rational, planar+linear flags, Z=0, +Z/default normal, valid counts, valid open-clamped knot vector, weights absent/all 1; normalizes to exact open straight polyline.

### Regression-only malformed legacy POLYLINE
`c912cafb…` подтверждает fail-closed без parser changes для:
- missing `SEQEND`;
- unexpected nested entity;
- missing X/Y vertex coordinate;
- fewer than two valid vertices.

### Intentionally fail-closed
- bulged closed polyline exact area/pierces пока unavailable;
- legacy 3D/polyface/mesh/complex POLYLINE;
- nonlinear, rational, periodic, closed, 3D или malformed SPLINE;
- non-planar/invalid ELLIPSE;
- unverified/bent STEP pricing/CAM;
- DXF powder coating area без explicit sides.

---

## 4. Последние CI incidents — закрыты

### External image availability
Tree `eb50b7a…`: application tests/build GREEN, SEO audit получил 504 от third-party `static.mk.ru` через Next optimizer.

Fix:
- `f508be1fa2791113acaa3d0bac525af513b3602f`: deterministic first-party image availability audit; remote optimizer availability не считается доступностью нашего сайта.
- third-party media policy/config остаётся под отдельными regressions.

### Regression test contract
Tree `e6b3e30…`: новый SEO-boundary regression упал до build/SEO; production audit/SPLINE не менялись.

Fixes:
- `eee04cb9541fdf2e54e79d230a973c43e8350d57`: test-only stabilization через `process.cwd()`/`node:path`;
- `0c6e10bbc996978016a0dd2e3a671cc987d29839`: collector-contract correction;
- `961c43c0…`: оба workflow GREEN, включая реальный SEO audit.

---

## 5. Manual review checklist

Перед любым решением о публикации владельцу проверить:
1. `/online-order`: upload DXF/STEP, preview, безопасные dimensions/material/thickness/quantity/operations/status.
2. Supported DXF fixtures: line/polyline/bulge/ellipse/strict linear spline.
3. Fail-closed UX для unsupported curved/3D/nonlinear CAD.
4. Internal production report/revision flow отдельно от client UI.
5. Client network/UI не раскрывает rates, supplier prices, costs, DFM/evidence или factual internal inputs.
6. Candidate-build/rollback pipeline запускать только после отдельного решения на deploy.

---

## 6. NEXT ACTION

**Текущий pre-release scope завершён. Feature development остановить до ручного review.**

1. Считать `a47dccda70d2666d3cc78136b3d7f8deae87fa0a` последним подтверждённым FINAL REVIEW CANDIDATE после GREEN обоих workflow.
2. Текущий journal-only commit должен пройти оба workflow; если GREEN — он становится новым metadata-only review checkpoint, функциональный candidate остаётся `a47dccda…`.
3. Отдать владельцу на ручную проверку `/online-order` и внутреннего review flow перед публикацией.
4. Не deploy/publish/merge до отдельного прямого указания владельца.
5. Defects из ручного review исправлять regression-first отдельным блоком с новым CI gate.

---

## 7. Запрещено без нового прямого решения владельца

- merge `main`;
- deploy/publish;
- payment/checkout;
- release/prerelease publication;
- public internal economics/DFM/evidence;
- реальные private rates/prices в Git/client;
- approximate/unsupported geometry как production-authoritative.

---

## 8. Key changelog

- private STEP surface evidence + confidential provenance;
- internal assembly/surface-preparation revision path;
- DXF bulge analytic bounds/length/preview;
- legacy planar POLYLINE safe parser;
- analytic/controlled DXF ELLIPSE;
- strict exact degree-1 planar SPLINE;
- deterministic first-party SEO image availability audit;
- malformed legacy POLYLINE regression-only hardening;
- confidentiality and candidate-build regressions included in full GREEN suite;
- `a47dccda…` = fully verified FINAL REVIEW CANDIDATE before this metadata-only journal checkpoint.
- явная наценка владельца на металл в фактическом расчёте (`STEEL_PRODUCT_METAL_UPLIFT_PCT`, по умолчанию 5 %), значение только на сервере;
- systemd-таймер обновления прайса поставщика `deploy/systemd/steelprodukt-metal-prices.*` (дважды в сутки, внутри 72-часового окна свежести). Перед установкой администратор обязан проверить фактические пути `npm`, права пользователя `nodejs` и выполнить `npm run prices:refresh -- --dry-run`; до этого автообновление цен нельзя считать включённым на production.
- оговорка о предварительности расчёта вынесена в общую константу `CALCULATION_DISCLAIMER` и показывается рядом с ценой, в статусе позиции, в мобильной панели и в печатном КП, со ссылкой на `/legal/terms`;
- «Подготовка поверхности» не могла посчитаться: ей нужна площадь, которой нет в CAD. Число сторон теперь задаётся так же, как у окраски, и все шесть операций конфигуратора действительно рассчитываются — это зафиксировано в `tests/calculator-operation-coverage.test.ts`;
- ВАЖНО про валидацию окружения: `lib/quote/handler.ts` возвращает 503 на форме заявки при ЛЮБОЙ проблеме из `validateProductionEnvironment`. Поэтому переменные, нужные только таймеру прайсов или наценке на металл, обязательными делать нельзя — проверяется только формат, когда значение задано.

## 2026-10-04 — Owner review only: basket calculator
User explicitly prohibited publication. No deploy or merge. Local draft adds up to 100 specification positions, copy/edit/delete, JSON save/reopen (append), combined technical brief. Reference BOM checked against private assembly drawing; reference dimensions describe basket body, not full support envelope. No automatic bracket load certification or unverified price. Original drawings remain outside repository. Local verification and preview required before owner review.
Validation: production build passed; 9 focused geometry/project tests passed. Browser audit at 390/1440 passed copy/edit/save/import/delete and invalid import preservation, engineer handoff, no horizontal overflow, no scoped axe violations or runtime errors. Preview port3158; no publication.

## 2026-10-04 — Keyboard input correction, local only
Numeric controls now keep raw text while focused, accept comma decimals, and request numeric/decimal mobile keyboards. Empty optional block fields remain unknown; invalid required geometry blocks saving/handoff. Keyboard browser audit uses select-all, Backspace, sequential typing and Tab, including 52,5 kg and 12,5 mm. Desktop/mobile viewport audits passed specification add/copy/edit/import/delete and engineer form prefill, axe and runtime checks. 12 focused tests passed. No real lead sent; no deployment. Price/approved structural selection remain unfinished.

## 2026-10-04 — AC capacity reference, local owner preview
Added 7/9/12/18/24/36 thousand BTU/h reference selector with nominal cooling kW, explicitly illustrative model dimensions (Ballu official 2021 installation table A/H/D; Midea 36 official product page). Suggested existing basket example sizes are preliminary review starting points, not certified fit. Only explicit button applies basket dimensions; exact block fields and structural data remain untouched. Optional capacityClass survives project save/import and engineer summary with recheck warning. Other classes use manual dimensions. Build and 13 focused tests passed. Browser verification covers each class at 390/1440 plus full specification/keyboard/handoff regression. No publication.

## 2026-10-04 — International basket selection improvements (local only)
Reviewed KORBAS, DECOClim, Outsteel/Poujoulat, AIRDEKO, Hideaway Covers; sources and decision boundaries recorded in existing basket plan. Added installation-envelope and six-clearance input with unknown/null distinction and internal-space result; cannot certify fit from external size. Added perforation workload alternatives (+5/+10 mm pitch), open-area tradeoff and batch totals. Save/import sanitization and engineer text preserve fit. Production build, 16 focused tests and browser audits 390/1440 passed (keyboard, presets, clearances, result, specification, export/import, handoff, scoped axe, no runtime errors/overflow). No real lead sent, no deployment. NEXT: owner review; verified internal assembly catalogue and priced complete BOM still needed for final compatibility and price.

## 2026-10-04 — Guided visual basket UI, local owner review
Added branded introductory hierarchy and contextual help for all four steps, lightweight inline SVG explanations for facade projection and perforation, an existing clearly labelled basket illustration and approved engineering-department photo. Both image files inspected visually. Action group appears on final step (or active editing), preserving specification workflows. Build and browser audits at390/1440 passed, including image loading, keyboard entry, presets, fit calculation, save/import/edit, handoff, scoped accessibility and runtime checks. No publication. Still a preliminary selection/brief tool: full approved BOM pricing and load/fit certification are not complete.

## 2026-10-04 — Owner-approved volume pricing
Owner approved painted basic 900×600×550 basket: 1–10=7300,11–49=6700,50–99=6100,100+=5600 RUB/unit, final amounts without additional16.5%. Added tier calculation and quantity footnote on result. Other dimensions explicitly show baseline reference, not a quote for custom geometry; patterns/support changes subject to confirmation. No assumption of combined discounts across unlike specification items. Local only.
Release verification:1524 local tests and lint passed; homepage/tools5service links and basket browser audits passed390/1440. SEO check uses explicit preview URL. Exact remote commit CI and live deployment still pending.
