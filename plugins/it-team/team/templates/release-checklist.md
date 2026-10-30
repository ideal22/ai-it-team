# Release checklist: <product> v<version>

## Quality
- [ ] All stories in scope `done`; BOARD.md updated
- [ ] typecheck / lint / unit / API / E2E green on main (paste results)
- [ ] No open blocker/major bugs
- [ ] Code, security, and database reviews clean for the release diff

## Config & infra
- [ ] Env vars documented in .env.example; set in hosting (by the user)
- [ ] DB migrations reviewed (database-reviewer), forward-only, backup plan
- [ ] Health endpoint, error tracking (optional), logs
- [ ] Security headers, CORS, rate limits

## Product
- [ ] Tracking plan events fire (data-analyst checked)
- [ ] README, CHANGELOG, user guide updated (tech-writer)

## Staging & acceptance
- [ ] Release deployed to staging by the user (client projects: always; own projects: optional)
- [ ] Smoke test on staging passed (paste results)
- [ ] Client UAT on staging done; fixes listed and resolved or deferred
      (client projects; record in docs/client/approvals.md)

## Deploy (done by the user)
- [ ] Push / deploy command: …
- [ ] Smoke test after deploy: …
- [ ] Rollback: …
