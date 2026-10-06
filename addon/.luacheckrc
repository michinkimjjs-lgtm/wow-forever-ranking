-- ForeverRankProbe 정적 검사 설정 (WoW는 Lua 5.1)
std = "lua51"
max_line_length = 130
exclude_files = { "tests/**" }

-- 애드온이 정의하는 전역
globals = {
  "ForeverRankProbeDB",
  "SLASH_FOREVERRANKPROBE1",
  "SlashCmdList",
}

-- 애드온이 읽기만 하는 WoW 클라이언트 전역 (존재 여부는 실행 시 검사한다)
read_globals = {
  "CreateFrame",
  "DEFAULT_CHAT_FRAME",
}
