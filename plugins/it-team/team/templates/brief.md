# Brief: <product name>

## Project
- Type: **client** | **own**
- Client language (client-facing docs): ru | uz | en   · Technical docs: English
- Track: **lite** (landing page, simple bot: short PRD, one client gate, 3–6 stories) |
  **standard** (web app, admin panel, Mini App, bot with payments or roles) — the orchestrator
  proposes, the owner confirms

## Client (client projects only)
- Company / brand: …
- Decision maker(s) who approve gates: …
- Brand assets: logo, brandbook, colors, fonts → `docs/design/brand/` (or "none — brand to be created")
- Client's design references → links below + screenshots in `docs/design/refs/`
- Confidentiality: NDA? Can the work appear in my portfolio? Anything we must not publish?
- Approval habits: how fast the client answers, preferred format (call, Telegram, document)

## Idea
<1 paragraph: what it is, who it is for, the core job it does>

## Positioning (one sentence the design must make visible)
<who we are and what makes us different, e.g. "an AI-powered studio that ships in weeks, with
the testing and review of a big agency">

## Design source
team (the designer proposes 3 directions) | **provided** — <link to a design canvas / Figma
export / HTML files>: the team builds from it, skips directions, and the designer only extracts
the design system and draws the screens the design is missing

## Deadline
<date or "N days to MVP" — the PM fits v1 scope to it; empty = no fixed deadline>

## Why / problem
<the pain, how people solve it today>

## Target users
- <primary segment>
- <secondary segment>

## Must-have for v1 (MVP)
- User can …
- User can …

## Out of scope for now
- …

## Constraints
- Surfaces: public web (SEO) | admin panel | Telegram Mini App | Telegram bot | PWA | mobile (Expo) — several allowed
- Stack preference: defaults — Next.js for SEO web, Vite + React for admin/Mini App, NestJS + Prisma + Postgres API, grammY for bots
- Target market: <country; e.g. Uzbekistan>   · Payments: Payme | Click | Uzum | Telegram Stars | none
- Locales: <ru/uz/en>   · Money: <yes/no, currency>
- Auth: none | email+password | OAuth (<provider>)
- Data: Postgres + Prisma (default) | mock first
- Deploy: Vercel | Railway | Docker on VPS | undecided
- Budget/time: <e.g. evenings, 4 weeks>
- Monetization idea: <free | subscription | one-off | ads | none>

## Success looks like
- <measurable outcome after launch>

## Design references
(For client projects these come from the client; for own projects from you.)
- Links to products/sites whose look is liked, and why (one line each)
- Screenshots → `docs/design/refs/` (Mobbin, Dribbble, apps, sites)
- What it must NOT look like
- Brand feeling in 3 words
