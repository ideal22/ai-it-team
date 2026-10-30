---
name: uz-integrations
description: Reference for projects targeting Uzbekistan - Payme, Click and Uzum payment APIs (flows, callbacks, signatures, idempotency, test environments), SMS/OTP (Eskiz, Telegram Gateway), Yandex Maps licensing, UZS money in tiyin, uz-Latn/uz-Cyrl/ru locales, and the personal-data localization rules with their hosting implications. Use when a brief, PRD, ADR or story mentions Uzbekistan, UZS, Payme, Click, Uzum, Eskiz, or local hosting.
---

# Uzbekistan integrations reference

For the system analyst (integration and hosting ADRs), backend engineer (payments, SMS),
frontend engineer (money, locales, maps), and DevOps (local hosting). It is reference
knowledge, not a workflow. Read this file, then **only** the reference file the task needs:

| Topic | File |
|---|---|
| Payme (Merchant API, checkout, Subscribe API) | `${CLAUDE_PLUGIN_ROOT}/skills/uz-integrations/references/payme.md` |
| Click (SHOP API Prepare/Complete, Merchant API) | `${CLAUDE_PLUGIN_ROOT}/skills/uz-integrations/references/click.md` |
| Uzum (Checkout, Merchant API, Nasiya) | `${CLAUDE_PLUGIN_ROOT}/skills/uz-integrations/references/uzum.md` |
| SMS and OTP (Eskiz, Telegram Gateway) | `${CLAUDE_PLUGIN_ROOT}/skills/uz-integrations/references/sms-otp.md` |
| Maps (Yandex, 2GIS, OSM, Telegram location) | `${CLAUDE_PLUGIN_ROOT}/skills/uz-integrations/references/maps.md` |
| Personal data law, localization, hosting | `${CLAUDE_PLUGIN_ROOT}/skills/uz-integrations/references/personal-data.md` |

**Freshness.** Facts were checked against official docs on 2026-10-18; each file cites its
sources and marks anything not confirmed as **[unverified]**. Provider APIs, prices and the law
change. Before implementing, re-check the cited page (WebFetch or Context7) and note any
difference in the story Log. Never present an [unverified] item as fact in a client document.

## 1. Choosing a payment provider

Common practice (not a sourced fact): offer **Payme and Click both**, since users usually have
one of the two apps; add Uzum when the client asks.
Each is a separate merchant contract the **client** signs. The client's legal entity gets the
credentials, so start the paperwork in week 1; it is usually the critical path.

| Situation | Default |
|---|---|
| Physical goods/services, web or Mini App, local cards (Uzcard, Humo) | Payme + Click, each as its own adapter behind one `PaymentProvider` interface |
| Card form we redirect to, with Visa/Mastercard as well | Uzum Checkout |
| User pays from inside a banking app by account/order number | Payme Merchant API, Click SHOP API, Uzum Merchant API (all are "provider calls our webhooks") |
| Recurring payments / saved cards | Payme Subscribe API or Uzum Checkout card binding (needs separate permission from the provider) |
| Digital goods sold inside Telegram | Telegram Stars (Telegram's rules require it for digital goods) |
| Installments | Uzum Nasiya |

Architecture rules for every local provider:
- **One payment state machine** in our DB (`Payment`: `pending → paid | cancelled | failed`,
  plus `refunded` when the provider supports it), shared by all providers. Provider adapters map
  their states onto it. The order is paid only when the state machine says so.
- **The provider's transaction id is unique** (DB unique index on `provider + providerTxId`).
  Every callback is idempotent: a repeat returns the same answer and changes nothing.
- **Authenticate every callback** (Payme Basic auth, Click MD5 `sign_string`, Uzum Basic auth),
  using constant-time comparison. Re-check the amount against *our* order, never trust the
  callback's amount alone.
- **Amounts in tiyin** in our DB. Payme and Uzum use tiyin; **Click uses sum as a decimal**, so
  its adapter converts (see `click.md`).
- Callbacks are public HTTPS endpoints: no session auth, exempt from CSRF, rate limits loose enough for provider retries, logged
  without secrets, and answered fast in the provider's exact response format (a wrong format
  counts as an error to them).
- Fiscalization (fiscal receipts with product codes) is widely expected for online sales
  [unverified: we did not check the tax rules]. Providers support it (Uzum auto-fiscalizes
  one-step payments; see each provider file). **Ask the client's accountant whether it applies**;
  it is out of scope unless the PRD says so.
- Tests: a contract test per callback method with recorded provider payloads, including bad
  signature, wrong amount, duplicate, unknown order, and cancel-after-perform.

## 2. Money: UZS

- ISO 4217 code `UZS`, numeric `860`. 1 sum = 100 **tiyin**. CLDR sets UZS to 2 decimal digits
  with `cashDigits 0`: tiyin exist in APIs but not in cash, and prices are shown in whole sum.
- Store **integer tiyin** (`BigInt` in Prisma / `bigint` in Postgres; amounts can exceed `int4`
  when stored in tiyin) plus the currency code. Never floats.
