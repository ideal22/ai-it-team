# Uzbekistan personal data: localization and hosting

> **Not legal advice.** This summary comes from public sources, checked 2026-10-18, and is for
> engineering planning only. Uzbek data law changed in 2026 and decrees often fill in the details.
> Every hosting ADR for a Uzbek client must say "confirm with a lawyer licensed in Uzbekistan",
> and the client confirms in writing. Re-check lex.uz before relying on any line below.

Legend: **[verified]** read in the primary text on lex.uz/gov.uz · **[secondary]** a law firm or
news source · **[unverified]** conflicting or missing.

## What the law says now

| Topic | Rule | Status |
|---|---|---|
| Base law | Law "On Personal Data" No. ZRU-547, 2 Jul 2019, in force 1 Oct 2019 | [verified] [1] |
| 2021 rule (superseded) | Art. 27-1, added by ZRU-666 of 14 Jan 2021 and applied from mid-April 2021: **all** citizens' personal data processed with IT, including online, had to be stored on hardware physically located in Uzbekistan and registered in the State Register | [verified] [2] |
| **Current rule (since 27 Mar 2026)** | ZRU-1125 of 26 Mar 2026 rewrote Art. 27-1. **Must stay in Uzbekistan:** (1) biometric data, (2) genetic data, (3) data of people who use the services of telecom operators working in Uzbekistan. **All other personal data** may be stored and processed abroad if one of these holds: the country is on the adequacy list, *or* the operator uses approved standard contractual clauses / binding corporate rules, *or* it follows approved international standards | [verified] [3] |
| Adequacy list | Cabinet Resolution No. 415 of 29 Jul 2026, in force 3 Aug 2026: 49 states and territories, including the EU/EEA, UK, Switzerland, Japan, South Korea, Singapore, Canada, Israel and Russia. The **US counts only for companies in the EU–US Data Privacy Framework**. **Kazakhstan is not listed.** | count + US note [verified] [4]; country list [secondary] [5] |
| Transfer to unlisted countries | Only under conditions set by the authorized body (SCC/BCR requirements). They were due ~Nov 2026 and none were found as of 18 Oct 2026 | [unverified] [4] |
| Breach during a cross-border transfer | Notify the authorized body within 24 h, with a detailed report within 72 h | [verified] [4] |
| Cross-border transfer (Art. 15) | Allowed to countries with equal protection; elsewhere in listed cases, including the data subject's consent | [verified] [1] |
| State Register | Art. 20 (amended 2026): databases that **must be stored in Uzbekistan** are registered by notification; changes are reported within 10 days | [verified] [1] |
| Authorized body | The law names the State Personalization Center; Resolution 415 names the MIA Department of Migration and Personalization. The act that moved the function was not found | [unverified] |
| Liability | Administrative Code Art. 46-2 and Criminal Code Art. 141-2; an AI-processing offence was added in Jan 2026 (ZRU-1115). Current amounts were not checked | [unverified] |
| Enforcement history | In 2021 the regulator restricted TikTok, Twitter, VK, WeChat and Skype over the old rule, and briefly throttled others | [secondary] [6] |

Scope of category (3) is open. "Users of telecom operators' services" may mean only operators'
own subscriber records (SIM/IMSI/IMEI, subscriber details), or almost everyone in Uzbekistan.
One law-firm summary takes the narrow reading [7]. **Ask counsel; do not decide it in an ADR.**

## What this means for a project (facts, not advice)

Classify the PII inventory (system-analyst, architecture.md) into:

| Class | Examples in our typical projects | Hosting implication |
|---|---|---|
| A — must stay in Uzbekistan | face photos used for recognition, fingerprints, voice prints, DNA/medical-genetic data, telecom subscriber data (if the client is a telecom operator or the narrow reading does not apply) | Database and backups on hardware in Uzbekistan; database registered in the State Register |
| B — may go abroad under a condition | name, phone, Telegram id, address, orders, payment status | Host in Uzbekistan **or** in an adequacy-list country (e.g. an EU region). US providers only through a DPF-participant entity. Kazakhstan regions (e.g. Yandex Cloud `kz1`) are not covered by the list |
| Not personal data | anonymized analytics, catalog | No constraint from this law |

Notes:
- Payment card data never touches our servers: Payme, Click and Uzum host the card form. We store
  only provider transaction ids and statuses.
- A plain profile photo is not automatically biometric data. It becomes a question once the
  product does face matching. Flag it for counsel.
- Backups, logs, error tracking (e.g. Sentry) and analytics are processing too. Put them in the
  same jurisdiction class as the primary database, or strip PII before sending.
- If the client is unsure or risk-averse, in-country hosting for everything is the simple, safe
  option. Record it as the client's choice.

## Hosting options seen in Uzbekistan (no recommendation)

| Provider / facility | What | Status |
|---|---|---|
| Uztelecom **UzCloud** | National cloud (IaaS/PaaS, S3, GPU). Tier III data centers in Bukhara and Kokand opened 22 Sep 2026; Zangiata due autumn 2026 | [verified] [8] |
| **UZINFOCOM** data center, Tashkent | Colocation and cloud servers | [secondary] |
| **Servercore** | Availability zone in Tashkent (on UZINFOCOM) | [secondary] |
| **Serverspace** | VPS in the East Telecom data center, Tashkent (since Apr 2026) | [secondary] |
| **DataVolt TAS-1**, Tashkent IT Park | 12 MW carrier-neutral data center, phase 1 targeted end-2026 | [secondary]; dates conflict |
| Yandex Cloud | Regions in Russia and Kazakhstan; **no Uzbekistan region** | [verified] [9] |
| AWS / Azure / GCP / Oracle | No Uzbekistan region found as of Oct 2026 | none found by search |

Before choosing a provider, check its current pricing, managed Postgres availability, backups,
and S3 compatibility on its own site. These change faster than this file.

## Questions for the client's lawyer (put them in the hosting ADR)

1. Which of our data falls into Art. 27-1 part 2 (especially the "telecom users" category)?
2. Does any database need registration in the State Register? Who files the notification?
3. If we host abroad: is the target country on the Resolution 415 list, and which condition of
   Art. 27-1 part 3 do we rely on?
4. Consent text for cross-border transfer and processing (ru/uz), if consent is the basis.
5. Current authorized body and fine amounts.

## Sources (read 2026-10-18)

1. Law ZRU-547, consolidated text — https://lex.uz/ru/docs/4396419
2. Law ZRU-666 of 14 Jan 2021, Art. 13 — https://lex.uz/ru/docs/5220725
3. Law ZRU-1125 of 26 Mar 2026 — https://lex.uz/ru/docs/8104580 (Uzbek: https://lex.uz/uz/docs/-8099215)
4. Cabinet Resolution No. 415 of 29 Jul 2026 — https://lex.uz/ru/docs/8369688
5. Spot.uz, list of adequate countries (4 Aug 2026) — https://www.spot.uz/ru/2026/08/04/personal-data-abroad/
6. RFE/RL (Aug 2022) — https://www.rferl.org/a/uzbekistan-social-media-networks-unblocked/31970531.html
7. Settle Advisory (22 Jan 2026) — https://settleadvisory.com/news-en/localization-of-personal-data-in-uzbekistan-transition-to-a-more-flexible-regulatory-model/
8. Ministry of Digital Technologies (Sep 2026) — https://gov.uz/en/digital/news/view/222857
9. Yandex Cloud regions — https://yandex.cloud/en/docs/overview/concepts/region
