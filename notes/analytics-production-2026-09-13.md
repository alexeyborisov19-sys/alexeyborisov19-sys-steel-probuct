# Production analytics configuration — 13 September 2026

This note records the approved current analytics configuration for `steelprodukt.ru` and supersedes older internal statements that described Webvisor as disabled.

- Canonical Yandex Metrica counter: `112542227`.
- Legacy counters `111263638` and `112129777` are not permitted for the public site.
- Analytics loads only after the visitor separately grants analytics consent in the cookie banner.
- Webvisor is enabled for counter `112542227` and is subject to the same prior-consent gate.
- The main detailed quote conversion is `quote_request_success`; the standard Yandex lead-form goal `ym-submit-leadform` is emitted alongside it.
- Analytics parameters must not contain a person's name, phone, e-mail, company, message text, filenames, file contents, or uploaded documents.
- Production deploy pins `NEXT_PUBLIC_YM_COUNTER_ID=112542227` and `NEXT_PUBLIC_YM_WEBVISOR=true` in the Beget `.env.production`, validates them before build, confirms the canonical counter reached the client bundle, and fails if a legacy counter appears in `.next/static`.

Public legal pages describing analytics must remain consistent with this configuration. Any future change to the counter, Webvisor mode, consent gate, transmitted fields, or analytics provider requires coordinated code, deployment, test, and legal-document updates.
