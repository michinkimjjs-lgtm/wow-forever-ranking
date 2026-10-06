#!/usr/bin/env sh
# ForeverRankProbe 정적 검사 + 오프라인 하네스 (게임 내 실행 검증을 대신하지 않는다)
set -e
cd "$(dirname "$0")/.."
for f in ForeverRankProbe/*.lua; do luac5.1 -p "$f"; done
echo "luac5.1 문법 검사 통과"
luacheck --config .luacheckrc ForeverRankProbe/
lua5.1 tests/harness.lua bare
lua5.1 tests/harness.lua stubbed
