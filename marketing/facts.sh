#!/bin/bash
# 오늘(또는 지정한 날) 홍보용 사실 뽑기: bash marketing/facts.sh [YYYY-MM-DD]
cd "$(dirname "$0")/../game" && NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/root/.ccr/ca-bundle.crt} npx tsx ../marketing/scripts/facts.mts "$@" 2>&1 | grep -v "UNDICI-EHPA\|trace-warnings"
