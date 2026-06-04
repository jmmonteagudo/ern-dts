#!/usr/bin/env bash
# Manual deploy of ern-dts to CIS_DTS / cf-us20.
#
# Why manual: corporate SAP IDP enforces SSO on I589361, so CI cannot
# `cf auth user password`. Once IT provides a non-SSO service user, the CI
# `deploy` job can be enabled (set repo var DEPLOY_ENABLED=true). See
# docs/DEPLOYMENT.md.
#
# Usage:  ./scripts/deploy.sh        # checks login, runs cf push, smokes
#
# Note: tests are currently disabled — they will be re-introduced via Joule
# (see task #41). When tests come back, restore the pre-push test gate here.
set -euo pipefail

CF_API="https://api.cf.us20.hana.ondemand.com"
CF_ORG="CIS_DTS_cf-us20-i589361-j12vpy5l"
CF_SPACE="dev"
APP_NAME="ern-dts-srv"
APP_HOST="ern-dts-srv.cfapps.us20.hana.ondemand.com"

cd "$(dirname "$0")/.."

echo ">> Verifying CF login"
if ! cf target 2>/dev/null | grep -q "$CF_ORG"; then
  echo "Not logged in to $CF_ORG. Run:"
  echo "  cf login --sso -a $CF_API"
  echo "  (passcode at https://login.cf.us20.hana.ondemand.com/passcode)"
  exit 1
fi

echo ">> cf push"
cf push

echo ">> Smoke test"
curl -sf "https://$APP_HOST/api/Products" > /dev/null
curl -sf "https://$APP_HOST/products/webapp/index.html" > /dev/null
echo "OK — https://$APP_HOST/products/webapp/index.html"
