# Payme (Payme Business / Paycom)

Checked 2026-10-18. Official docs (Russian): https://developer.help.paycom.uz/. The old host
`developer.paycom.uz` no longer resolves. Where the docs are silent, the vendor's own template
https://github.com/PaycomUZ/paycom-integration-php-template is cited as **[template]**.
Legend: [verified] official docs · [unverified] not found there. Legal entities only.

Two APIs:
- **Merchant API:** Payme calls **our** server (JSON-RPC 2.0) while the user pays on Payme's
  checkout page or in the Payme app. This is the default.
- **Subscribe API:** **we** call Payme to tokenize cards and charge receipts (saved cards,
  recurring payments, our own card form). Needs a separate cash desk type.

## Checkout: send the user to pay [verified]
Source: https://developer.help.paycom.uz/initsializatsiya-platezhey/

- GET: `https://checkout.paycom.uz/<base64(params)>`, where params are `key=value` joined by `;`:
  `m` merchant (cash desk) id · `ac.<field>` account fields, e.g. `ac.order_id` (field names are
  set in the cash desk) · `a` amount in **tiyin** · `l` `ru|uz|en` · `c` return URL · `ct`
  redirect delay in ms · `cr` currency.
  Example: `m=587f72c72cac0d162c722ae2;ac.order_id=197;a=500` → 5 sum.
- POST form alternative to the same host with `merchant`, `amount`, `account[<field>]`, `lang`,
  `callback` (placeholders `:transaction`, `:account.{field}`), `callback_timeout`,
  `description`, `detail` (base64 JSON with fiscal items: `title`, `price`, `count`, `code`
  (IKPU), `package_code`, `vat_percent`).
