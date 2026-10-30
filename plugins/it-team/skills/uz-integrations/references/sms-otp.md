# SMS and OTP in Uzbekistan

Checked 2026-10-18. Legend: [verified] official doc or site · [unverified] not stated there.

## Choosing a channel

| Product | Default OTP channel |
|---|---|
| Telegram bot / Mini App | No OTP needed: identity comes from Telegram (`initData` / user id). For a phone number, use a `request_contact` keyboard button |
| Web or mobile, users mostly on Telegram | **Telegram Gateway** first, with SMS as the fallback |
| Web or mobile, general audience | **SMS via Eskiz** (or another local aggregator the client already has a contract with) |

Phone numbers: store E.164 `+998XXXXXXXXX` (country code +998 per ITU, https://www.itu.int/oth/t0202
[verified]; 9 digits after 998 per Eskiz examples and third-party guides). Format per provider at the edge:
Eskiz wants `998XXXXXXXXX` without `+`; Telegram Gateway wants E.164.

## Eskiz (notify.eskiz.uz) [verified]
API reference: https://documenter.getpostman.com/view/663428/RzfmES4z · Terms and prices: https://eskiz.uz/sms

- **Legal entities only.** The client signs the contract; the account belongs to the client.
- Auth: `POST /api/auth/login` (form-data `email`, `password`) → bearer token valid for **30 days**;
  `PATCH /api/auth/refresh` renews it. Cache the token server-side (DB/Redis), refresh before
  expiry and on 401. Never log it.
- Send: `POST /api/message/sms/send` (form-data `mobile_phone`, `message`, `from`, optional
  `callback_url`) → `{ id: <uuid>, status: "waiting" }`. Bulk: `POST /api/message/sms/send-batch`
  (JSON `messages[{ user_sms_id ≤12 chars, to, text }]`, `from`, `dispatch_id`, `callback_url`).
- Delivery callback: POST to `callback_url` with `request_id` (the send `id`), `message_id`,
  `phone_number`, `sms_count`, `status` (`DELIVRD`, `UNDELIV`, `EXPIRED`, `REJECTD`, …),
  `status_date`. The callback carries **no signature in the docs [unverified]**: put a random
  secret in the callback URL path, and treat the callback only as delivery telemetry, never as auth.
  Poll `GET /api/message/sms/status_by_id/:id` when needed.
- **Test mode:** only three texts can be sent: `Это тест от Eskiz`, `Bu Eskiz dan test`,
  `This is test from Eskiz`. Real OTP text works only after the account is activated.
- **Templates:** `POST /api/user/template` submits a text for moderation; statuses `moderation`,
  `inproccess`, `service`, `reklama`, `rejected`. That every production text must match an
  approved template is widely reported but **not stated in the docs [unverified]**. Plan for it:
  keep OTP texts fixed per locale (`{code}` is the only variable) and submit them early.
- **Sender name (alpha name):** operators take **1–2 months** to approve. Until then messages go
  from the default `4546`. Put this on the release plan for client projects.
- Price (eskiz.uz/sms, Oct 2026): 95 UZS per SMS; 175 UZS per advertising SMS to Ucell, Uzmobile,
  Mobiuz. One SMS = 160 Latin or 70 Cyrillic characters, so Uzbek Latin OTP text is cheaper than
  Russian Cyrillic.

## Telegram Gateway [verified]
Docs: https://core.telegram.org/gateway/api · Pricing: https://core.telegram.org/gateway

- `https://gatewayapi.telegram.org/<method>`, `Authorization: Bearer <token>`.
- `sendVerificationMessage(phone_number, code | code_length 4–8, ttl 30–3600 s, callback_url?, payload?)`;
  `checkVerificationStatus(request_id, code)`; `checkSendAbility(phone_number)` first tells
  whether the number is reachable, and the returned `request_id` makes the next send free.
- Delivery reports: verify `X-Request-Signature` = HMAC-SHA256(key = SHA256(token),
  data = `X-Request-Timestamp` + "\n" + body).
- $0.01 per delivered code; undelivered within `ttl` is refunded. Availability and pricing for
  Uzbekistan are not stated [unverified], so always keep an SMS fallback.

## Other aggregators
- Play Mobile (https://playmobile.uz): SMS broker; **no public API docs** [unverified beyond the site].
  Use only if the client already has a contract; get the docs from them.

## OTP rules (any provider)
- Codes: 4–6 digits, cryptographically random, store a **hash**, TTL 2–5 min, max 5 attempts,
  then lock. Rate-limit sends per phone (e.g. 1/min, 5/hour) and per IP; add a resend cooldown
  in the UI.
- Never return whether a phone is registered from the send endpoint (account enumeration).
- Sending SMS costs the client money: protect the endpoint against SMS pumping (rate limits,
  captcha on web after N sends, allow only `+998` unless the PRD says otherwise).
- In dev/test, use a fake provider adapter behind the same interface; never send real SMS from
  CI or tests.
