# Click

Checked 2026-10-18. Official docs: https://docs.click.uz/en/ (Russian: https://docs.click.uz/).
The site renders in JavaScript, so read it in a browser; WebFetch sees only the home page.
Legend: [verified] official docs · [unverified] not found there.

Two APIs:
- **SHOP API:** Click calls **our** server twice per payment (Prepare, then Complete). This is
  the default with the payment button.
- **Merchant API:** **we** call Click (invoices sent to a phone, payment status, reversal, card
  tokens).

**Amounts are in sum, not tiyin.** Click sends and expects `amount` as a decimal in sum (button
format `N.NN`). Our DB stays in tiyin; convert at the adapter (`tiyin / 100`, formatted with 2
decimals) and compare as integers after parsing the decimal string, **never as floats**.

## Payment button [verified]
Source: https://docs.click.uz/en/click-button/

`https://my.click.uz/services/pay?service_id={service_id}&merchant_id={merchant_id}&amount={amount}&transaction_param={order_id}&return_url={url}&card_type={uzcard|humo}`

- Required: `service_id`, `merchant_id`, `amount` (`N.NN`), `transaction_param` (comes back as
  `merchant_trans_id`). Optional: `merchant_user_id`, `return_url`, `card_type`.
- Build it on the server from our order.
- In-page alternative: `https://my.click.uz/pay/checkout.js` with `createPaymentRequest(params, cb)`;
  callback `status` `<0` error, `0` created, `1` processing, `2` success
  (https://docs.click.uz/en/click-pay-by-card/). The status is UI feedback only; the order is paid
  when Complete succeeds.

## SHOP API: our two endpoints [verified]
Source: https://docs.click.uz/en/shop-api/requests, errors: https://docs.click.uz/en/shop-api/errors

Click POSTs **`application/x-www-form-urlencoded`**; we answer **JSON**. Endpoints, e.g.
`POST /payments/click/prepare` and `POST /payments/click/complete`.

Request fields: `click_trans_id` (bigint), `service_id` (int), `click_paydoc_id` (bigint),
`merchant_trans_id` (our order id), `amount` (sum, decimal), `action` (`0` Prepare, `1`
Complete), `error` (int, `0` = OK), `error_note`, `sign_time` (`YYYY-MM-DD HH:mm:ss`),
`sign_string`; Complete also has `merchant_prepare_id`.

**Signature** (MD5, hex, strings concatenated in this order):
- Prepare: `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)`
- Complete: `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)`

Use the **raw received strings** for the hash (how `amount` is formatted inside the signature
is not documented [unverified]; re-serializing a parsed number can break it). Compare in
constant time. MD5 with a shared secret is Click's scheme; treat the endpoint as public and
also check `service_id`.

| Step | Our logic | Response |
|---|---|---|
| Prepare (`action=0`) | Verify sign (`-1`). Order exists (`-5`) and is payable, amount equals the order amount (`-2`), not already paid (`-4`). Store a prepare record **unique on `click_trans_id`**, reserve the order | `{click_trans_id, merchant_trans_id, merchant_prepare_id, error: 0, error_note: "Success"}` |
| Complete (`action=1`) | Verify sign. Prepare record exists (`-6`). If the request has `error < 0`: cancel the payment and return `-9`. Repeat of a finished Complete → same success (or `-4` already paid). Otherwise mark paid in one DB transaction | `{click_trans_id, merchant_trans_id, merchant_confirm_id, error: 0, error_note: "Success"}` |

Rules from the docs:
- After a successful Prepare and card debit, Complete may return an error **only** `-4` or `-9`.
  If our fulfilment fails after the debit, answer success and reverse the payment through the
  Merchant API `payment/reversal`.
- Repeated error answers send the payment to manual review at Click support.

Error codes:

| error | error_note | Meaning |
|---|---|---|
| 0 | Success | OK |
| -1 | SIGN CHECK FAILED! | Bad signature |
| -2 | Incorrect parameter amount | Wrong amount |
| -3 | Action not found | Unknown action |
| -4 | Already paid | Already confirmed |
| -5 | User does not exist | Order (`merchant_trans_id`) not found |
| -6 | Transaction does not exist | `merchant_prepare_id` not found |
| -7 | Failed to update user | Our update failed |
| -8 | Error in request from click | Malformed request |
| -9 | Transaction cancelled | Cancelled |

**Do not confuse this with "Advanced Shop"** (https://docs.click.uz/en/additional/get-info), a
separate JSON protocol with different action numbers (Getinfo 0, Prepare 1, Complete 2,
Check 3) and a different signature. Use it only if the client's Click contract says so.

## Merchant API: we call Click [verified]
Source: https://docs.click.uz/en/merchant-api/requests, errors: https://docs.click.uz/en/merchant-api/errors

- Base `https://api.click.uz/v2/merchant`. Credentials: `merchant_id`, `service_id`,
  `merchant_user_id`, `secret_key`.
- Header `Auth: <merchant_user_id>:<sha1(timestamp + secret_key)>:<timestamp>` (10-digit Unix
  seconds, hex digest), plus `Accept` and `Content-Type: application/json`.
- Endpoints: `POST /invoice/create {service_id, amount, phone_number, merchant_trans_id}`;
  `GET /invoice/status/:service_id/:invoice_id`; `GET /payment/status/:service_id/:payment_id`;
  `GET /payment/status_by_mti/:service_id/:merchant_trans_id/YYYY-MM-DD`;
  `DELETE /payment/reversal/:service_id/:payment_id`; card tokens `POST /card_token/request`,
  `/card_token/verify`, `/card_token/payment`, `DELETE /card_token/:service_id/:card_token`.
- Reversal works only for successful online-card payments in the current reporting month (the
  previous month only on the 1st), and Uzcard may reject it.
- Errors are HTTP status codes (400, 401, 403, 404, 406, 410, 500, 502). The `payment_status`
  and `invoice_status` value tables are not documented [unverified]; log raw values.

## Testing [unverified]
- **No public sandbox, test host, or test cards** are documented, and no callback IP list.
  Testing is arranged with Click at onboarding (ask for a test service or test mode in the
  merchant cabinet).
- Until then, cover both endpoints with API tests using payloads signed by a test secret
  (valid, bad sign, wrong amount, unknown order, repeat Complete, `error < 0` cancel).
- Put "Click test access" on the client's onboarding checklist.
