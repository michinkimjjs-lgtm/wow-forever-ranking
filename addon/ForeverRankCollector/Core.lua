--[[
  Forever Rank Collector — Core
  - 버전, 공용 도구(안전한 API 호출, secret 값 처리, 시각), 이벤트, 슬래시 명령(/frc)
  - 파일 구성: Core.lua → SavedVariables.lua(저장소) → Collector.lua(수집) → Export.lua(내보내기, JSON)

  원칙
  - 로그인한 자신의 캐릭터("player")만 읽는다.
  - 외부와 통신하지 않는다. 결과는 SavedVariables 파일에만 남는다.
  - 게임 플레이를 자동화하지 않는다. 다른 플레이어를 검사(Inspect)하지 않는다.
  - 얻지 못한 값은 비워 둔다. 값을 지어내지 않는다.
]]

local ADDON_NAME, ns = ...

ns.ADDON_NAME = ADDON_NAME
-- Collector 버전과 Export 형식(schema) 버전은 서로 다른 값이다.
-- - VERSION: 애드온 배포 버전. ForeverRankCollector.toc의 ## Version, 사이트 설정(config/collector.ts)과 같아야 한다.
-- - EXPORT_SCHEMA_VERSION: 내보내는 Character Export 형식 버전(docs/CHARACTER-EXPORT-V1.md).
ns.VERSION = "1.0.0"
ns.EXPORT_SCHEMA = "forever-rank/character-export"
ns.EXPORT_SCHEMA_VERSION = 1

local PREFIX = "|cffd4af37[Forever Rank Collector]|r "

-- 출력 ----------------------------------------------------------------------

local function output(text)
  local chat = rawget(_G, "DEFAULT_CHAT_FRAME")
  if type(chat) == "table" and type(chat.AddMessage) == "function" then
    chat:AddMessage(text)
  elseif type(rawget(_G, "print")) == "function" then
    print(text)
  end
end

function ns.Print(message)
  output(PREFIX .. tostring(message))
end

function ns.PrintLine(message)
  output("  " .. tostring(message))
end

-- 안전한 API 호출 -------------------------------------------------------------

-- "C_Item.GetCurrentItemLevel" 같은 경로를 _G에서 찾는다.
function ns.Resolve(path)
  local current = _G
  for part in string.gmatch(path, "[^%.]+") do
    if type(current) ~= "table" then
      return nil
    end
    local ok, value = pcall(function()
      return current[part]
    end)
    if not ok then
      return nil
    end
    current = value
  end
  return current
end

-- 반환값 사이에 nil이 있어도 개수를 정확히 센다.
local function pack(...)
  return { n = select("#", ...), ... }
end

-- 함수를 pcall로 호출한다. 반환: 성공 여부, 반환값 테이블({ n = 개수, ... })
function ns.Call(path, ...)
  local fn = ns.Resolve(path)
  if type(fn) ~= "function" then
    return false, nil
  end
  local results = pack(pcall(fn, ...))
  if not results[1] then
    return false, nil
  end
  local returns = { n = math.max(results.n - 1, 0) }
  for i = 2, results.n do
    returns[i - 1] = results[i]
  end
  return true, returns
end

-- secret 값(전투 중 보호되는 값)이면 nil. 빈 문자열도 nil.
function ns.Clean(value)
  if value == nil then
    return nil
  end
  local isSecret = rawget(_G, "issecretvalue")
  if type(isSecret) == "function" then
    local ok, secret = pcall(isSecret, value)
    if not ok or secret then
      return nil
    end
  end
  local valueType = type(value)
  if valueType == "string" then
    return value ~= "" and value or nil
  elseif valueType == "number" then
    if value ~= value or value == math.huge or value == -math.huge then
      return nil
    end
    return value
  elseif valueType == "boolean" then
    return value
  end
  return nil
end

function ns.CleanInteger(value)
  value = ns.Clean(value)
  if type(value) == "number" and math.floor(value) == value then
    return value
  end
  return nil
end

-- 관측 시각: 서버 시각 → 없으면 time()
function ns.Now()
  local ok, returns = ns.Call("GetServerTime")
  local value = ok and ns.CleanInteger(returns[1]) or nil
  if value then
    return value, "GetServerTime"
  end
  ok, returns = ns.Call("time")
  value = ok and ns.CleanInteger(returns[1]) or nil
  if value then
    return value, "time"
  end
  return nil, "none"