- Display with `Intl.NumberFormat(locale, { style: 'currency', currency: 'UZS',
  minimumFractionDigits: 0, maximumFractionDigits: 0 })` from a project money helper (set both: older engines throw when only the maximum is below the currency default). Node 24 (ICU 77, CLDR 47) gives
  `1 234 568 soʻm` (`uz`), `1 234 568 сўм` (`uz-Cyrl`), `1 234 568 UZS` (`ru-RU`). The separators
  are U+00A0. Do not string-match formatter output in tests; compare against the formatter.
  Russian-language UIs often write `сум` by hand. Ask the designer which label the screen spec
  uses and keep it in i18n, not in code.

## 3. Locales

| Locale | Tag | Notes |
|---|---|---|
| Uzbek, Latin (default for Uzbek) | `uz-Latn` (`uz` maximizes to `uz-Latn-UZ`) | Official script |
| Russian | `ru` | Widely used in business and Tashkent (common practice; no official source) |
| Uzbek, Cyrillic | `uz-Cyrl` | Still read by older users; include only if the PRD asks |

- **Apostrophe letters:** CLDR uses U+02BB `ʻ` for oʻ/gʻ and U+02BC `ʼ` for the tutuq belgisi
  (https://github.com/unicode-org/cldr/blob/main/common/main/uz.xml). Users type `'`, `` ` ``,
  `‘`, `’`. **Store and display U+02BB/U+02BC; normalize all variants on input and in search.**
  Fonts must cover these characters and Cyrillic (designer checks the type specimen).
- Telegram `language_code` is an IETF tag; values for Uzbek users are not documented
  [unverified]. Map `uz*` → `uz-Latn`, `ru*` → `ru`, anything else → the project default.
- i18n keys per locale with plural rules (`Intl.PluralRules`; Russian uses `one`/`few`/`many`/`other`). Never build
  sentences by concatenation.
- Phone: E.164 `+998XXXXXXXXX` (9 digits after the country code). Input mask
  `+998 XX XXX XX XX`. Validate with a Zod regex `^\+998\d{9}$` in `packages/shared`.
- Dates: store UTC; the business timezone is `Asia/Tashkent` (UTC+5, no DST). Format with
  `Intl.DateTimeFormat` in the user's locale.

## 4. Personal data and hosting (summary)

Since **27 Mar 2026** (Law ZRU-1125), only **biometric, genetic, and telecom-subscriber data**
must be stored in Uzbekistan. Other personal data may be stored abroad in an adequacy-list
country (Cabinet Resolution 415, in force 3 Aug 2026: EU/EEA, UK, Russia, and others; the US
only via Data Privacy Framework companies; **Kazakhstan is not listed**) or under approved
contract clauses or standards. The 2021 "store everything locally" rule no longer applies.
The scope of the "telecom" category and the registration duty are open questions.

This is not legal advice. The hosting ADR classifies the PII inventory, lists the options
neutrally, and says **"confirm with a lawyer licensed in Uzbekistan"**. Details, hosting
options, and questions for counsel are in `references/personal-data.md`.

## 5. ADR checklist (system analyst)

When the brief's target market is Uzbekistan, the architecture has:
- [ ] **Integrations ADR:** payment provider(s) and why; checkout vs merchant-webhook flow;
  recurring yes/no; fiscalization yes/no (client's answer); SMS/OTP channel; maps provider and
  license tier (free terms forbid paid/closed products and tracking); money in tiyin.
- [ ] Sequence diagram per payment provider, including timeout/cancel paths.
- [ ] `Payment` model in the ER diagram with the provider tx id unique index and the state
  machine.
- [ ] **Hosting and personal-data ADR:** PII inventory with class A/B (see the reference),
  jurisdiction per class (DB, backups, logs, error tracking, analytics), open legal questions,
  status `proposed` until the client confirms.
- [ ] Env var **names** per provider (e.g. `PAYME_MERCHANT_ID`, `PAYME_KEY`, `CLICK_SERVICE_ID`,
  `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `UZUM_TERMINAL_ID`, `UZUM_API_KEY`, `ESKIZ_EMAIL`,
  `ESKIZ_PASSWORD`, `YANDEX_MAPS_API_KEY`); test and production values are separate.
- [ ] Client-side dependencies: merchant contracts, SMS sender-name approval (1–2 months),
  map license. These go into the release plan as blockers owned by the client.

## 6. Security checklist (backend, reviewed in `/pr-ready`)

- [ ] Callback auth checked before any parsing beyond the envelope; constant-time compare.
- [ ] Amount, currency and order state re-checked server-side on every callback.
- [ ] Unique constraint on the provider transaction id; repeats are no-ops.
- [ ] State changes plus the order update in one DB transaction.
- [ ] Secrets only from Zod-validated env; never logged; test keys never in production.
- [ ] Callback endpoints rate-limited and return the provider's exact error format.
- [ ] OTP: hashed codes, TTL, attempt limit, send rate limit (SMS costs money; see `sms-otp.md`).
