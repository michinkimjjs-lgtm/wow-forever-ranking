--[[
  Forever Rank Collector — 내보내기 (Character Export v1)

  형식: docs/CHARACTER-EXPORT-V1.md
  - Collector.lua의 수집 결과를 하나의 export로 묶는다.
  - 업로드용 JSON 문자열(latestExportJson)과 같은 내용의 Lua 테이블(latestExport)을 저장소에 둔다.
  - 파일은 WoW 클라이언트가 로그아웃하거나 /reload 할 때 SavedVariables로 저장한다(게임 내 실행 검증 필요).
  - 애드온은 외부와 통신하지 않는다. 사용자가 파일을 직접 골라 사이트에 올린다.
]]

local _, ns = ...

-- JSON 인코더 -----------------------------------------------------------------------
-- - 키를 정렬해 같은 입력이면 항상 같은 문자열이 나온다.
-- - 배열은 ns.Array로 표시한 테이블만 배열로 쓴다. (빈 배열도 []로 나온다)
-- - 지원하지 않는 값(함수, NaN, 무한대)은 오류로 처리한다.

local ARRAY = {}

function ns.Array(list)
  return setmetatable(list or {}, ARRAY)
end

function ns.IsArray(value)
  return type(value) == "table" and getmetatable(value) == ARRAY
end

local ESCAPES = {
  ['"'] = '\\"',
  ["\\"] = "\\\\",
  ["\b"] = "\\b",
  ["\f"] = "\\f",
  ["\n"] = "\\n",
  ["\r"] = "\\r",
  ["\t"] = "\\t",
}

local function encodeString(value)
  return '"' .. string.gsub(value, '[%c"\\]', function(char)
    return ESCAPES[char] or string.format("\\u%04x", string.byte(char))
  end) .. '"'
end

local function encodeNumber(value)
  if value ~= value or value == math.huge or value == -math.huge then
    error("JSON으로 표현할 수 없는 숫자입니다.")
  end
  if math.floor(value) == value and math.abs(value) < 2 ^ 53 then
    return string.format("%d", value)
  end
  return string.format("%.14g", value)
end

local encode

local function encodeTable(value, depth)
  if depth > 20 then
    error("JSON 깊이 제한을 넘었습니다.")
  end
  local parts = {}
  if ns.IsArray(value) then
    for i = 1, #value do
      parts[#parts + 1] = encode(value[i], depth + 1)
    end
    return "[" .. table.concat(parts, ",") .. "]"
  end
  local keys = {}
  for key in pairs(value) do
    if type(key) ~= "string" then
      error("JSON 객체의 키는 문자열이어야 합니다.")
    end
    keys[#keys + 1] = key
  end
  table.sort(keys)
  for _, key in ipairs(keys) do
    parts[#parts + 1] = encodeString(key) .. ":" .. encode(value[key], depth + 1)
  end
  return "{" .. table.concat(parts, ",") .. "}"
end

encode = function(value, depth)
  local valueType = type(value)
  if valueType == "string" then
    return encodeString(value)
  elseif valueType == "number" then
    return encodeNumber(value)
  elseif valueType == "boolean" then
    return value and "true" or "false"
  elseif valueType == "table" then
    return encodeTable(value, depth)
  end
  error("JSON으로 표현할 수 없는 값입니다: " .. valueType)
end

function ns.EncodeJson(value)
  return encode(value, 0)
end

-- 내보내기 ------------------------------------------------------------------------

function ns.BuildExport(trigger)
  local builder = ns.NewBuilder()
  local observedAt, source = ns.Now()
  local export = {
    schema = ns.EXPORT_SCHEMA,
    schemaVersion = ns.EXPORT_SCHEMA_VERSION,
    collector = { name = "ForeverRankCollector", version = ns.VERSION },
    observedAt = observedAt,
    observedAtSource = source,
    trigger = trigger,
  }
  if observedAt == nil then
    builder:missing("observedAt")
  end

  local steps = {
    { "client", ns.Collect.client },
    { "gameMode", ns.Collect.gameMode },
    { "character", ns.Collect.character },
    { "gear", ns.Collect.gear },
  }
  for _, step in ipairs(steps) do
    local ok, value = pcall(step[2], builder)
    if ok then
      export[step[1]] = value
    else
      builder:missing(step[1])
      export[step[1]] = step[1] == "gear" and ns.Array({}) or {}
    end
  end

  local okAverage, average = pcall(ns.Collect.averageItemLevel, builder)
  if okAverage and average then
    export.clientAverageItemLevel = average
  end
  export.levelEvents = ns.Collect.levelEventsFor(export.character.guid)
  export.unavailable = builder.unavailable
  return export
end

function ns.Refresh(trigger)
  local db = ns.GetDB()
  local okBuild, export = pcall(ns.BuildExport, trigger or "manual")
  if not okBuild then
    db.lastError = tostring(export)
    return nil
  end
  local okJson, json = pcall(ns.EncodeJson, export)
  db.latestExport = export
  db.latestExportJson = okJson and json or nil
  db.lastError = (not okJson) and tostring(json) or nil
  return export
end

function ns.PrintStatus()
  local db = ns.GetDB()
  local export = db.latestExport
  if type(export) ~= "table" then
    ns.Print("아직 내보낸 내용이 없습니다. /frc export를 입력하세요.")
    return
  end
  local c = export.character or {}
  local withLevel = 0
  for _, item in ipairs(export.gear or {}) do
    if item.itemLevel then
      withLevel = withLevel + 1
    end
  end
  ns.Print("내보내기 요약")
  ns.PrintLine("캐릭터: " .. tostring(c.name or "-") .. " · 레벨 " .. tostring(c.level or "-"))
  ns.PrintLine("장비: " .. #(export.gear or {}) .. "개 (아이템 레벨 확인 " .. withLevel .. "개)")
  ns.PrintLine("레벨 상승 기록: " .. #(export.levelEvents or {}) .. "개")
  ns.PrintLine("얻지 못한 항목: " .. #(export.unavailable or {}) .. "개")
  if db.lastError then
    ns.PrintLine("오류: " .. tostring(db.lastError))
  end
  ns.PrintLine("파일은 로그아웃하거나 /reload 할 때 저장됩니다.")
end
