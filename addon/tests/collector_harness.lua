--[[
  ForeverRankCollector 오프라인 테스트 하네스 (Lua 5.1)

  게임 밖에서 애드온 파일을 TOC 순서대로 불러와 실행 흐름만 검사한다.
  - 여기의 스텁 함수와 값은 테스트용 가짜이며, 실제 WoW: Forever 반환값을 뜻하지 않는다.
  - 실제 동작 확인은 게임 안에서만 할 수 있다.

  사용: lua5.1 tests/collector_harness.lua bare|stubbed <export.json 출력 경로>
]]

local scenario = arg[1] or "bare"
local outputPath = arg[2]
local failures = 0
local messages = {}

local function check(condition, message)
  if condition then
    io.write("  ok   ", message, "\n")
  else
    failures = failures + 1
    io.write("  FAIL ", message, "\n")
  end
end

_G.print = function(...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[#parts + 1] = tostring((select(i, ...)))
  end
  messages[#messages + 1] = table.concat(parts, " ")
end

local registered, handler = {}, nil
local timers = {}
local requestedLoads = {}
local SECRET = setmetatable({}, { __tostring = function() return "<secret>" end })

if scenario == "stubbed" then
  _G.CreateFrame = function()
    local frame = {}
    function frame:SetScript(_, fn) handler = fn end
    function frame:RegisterEvent(name)
      if name == "PLAYER_GUILD_UPDATE" then error("unknown event for test") end
      registered[name] = true
    end
    return frame
  end
  _G.C_Timer = { After = function(_, fn) timers[#timers + 1] = fn end }
  _G.issecretvalue = function(value) return value == SECRET end
  _G.GetServerTime = function() return 2000 end
  _G.GetBuildInfo = function() return "9.9.9", "11111", "Test", 16001, "test-localized", "test" end
  _G.GetLocale = function() return "testLocale" end
  _G.GetCurrentRegion = function() return 7 end
  -- GetCurrentRegionName 없음 → unavailable
  _G.C_GameRules = {
    GetActiveGameMode = function() return 4 end,
    IsHardcoreActive = function() return false end,
    GetForeverExperiencePreset = function() return 1 end,
    IsStandard = function() error("stub error") end,
  }
  _G.UnitGUID = function() return "TEST-GUID" end
  _G.UnitNameUnmodified = function() return "Tester", "Surname" end
  _G.UnitLevel = function() return 20 end
  _G.UnitClass = function() return "Test Class", "TESTCLASS", 5 end
  _G.UnitRace = function() return "Test Race", "TestRace", 6 end
  _G.UnitFactionGroup = function() return SECRET, "Test Faction" end
  _G.IsInGuild = function() return true end
  _G.GetGuildInfo = function() return "Test \"Guild\"" end
  _G.C_PaperDollInfo = {
    GetInventorySlotInfo = function(name)
      local ids = { HeadSlot = 1, ChestSlot = 5, MainHandSlot = 16, RangedSlot = 18 }
      if ids[name] then return ids[name], 0, false end
      error("Invalid inventory slot")
    end,
  }
  local links = {
    [1] = "|cff0070dd|Hitem:101:0:0:0|h[Test Head]|h|r",
    [5] = "|cff1eff00|Hitem:105::::|h[Test Chest]|h|r",
    [16] = "|cffa335ee|Hitem:116:0:0:0|h[Test Weapon]|h|r",
  }
  _G.GetInventoryItemLink = function(_, slot) return links[slot] end
  _G.GetInventoryItemID = function(_, slot) return links[slot] and (100 + slot) or nil end
  _G.GetInventoryItemTexture = function(_, slot) return 9000 + slot end
  _G.GetInventoryItemQuality = function() return 2 end
  _G.ItemLocation = {
    CreateFromEquipmentSlot = function(_, slot) return { slot = slot } end,
  }
  _G.C_Item = {
    IsItemDataCached = function(location) return location.slot ~= 5 end,
    RequestLoadItemData = function(location) requestedLoads[#requestedLoads + 1] = location.slot end,
    GetCurrentItemLevel = function(location)
      if location.slot == 1 then return 25 end
      if location.slot == 16 then return 30 end
      return nil
    end,
    GetDetailedItemLevelInfo = function(link)
      if string.find(link, "item:105", 1, true) then return 21, false, 21 end
      return nil
    end,
    GetItemQuality = function(location) return location.slot == 16 and 4 or nil end,
    GetItemInventoryType = function(location) return location.slot end,
    GetItemNumSockets = function(link) return string.find(link, "item:116", 1, true) and 2 or 0 end,
    GetItemGemID = function(_, index) return index == 1 and 555 or nil end,
  }
  _G.GetAverageItemLevel = function() return 25.5, 25.25, 25.25 end
end

local ns = {}
local toc = io.open("ForeverRankCollector/ForeverRankCollector.toc"):read("*a")
for file in string.gmatch(toc, "\n([%w_]+%.lua)") do
  assert(loadfile("ForeverRankCollector/" .. file))("ForeverRankCollector", ns)
end

io.write("[collector:", scenario, "]\n")
local tocVersion = string.match(toc, "## Version: ([%w%.%-]+)")
check(ns.VERSION == tocVersion, "Core.lua 버전과 TOC 버전이 같다 (" .. tostring(tocVersion) .. ")")
check(ns.EXPORT_SCHEMA_VERSION == 1 and ns.FORMAT_VERSION == 1, "Export 형식 버전과 저장소 형식 버전은 따로 둔다")
messages = {}
SlashCmdList.FOREVERRANKCOLLECTOR("")
check(string.find(messages[1] or "", "Collector " .. ns.VERSION, 1, true) ~= nil
  and string.find(messages[1] or "", "Export 형식 1", 1, true) ~= nil, "/frc 도움말 첫 줄에 Collector 버전과 Export 형식 버전")
check(type(SlashCmdList.FOREVERRANKCOLLECTOR) == "function" and SLASH_FOREVERRANKCOLLECTOR1 == "/frc", "/frc 명령 등록")

-- JSON 인코더
local json = ns.EncodeJson({ b = ns.Array({ 1, 2.5, "a\"b\n" }), a = true, c = ns.Array({}), d = {} })
check(json == '{"a":true,"b":[1,2.5,"a\\"b\\n"],"c":[],"d":{}}', "JSON: 키 정렬, 배열, 이스케이프, 빈 배열")
check(not pcall(ns.EncodeJson, { x = 0 / 0 }), "JSON: NaN은 거부")
check(not pcall(ns.EncodeJson, { print }), "JSON: 함수는 거부")

if scenario == "stubbed" then
  check(registered.PLAYER_LEVEL_UP and registered.PLAYER_EQUIPMENT_CHANGED and registered.PLAYER_LOGOUT,
    "필요한 이벤트를 등록한다")
  check(type(ns.eventRegistration.PLAYER_GUILD_UPDATE) == "string", "등록 오류가 난 이벤트는 기록하고 나머지는 계속 등록한다")
  handler(nil, "ADDON_LOADED", "ForeverRankCollector")
  check(type(ForeverRankCollectorDB) == "table", "ADDON_LOADED에서 저장소를 준비한다")

  -- 접속 → 예약된 내보내기
  handler(nil, "PLAYER_ENTERING_WORLD", true, false)
  handler(nil, "PLAYER_EQUIPMENT_CHANGED", 1, true)
  check(#timers == 1, "여러 이벤트를 한 번의 예약으로 묶는다")
  timers[1]()
  local export = ForeverRankCollectorDB.latestExport
  check(export and export.trigger == "equipment_changed", "마지막 이벤트의 trigger로 내보낸다")
  check(export.collector.version == ns.VERSION and export.schemaVersion == ns.EXPORT_SCHEMA_VERSION,
    "export에 Collector 버전과 Export 형식 버전을 적는다")
  check(export.observedAt == 2000 and export.observedAtSource == "GetServerTime", "관측 시각은 GetServerTime")
  check(export.client.interfaceVersion == 16001 and export.client.buildNumber == "11111", "GetBuildInfo 값")
  check(export.client.regionName == nil, "없는 API의 값은 넣지 않는다")
  check(export.gameMode.activeGameMode == 4 and export.gameMode.foreverExperiencePreset == 1, "게임 모드 값")
  check(export.gameMode.isStandard == nil, "오류가 난 API의 값은 넣지 않는다")
  local c = export.character
  check(c.name == "Tester" and c.surname == "Surname" and c.guid == "TEST-GUID", "이름, 성, GUID")
  check(c.faction == nil and c.factionName == "Test Faction", "secret 값은 넣지 않는다")
  check(c.guildName == 'Test "Guild"', "길드 이름")
  check(#export.gear == 3, "아이템이 있는 슬롯만 내보낸다 (원거리 슬롯은 비어 있음)")
  local head, chest, weapon = export.gear[1], export.gear[2], export.gear[3]
  check(head.slotName == "HeadSlot" and head.itemLevel == 25 and head.itemLevelSource == "C_Item.GetCurrentItemLevel",
    "아이템 레벨 1순위: C_Item.GetCurrentItemLevel")
  check(chest.itemLevel == 21 and chest.itemLevelSource == "C_Item.GetDetailedItemLevelInfo", "아이템 레벨 2순위: 링크 기준")
  check(chest.dataCached == false and requestedLoads[1] == 5 and ns.pendingItems[105], "캐시되지 않은 아이템은 로드를 요청한다")
  check(weapon.quality == 4 and head.quality == 2, "품질: C_Item.GetItemQuality → 없으면 GetInventoryItemQuality")
  check(#weapon.gemIds == 1 and weapon.gemIds[1] == 555 and weapon.socketCount == 2, "보석 ID는 빈 소켓을 제외한다")
  check(export.clientAverageItemLevel.equipped == 25.25, "게임 제공 평균은 참고값으로 내보낸다")

  local unavailable = table.concat(export.unavailable, ",")
  check(string.find(unavailable, "client.regionName", 1, true) and string.find(unavailable, "character.faction", 1, true)
    and string.find(unavailable, "gameMode.isStandard", 1, true), "얻지 못한 항목을 unavailable에 적는다")

  -- 아이템 로드 완료 → 다시 내보내기
  handler(nil, "ITEM_DATA_LOAD_RESULT", 999, true)
  check(#timers == 1, "관련 없는 아이템 로드는 무시한다")
  handler(nil, "ITEM_DATA_LOAD_RESULT", 105, true)
  check(#timers == 2, "기다리던 아이템이 로드되면 다시 내보내기를 예약한다")
  timers[2]()

  -- 레벨 상승
  handler(nil, "PLAYER_LEVEL_UP", 21, 0, 0)
  timers[3]()
  export = ForeverRankCollectorDB.latestExport
  check(#export.levelEvents == 1 and export.levelEvents[1].level == 21 and export.levelEvents[1].observedAt == 2000,
    "레벨 상승을 시각과 함께 기록한다")
  check(export.levelEvents[1].guid == nil, "export의 레벨 기록에는 내부용 guid를 넣지 않는다")

  -- 로그아웃은 즉시 갱신
  handler(nil, "PLAYER_LOGOUT")
  check(ForeverRankCollectorDB.latestExport.trigger == "logout" and #timers == 3, "로그아웃 시 예약 없이 바로 갱신한다")

  -- 결정성
  local first = ForeverRankCollectorDB.latestExportJson
  ns.Refresh("logout")
  check(first == ForeverRankCollectorDB.latestExportJson, "같은 상태면 같은 JSON")

  messages = {}
  SlashCmdList.FOREVERRANKCOLLECTOR("status")
  check(string.find(table.concat(messages, "\n"), "장비: 3개", 1, true) ~= nil, "/frc status 요약")
else
  -- WoW API가 하나도 없는 환경
  local export = ns.Refresh("manual")
  check(export ~= nil and ForeverRankCollectorDB.latestExportJson ~= nil, "API가 없어도 내보내기가 끝까지 실행된다")
  check(next(export.character) == nil and next(export.client) == nil and next(export.gameMode) == nil,
    "API가 없으면 값을 지어내지 않는다")
  check(#export.gear == 0 and export.observedAt == nil and export.observedAtSource == "none", "장비와 시각도 비어 있다")
  check(#export.unavailable > 10, "얻지 못한 항목을 모두 적는다")
  check(string.find(ForeverRankCollectorDB.latestExportJson, '"gear":[]', 1, true) ~= nil, "빈 장비 목록은 JSON 배열")
  messages = {}
  SlashCmdList.FOREVERRANKCOLLECTOR("clear")
  check(ForeverRankCollectorDB.latestExport == nil, "/frc clear 는 내용을 지운다")
  ns.Refresh("manual")
end

if outputPath then
  local file = assert(io.open(outputPath, "w"))
  file:write(ForeverRankCollectorDB.latestExportJson)
  file:close()
end

if failures > 0 then
  io.write(failures, " failure(s)\n")
  os.exit(1)
end
io.write("all passed\n")
