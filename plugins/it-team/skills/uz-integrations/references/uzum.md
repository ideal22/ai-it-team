# Uzum Bank: Checkout, Merchant API, Nasiya

Checked 2026-10-18. The docs are public at https://developer.uzumbank.uz. The pages render in
JavaScript; the raw OpenAPI files are at
`https://developer.uzumbank.uz/redocusaurus/{en|ru}_{checkout|merchant|nasiya}.yaml` and are
easier to read. **Credentials come only after a partner agreement**
(https://merchants.uzumbank.uz/ru/). There is no self-serve key, so the client starts this
early. Legend: [verified] in the official spec · [unverified] not stated there.

Uzum has two separate products. Pick by where the customer pays:

| Customer pays… | Product | Who calls whom |
|---|---|---|
| on a hosted card form (site, Mini App, bot link) | **Checkout** (acquiring) | We call Uzum; Uzum sends callbacks |
| inside the Uzum Bank app (find the service, enter an account or order no.) | **Merchant API** | Uzum calls our webhooks (Payme/Click style) |

## Checkout (spec v1.10.3) [verified]
Source: https://developer.uzumbank.uz/redocusaurus/en_checkout.yaml

- Cards: Visa, Mastercard, Uzcard, Humo. Hosted form, one-step or two-step (hold → `complete`),
  card binding and recurring payments, full and partial refunds, auto-fiscalization for one-step.
- Auth: headers `X-Terminal-Id` and `X-API-Key`, issued by Uzum. `Content-Language`: `ru-RU`,
  `uz-UZ`, `en-EN` sets the form language.
- Flow: `POST /api/v1/payment/register` with `amount` (**integer tiyin**), `currency: 860`,
  `orderNumber`, `successUrl`, `failureUrl`, `payType: ONE_STEP | TWO_STEP`. It returns
  `paymentRedirectUrl`; send the customer there.
- Other endpoints: `/payment/getOrderStatus`, `/payment/getOperationState`,
  `/acquiring/complete`, `/acquiring/refund`, `/acquiring/reverse`, `/acquiring/getBindings`,
  `/acquiring/unBindCard`.
- Callbacks: the acquiring callback (financial operations) is required; event and receipt
  callbacks are optional. Return `200 OK`, or Uzum retries up to 5 times. Treat the callback as a
  hint: confirm with `getOrderStatus` before marking the order paid, and make the handler idempotent.
- Test environment: test cards are in the spec (HUMO `9860 0901 0121 9724`, UzCard
  `8600 3129 2957 7175`, 3-DS code `777777`). Their expiry dates (10/26 and 09/26) may already
  have passed, so ask Uzum for current ones. **Test and production base URLs are not in the
  public spec [unverified]**; they come with the credentials.
- Error code groups: 1xxx auth, 2xxx request data, 3004 unsupported payment type.

## Merchant API (spec v1.0.0) [verified]
Source: https://developer.uzumbank.uz/redocusaurus/en_merchant.yaml

We implement five HTTPS JSON webhooks: `POST /check`, `/create`, `/confirm`, `/reverse`, `/status`.

| Webhook | We do | We return |
|---|---|---|
| `/check` | Validate `params` (account, phone, or order no.) and that the order is payable | `status: OK`, or `FAILED` + `errorCode` |
| `/create` | Store `transId` + `amount` (tiyin) against the order, **unique on `transId`** | `CREATED` |
| `/confirm` | Mark paid inside a transaction; repeat calls return the same result | `CONFIRMED` |
| `/reverse` | Cancel if allowed | reversed status or `10017` |
| `/status` | Return the stored state | current state |

- Auth: HTTP **Basic** on every webhook, with a login and password from Uzum. Compare in
  constant time; reject with `10001`.
- `timestamp` is Unix **milliseconds**; `amount` is int64 **tiyin**; check `serviceId`.
- If `/confirm` fails or times out, Uzum polls `/status` up to 10 times. If no confirm arrives
  within 30 minutes of `/create`, mark the transaction `FAILED` (a job does this).
- Errors: HTTP 400 + `{ "errorCode": "<string>" }`. Codes: `10001` access denied, `10002` JSON,
  `10003` method, `10005` missing params, `10006` bad serviceId, `10007` attribute not found,
  `10008` already paid, `10009` cancelled, `10010` duplicate transId, `10011`–`10013` amount
  invalid/min/max, `10014` transaction not found, `10015` transaction cancelled, `10016` already
  confirmed, `10017` cannot cancel, `10018` already cancelled, `99999` internal.
- Test environment: not described in the spec [unverified]; arranged with the Uzum manager.

## Nasiya (BNPL / installments, spec v1.0.2) [verified]
Source: https://developer.uzumbank.uz/redocusaurus/en_nasiya.yaml

- Server `https://merchants-api.uzumnasiya.uz`; `Authorization: Bearer <token>` from an Uzum
  Nasiya manager.
- Methods: `buyers/check-status`, `orders/calculate`, `orders`, `contracts/check-status`,
  `contracts/confirm`, `contracts/cancel`, `v3/buyers/send-code-sms`, `v3/buyers/check-code-sms`.
  Buyer registration happens in the Uzum Nasiya WebView.
- Only relevant for e-commerce clients selling goods on installments; scope it as its own story.
