#!/usr/bin/env sh
# 애드온 정적 검사 + 오프라인 하네스 (게임 내 실행 검증을 대신하지 않는다)
#   PYTHON 환경변수로 jsonschema가 설치된 파이썬을 지정할 수 있다.
set -e
cd "$(dirname "$0")/.."
for f in ForeverRankProbe/*.lua ForeverRankCollector/*.lua; do luac5.1 -p "$f"; done
echo "luac5.1 문법 검사 통과"
luacheck --config .luacheckrc ForeverRankProbe/ ForeverRankCollector/
lua5.1 tests/harness.lua bare
lua5.1 tests/harness.lua stubbed

OUT="$(mktemp -d)"
lua5.1 tests/collector_harness.lua bare "$OUT/bare.json"
lua5.1 tests/collector_harness.lua stubbed "$OUT/stubbed.json"
"${PYTHON:-python3}" tests/validate_export.py ../docs/schemas/character-export-v1.schema.json "$OUT/bare.json" "$OUT/stubbed.json"
rm -rf "$OUT"
