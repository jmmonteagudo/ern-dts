# Deployment

Production target: **CIS_DTS** global account (`39c3a16d-8bc5-4286-8696-1e884b553d4b`), region **cf-us20**, subaccount `CF_US20_I589361`, org `CIS_DTS_cf-us20-i589361-j12vpy5l`, space `dev`.

Live URL: https://ern-dts-srv.cfapps.us20.hana.ondemand.com/products/webapp/index.html

## Manual deploy (current)

```bash
cf login --sso -a https://api.cf.us20.hana.ondemand.com
# passcode: https://login.cf.us20.hana.ondemand.com/passcode

./scripts/deploy.sh
# or skip local tests:
./scripts/deploy.sh --skip-tests
```

The script verifies `cf target` matches the expected org/space, runs `cf push`, then smoke-tests both `/api/Products` and the Fiori webapp.

## Why deploy is not auto-triggered from CI

The repo's GitHub Actions workflow (`.github/workflows/ci-cd.yml`) gates the `deploy` job behind `vars.DEPLOY_ENABLED == 'true'`, defaulting to disabled.

Reason: the corporate SAP Identity Provider enforces SSO for all human users including `I589361`. Cloud Foundry CI auth (`cf auth $USER $PASSWORD`) requires a password, which SSO accounts do not have.

Three production-grade ways to enable auto-deploy:

| Approach | Setup | Pros | Cons |
|---|---|---|---|
| **Service-user technical account** (e.g. `srv_cicd_ern@sap.com`) | IT ticket to create non-SSO account, scoped permissions to space | Standard in enterprise, simple `cf auth` | Requires IT approval, password rotation |
| **IAS technical user** + `SpaceDeveloper` role | Provision IAS technical user in tenant, assign to org/space | Fully self-service if you control the IAS tenant | CIS_DTS shares the corporate IAS — needs IAS admin |
| **GitHub OIDC federation → BTP custom IDP trust** | Configure GitHub as trusted IDP in BTP, exchange OIDC token for CF token at runtime | Zero secrets in CI, auditable per commit, modern best practice | Most complex setup, requires BTP IDP-trust changes |

## To enable auto-deploy once a service user exists

1. Add repository secrets in GitHub (`Settings → Secrets and variables → Actions → Secrets`):

   | Secret | Value |
   |---|---|
   | `CF_API` | `https://api.cf.us20.hana.ondemand.com` |
   | `CF_USER` | `<service-user-email>` |
   | `CF_PASSWORD` | `<service-user-password>` |
   | `CF_ORG` | `CIS_DTS_cf-us20-i589361-j12vpy5l` |
   | `CF_SPACE` | `dev` |

2. Add repository variable: `DEPLOY_ENABLED=true` (`Variables` tab, same page).

3. Push to `main` — the `deploy` job will run after lint/test gates.

4. (Optional) Rotate the service user password every 90 days; update `CF_PASSWORD` secret accordingly.

## Reference architecture for full enterprise CI/CD

For larger landscapes (DEV → QA → PROD with approval gates), consider:

- **Multi-stage workflow** with `environments:` block in GitHub Actions, manual approval gate before PROD
- **MTA build** (`npx mbt build`) instead of bare `cf push` — bundles CAP backend + Fiori app + service instances declaratively
- **HTML5 Apps Repo** for the Fiori app (separate from the CAP backend), enabling independent rollout
- **Rolling Releases** (Cloud Foundry feature) for canary deploys
- **Cloud Transport Management** (cTMS) for ABAP transports if a Z-package is part of the solution
- **SAST/DAST** (SonarQube, Checkmarx, Snyk) in the lint stage
- **Joule for Developers code review** on PRs (preview)