- Hosts: production `https://checkout.paycom.uz`, sandbox `https://test.paycom.uz`
  (https://developer.help.paycom.uz/pesochnitsa).
- Build the URL **on the server** from our order (amount from the DB, never from the client).

## Merchant API: what our endpoint must do [verified]
Source: https://developer.help.paycom.uz/protokol-merchant-api/ and
https://developer.help.paycom.uz/metody-merchant-api/

Transport:
- One HTTPS POST endpoint, JSON-RPC 2.0 `{ method, params, id }`. **Always answer HTTP 200**;
  any other status counts as error `-32400`. Errors go in `{ error: { code, message: { ru, uz, en }, data }, id }`;
  `message` is shown to the user, so localize it.
- Auth: `Authorization: Basic base64(login:key)`. The key is the cash desk key; the sandbox uses
  a separate `TEST_KEY` (cash desk → Settings → Developer tools). The login is given by Payme
  staff; the template says it is always `Paycom` [template]. Wrong or missing auth → `-32504`.
- Source IPs: Payme calls only from **185.234.113.1–185.234.113.15**
  (https://developer.help.paycom.uz/protokol-merchant-api/skhema-vzaimodeystviya). Allow-list them
  at the proxy or in a guard *in addition to* Basic auth, and keep the list in config.
- Data types: ids are 24-char strings; timestamps are **ms** since epoch (13 digits); amounts
  are integer **tiyin**.

Methods (all required, including GetStatement):

| Method | Params → result | Our logic |
|---|---|---|
| `CheckPerformTransaction` | `{amount, account}` → `{allow: true}` (+ optional `detail` fiscal data) | Order exists and is payable (`-31050..-31099` otherwise), amount equals the order amount (`-31001`), our dependencies are up (`-32400`) |
| `CreateTransaction` | `{id, time, amount, account}` → `{create_time, transaction, state: 1}` | Same checks. Store the transaction **unique on Payme `id`**, lock the order as "awaiting payment". **Repeat with the same `id` → the stored result.** Another transaction for an order already awaiting payment → `-31008` (sandbox rule; the template returns `-31050` — follow the sandbox). Stored `state: 1` older than the timeout → cancel with reason 4, then `-31008` [template] |
| `PerformTransaction` | `{id}` → `{transaction, perform_time, state: 2}` | Mark the order paid in one DB transaction. **A repeat returns the same result.** Unknown id → `-31003`; not in state 1 or 2 → `-31008` |
| `CancelTransaction` | `{id, reason}` → `{transaction, cancel_time, state}` | State 1 → `-1`; state 2 → `-2` (refund), or `-31007` if the order is already fulfilled and cannot be cancelled. Already cancelled → stored result. Refunds from the Payme cabinet work only if this is implemented |
| `CheckTransaction` | `{id}` → `{create_time, perform_time, cancel_time, transaction, state, reason}` | Unset times are `0`, no reason is `null`. Unknown → `-31003` |
| `GetStatement` | `{from, to}` → `{transactions: [...]}` | Transactions created successfully with Payme `time` in `[from, to]`, sorted by creation time ascending; `[]` when empty |
| `SetFiscalData` (optional) | `{id, type: PERFORM\|CANCEL, fiscal_data}` → `{success: true}` | Only if the project does fiscalization |

The docs pages for CheckPerformTransaction and CheckTransaction have swapped URLs; read the page
title, not the URL. `ChangePassword` is in the template but not in the current docs [unverified
whether Payme still calls it].

**Timeout:** Payme auto-cancels a created transaction after **43 200 000 ms (12 h)** with state
`-1`, reason `4` (https://developer.help.paycom.uz/metody-merchant-api/createtransaction). Our
order reservation must expire on the same rule.

States: `1` created · `2` performed · `-1` cancelled before perform · `-2` cancelled after
perform. Reasons: `1` receiver not found · `2` debit error · `3` execution error · `4` timeout ·
`5` refund · `10` unknown.

Error codes (https://developer.help.paycom.uz/metody-merchant-api/oshibki-errors):

| Code | Meaning |
|---|---|
| -32300 | Not a POST |
| -32700 | JSON parse error |
| -32600 | Missing fields or wrong types |
| -32601 | Method not found |
| -32504 | Insufficient privileges (bad auth) |
| -32400 | Internal error |
| -31001 | Wrong amount |
| -31003 | Transaction not found |
| -31007 | Cannot cancel: order fulfilled |
| -31008 | Operation impossible in the current state |
| -31050..-31099 | Account errors; `data` = the account field name, localized `message` |

Implementation shape (NestJS): one controller `POST /payments/payme`, a guard for IP + Basic
auth that returns the JSON-RPC error with HTTP 200, a Zod schema per method's `params`, and a
`PaymeService` that maps onto the shared `Payment` state machine. Map exceptions to Payme codes
in the controller, not the global error envelope (Payme's format wins on this route).

## Sandbox [verified]
Source: https://developer.help.paycom.uz/pesochnitsa

- https://test.paycom.uz with the merchant id and `TEST_KEY`; the cash desk needs our endpoint
  URL (a public HTTPS tunnel in dev).
- It runs scripted cases. Expected: bad auth → `-32504`; bad amount → `-31001`; unknown account
  → `-31050..-31099`; repeated Create → same result; new Create for an order awaiting payment →
  `-31008`; repeated Perform → success; Cancel/Check → no error. Mirror these cases in our API
  tests so the sandbox run is a formality.
- Test cards: expiry `03/99`, SMS code `666666`. Example card `8600069195406311`; a full list was
  not found [unverified].

## Subscribe API (saved cards) [verified]
Source: https://developer.help.paycom.uz/protokol-subscribe-api

- `https://checkout.paycom.uz/api` (test `https://checkout.test.paycom.uz/api`), JSON-RPC 2.0.
- `X-Auth: <cash_desk_id>` from the browser (card methods) and `X-Auth: <cash_desk_id>:<key>`
  from our server (receipt methods). The key never reaches the client.
- Flow: `cards.create {card{number, expire}, save}` → `cards.get_verify_code {token}` (SMS) →
  `cards.verify {token, code}` → we store the **token only** → `receipts.create {amount, account}`
  → `receipts.pay {id, token}` (state `4` = paid). Also `cards.check`, `cards.remove`,
  `receipts.cancel`, `receipts.check`.
- Card inputs have no `name` attribute and the form no `action`, so raw card data never posts to
  our server. Show the Payme logo and offer link.
- That `receipts.pay` also triggers Merchant API calls on our endpoint appears only in a diagram
  [unverified]. Implement the Merchant API anyway.
