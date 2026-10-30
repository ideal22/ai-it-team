# Inputs we need: <product>

<!-- docs/client/inputs.md — client language. Everything the team needs from outside (client,
providers, owner). Sent with Client Gate A; the orchestrator mirrors open items in
docs/run/STATE.md. A story that needs an item lists its ID in `needs:`. -->

| ID | What | From whom | Needed by (stage / story) | Lead time | Status | Notes |
|---|---|---|---|---|---|---|
| IN-01 | Brand assets (logo, brandbook, fonts) | client | Client Gate A | — | requested | → docs/design/brand/ |
| IN-02 | Content and copy for the main pages | client | Epic E02 | — | requested | |
| IN-03 | Domain and DNS access | client | release | — | requested | |
| IN-04 | Telegram bot token (dev + prod) via @BotFather | client | first bot story | 1 day | requested | never sent in chat; owner puts it in .env |
| IN-05 | Payme / Click merchant agreement + test keys | client | payment sandbox story | 2–6 weeks | requested | build against a fake provider until then |
| IN-06 | SMS sender name (Eskiz) | client | OTP story | 1–2 months | requested | |

Status: requested · received · not needed. Secrets never go into this file — only "received".
