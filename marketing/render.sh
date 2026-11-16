#!/bin/bash
# 카드 이미지 만들기 (facts.sh 다음에): bash marketing/render.sh [YYYY-MM-DD]
cd "$(dirname "$0")/../game" && npx tsx ../marketing/scripts/render.mts "$@"
