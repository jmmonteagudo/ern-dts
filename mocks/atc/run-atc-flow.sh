#!/bin/bash
# Run ATC flow: trigger run + poll until complete + fail on prio 1/2.
# Designed to run identically against real ABAP system or mock ATC server.
#
# Required env:
#   ABAP_HOST   - ATC endpoint (e.g. https://<host>.abap.region.hana.ondemand.com or http://localhost:8765)
#   ABAP_TOKEN  - OAuth token (or any string when targeting the mock)
# Optional env:
#   ATC_PACKAGE     - target package (default: ZERN_PRODUCTS)
#   MAX_POLLS       - max poll iterations (default: 30)
#   POLL_INTERVAL   - seconds between polls (default: 5)
#   CURL_VERBOSE    - if "true", logs raw responses for debugging

set -euo pipefail

: "${ABAP_HOST:?ABAP_HOST is required}"
: "${ABAP_TOKEN:?ABAP_TOKEN is required}"

PACKAGE="${ATC_PACKAGE:-ZERN_PRODUCTS}"
MAX_POLLS="${MAX_POLLS:-30}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
VERBOSE="${CURL_VERBOSE:-false}"

log() { echo "ATC: $*" >&2; }
trace() { [ "$VERBOSE" = "true" ] && echo "ATC[trace]: $*" >&2 || true; }

# Run a curl request capturing body + http_code separately. Fails with a
# clear message if the HTTP status is not 2xx.
# Usage: http_request <method> <url> <accept-header> [data]
http_request() {
  local method="$1"
  local url="$2"
  local accept="$3"
  local data="${4:-}"
  local tmp_body
  tmp_body=$(mktemp)
  trap 'rm -f "$tmp_body"' RETURN

  local args=(
    -sS
    -X "$method"
    -o "$tmp_body"
    -w '%{http_code}'
    -H "Authorization: Bearer $ABAP_TOKEN"
    -H "Accept: $accept"
  )
  if [ -n "$data" ]; then
    args+=(-H "Content-Type: application/vnd.sap.atc.run.parameters.v1+xml" --data "$data")
  fi

  local code
  code=$(curl "${args[@]}" "$url") || {
    log "curl failed for $method $url"
    cat "$tmp_body" >&2 || true
    return 1
  }

  if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
    log "HTTP $code from $method $url"
    cat "$tmp_body" >&2 || true
    return 1
  fi

  trace "HTTP $code from $method $url"
  cat "$tmp_body"
}

log "triggering run on package $PACKAGE against $ABAP_HOST"

RUN_BODY="<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<atc:run xmlns:atc=\"http://www.sap.com/adt/atc\" maximumVerdicts=\"100\">
  <objectSets>
    <objectSet kind=\"inclusive\">
      <objects>
        <object name=\"$PACKAGE\" type=\"DEVC/K\"/>
      </objects>
    </objectSet>
  </objectSets>
</atc:run>"

RUN_RESPONSE=$(http_request POST "$ABAP_HOST/sap/bc/adt/atc/runs" \
  "application/vnd.sap.atc.run.v1+xml" \
  "$RUN_BODY")

trace "run-create response: $RUN_RESPONSE"

RUN_ID=$(echo "$RUN_RESPONSE" | grep -o 'id="[^"]*"' | head -1 | cut -d'"' -f2 || true)

if [ -z "$RUN_ID" ]; then
  log "failed to parse run id from response:"
  echo "$RUN_RESPONSE" >&2
  exit 1
fi

log "run started, id=$RUN_ID"

for i in $(seq 1 "$MAX_POLLS"); do
  sleep "$POLL_INTERVAL"
  STATUS_RESPONSE=$(http_request GET "$ABAP_HOST/sap/bc/adt/atc/runs/$RUN_ID" \
    "application/vnd.sap.atc.run.v1+xml")

  trace "poll #$i body: $STATUS_RESPONSE"

  if echo "$STATUS_RESPONSE" | grep -q 'status="completed"'; then
    log "run completed"
    echo "$STATUS_RESPONSE"

    if echo "$STATUS_RESPONSE" | grep -qE 'priority="[12]"'; then
      log "blocking findings (priority 1 or 2) detected"
      exit 1
    fi

    log "no blocking findings. Pass."
    exit 0
  fi

  log "polling ($i/$MAX_POLLS)..."
done

log "timeout after $MAX_POLLS polls"
exit 1
