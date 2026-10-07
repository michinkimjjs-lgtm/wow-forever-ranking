--[[
  Forever Rank Probe — Core
  - 공용 네임스페이스, 채팅 출력, 슬래시 명령(/frp), 이벤트 프레임

  이 애드온은 "현재 로그인한 자신의 캐릭터"만 검사한다.
  - 외부 서버와 통신하지 않는다. (애드온에는 그런 기능이 없다)
  - 다른 플레이어를 검사(Inspect)하지 않는다.
  - 게임 플레이를 자동화하지 않는다. 검사는 사용자가 /frp scan을 입력할 때만 실행한다.
]]

local ADDON_NAME, ns = ...

ns.ADDON_NAME = ADDON_NAME
ns.PROBE_VERSION = "0.1.0"
ns.SCHEMA_VERSION = 1

local PREFIX = "|cffd4af37[Forever Rank Probe]|r "

-- 채팅창 출력. print가 없는 환경을 대비해 DEFAULT_CHAT_FRAME도 확인한다.
function ns.Print(message)
  local text = PREFIX .. tostring(message)
  local chat = rawget(_G, "DEFAULT_CHAT_FRAME")
  if type(chat) == "table" and type(chat.AddMessage) == "function" then
    chat:AddMessage(text)
  elseif type(rawget(_G, "print")) == "function" then
    print(text)
  end
end

function ns.PrintRaw(message)
  local chat = rawget(_G, "DEFAULT_CHAT_FRAME")
  if type(chat) == "table" and type(chat.AddMessage) == "function" then
    chat:AddMessage(tostring(message))
  elseif type(rawget(_G, "print")) == "function" then
    print(tostring(message))
  end
end

local function trim(text)
  return (string.gsub(text or "", "^%s*(.-)%s*$", "%1"))
end

local function printHelp()
  ns.Print("사용 방법")
  ns.PrintRaw("  /frp scan   - 현재 캐릭터에서 사용할 수 있는 API를 검사합니다.")
  ns.PrintRaw("  /frp report - 마지막 검사 결과를 요약해서 보여 줍니다.")
  ns.PrintRaw("  /frp reset  - 저장된 검사 결과를 지웁니다.")
end

local function handleSlash(input)
  local command = string.lower(trim(input))
  if command == "scan" then
    ns.RunScan()
  elseif command == "report" then
    ns.PrintReport()
  elseif command == "reset" then
    ns.ResetDB()
    ns.Print("저장된 검사 결과를 지웠습니다.")
  else
    printHelp()
  end
end

SLASH_FOREVERRANKPROBE1 = "/frp"
SlashCmdList = SlashCmdList or {}
SlashCmdList["FOREVERRANKPROBE"] = handleSlash

-- 이벤트 프레임
-- ADDON_LOADED: SavedVariables 초기화
-- PLAYER_LEVEL_UP: 레벨 상승 시각 기록 (이벤트 존재 여부도 함께 검사한다)
local createFrame = rawget(_G, "CreateFrame")
if type(createFrame) == "function" then
  local frame = createFrame("Frame")
  ns.eventFrame = frame

  frame:SetScript("OnEvent", function(_, event, ...)
    if event == "ADDON_LOADED" then
      local loadedName = ...
      if loadedName == ADDON_NAME then
        ns.InitDB()
      end
    elseif event == "PLAYER_LEVEL_UP" then
      ns.RecordLevelUp(...)
    end
  end)

  frame:RegisterEvent("ADDON_LOADED")

  -- 클라이언트에 없는 이벤트 이름을 등록하면 오류가 날 수 있으므로 pcall로 감싼다.
  local ok, err = pcall(frame.RegisterEvent, frame, "PLAYER_LEVEL_UP")
  ns.levelUpEventRegistration = { ok = ok, error = ok and nil or tostring(err) }
end