end

-- 내보내기 예약 (같은 순간의 여러 이벤트를 한 번으로 묶는다) ------------------

local scheduledTrigger
function ns.Schedule(trigger, delay)
  local after = ns.Resolve("C_Timer.After")
  if type(after) ~= "function" then
    ns.Refresh(trigger)
    return
  end
  if scheduledTrigger then
    scheduledTrigger = trigger
    return
  end
  scheduledTrigger = trigger
  local ok = pcall(after, delay or 1, function()
    local current = scheduledTrigger
    scheduledTrigger = nil
    ns.Refresh(current)
  end)
  if not ok then
    scheduledTrigger = nil
    ns.Refresh(trigger)
  end
end

-- 슬래시 명령 -------------------------------------------------------------------

local function trim(text)
  return (string.gsub(text or "", "^%s*(.-)%s*$", "%1"))
end

local function printHelp()
  ns.Print("사용 방법 (Collector " .. ns.VERSION .. " · Export 형식 " .. ns.EXPORT_SCHEMA_VERSION .. ")")
  ns.PrintLine("/frc export - 지금 상태로 내보내기 파일 내용을 갱신합니다.")
  ns.PrintLine("/frc status - 마지막 내보내기 요약을 보여 줍니다.")
  ns.PrintLine("/frc clear  - 저장된 내보내기 내용을 지웁니다.")
  ns.PrintLine("파일은 로그아웃하거나 /reload 할 때 저장됩니다. 외부로 전송하지 않습니다.")
end

local function handleSlash(input)
  local command = string.lower(trim(input))
  if command == "export" then
    ns.Refresh("manual")
    ns.PrintStatus()
  elseif command == "status" then
    ns.PrintStatus()
  elseif command == "clear" then
    ns.ClearDB()
    ns.Print("저장된 내보내기 내용을 지웠습니다.")
  else
    printHelp()
  end
end

SLASH_FOREVERRANKCOLLECTOR1 = "/frc"
SlashCmdList = SlashCmdList or {}
SlashCmdList["FOREVERRANKCOLLECTOR"] = handleSlash

-- 이벤트 -----------------------------------------------------------------------
-- 클라이언트에 없는 이벤트를 등록하면 오류가 나므로 하나씩 pcall로 등록한다.

local EVENTS = {
  "ADDON_LOADED",
  "PLAYER_ENTERING_WORLD",
  "PLAYER_LEVEL_UP",
  "PLAYER_EQUIPMENT_CHANGED",
  "PLAYER_GUILD_UPDATE",
  "ITEM_DATA_LOAD_RESULT",
  "PLAYER_LOGOUT",
}

ns.eventRegistration = {}

local createFrame = rawget(_G, "CreateFrame")
if type(createFrame) == "function" then
  local okFrame, frame = pcall(createFrame, "Frame")
  if okFrame and frame then
    ns.eventFrame = frame
    frame:SetScript("OnEvent", function(_, event, ...)
      if event == "ADDON_LOADED" then
        if (...) == ADDON_NAME then
          ns.GetDB()
        end
      elseif event == "PLAYER_ENTERING_WORLD" then
        ns.Schedule("login", 3)
      elseif event == "PLAYER_LEVEL_UP" then
        ns.RecordLevelUp((...))
        ns.Schedule("level_up", 2)
      elseif event == "PLAYER_EQUIPMENT_CHANGED" then
        ns.Schedule("equipment_changed", 2)
      elseif event == "PLAYER_GUILD_UPDATE" then
        local unit = ...
        if unit == nil or unit == "player" then
          ns.Schedule("guild_changed", 2)
        end
      elseif event == "ITEM_DATA_LOAD_RESULT" then
        local itemId = ...
        if ns.pendingItems and itemId and ns.pendingItems[itemId] then
          ns.Schedule("item_data_loaded", 1)
        end
      elseif event == "PLAYER_LOGOUT" then
        -- SavedVariables는 이 이벤트 뒤에 저장되므로 예약 없이 바로 갱신한다.
        ns.Refresh("logout")
      end
    end)
    for _, event in ipairs(EVENTS) do
      local ok, err = pcall(frame.RegisterEvent, frame, event)
      ns.eventRegistration[event] = ok and true or tostring(err)
    end
  end
end
