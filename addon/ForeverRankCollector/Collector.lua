--[[
  Forever Rank Collector — 수집과 내보내기 (Character Export v1)

  형식: docs/CHARACTER-EXPORT-V1.md
  API 근거: docs/FOREVER-API-CAPABILITY.md (공개 자료 분석. 게임 내 실행 검증 필요)

  - 얻지 못한 값은 키를 생략하고 unavailable 목록에 경로를 적는다.
  - 값을 추정하거나 기본값으로 채우지 않는다.
]]

local _, ns = ...

local SCHEMA = "forever-rank/character-export"
local MAX_LEVEL_EVENTS = 100

-- Forever 캐릭터 창(UI 소스 Camelot PaperDollFrame.xml)에 있는 장비 슬롯 이름.
-- 슬롯 번호는 실행 중에 C_PaperDollInfo.GetInventorySlotInfo로 얻는다.
ns.SLOT_NAMES = {
  "HeadSlot", "NeckSlot", "ShoulderSlot", "BackSlot", "ChestSlot", "ShirtSlot", "TabardSlot",
  "WristSlot", "HandsSlot", "WaistSlot", "LegsSlot", "FeetSlot", "Finger0Slot", "Finger1Slot",
  "Trinket0Slot", "Trinket1Slot", "MainHandSlot", "SecondaryHandSlot", "RangedSlot", "AmmoSlot",
}

-- 수집 도구 ----------------------------------------------------------------------

local Builder = {}
Builder.__index = Builder

local function newBuilder()
  return setmetatable({ unavailable = ns.Array({}) }, Builder)
end

function Builder:missing(path)
  self.unavailable[#self.unavailable + 1] = path
end

-- target[key] = 정리된 값. 값이 없으면 unavailable에 path를 적는다.
function Builder:set(target, key, value, path, integer)
  local clean = integer and ns.CleanInteger(value) or ns.Clean(value)
  if clean == nil then
    self:missing(path)
  else
    target[key] = clean
  end
  return clean
end

-- API를 호출하고 반환값 테이블을 돌려준다. 실패하면 빈 테이블.
local function returnsOf(path, ...)
  local ok, returns = ns.Call(path, ...)
  if ok then
    return returns
  end
  return { n = 0 }
end

-- 1. 클라이언트 ------------------------------------------------------------------

local function collectClient(builder)
  local client = {}
  local build = returnsOf("GetBuildInfo")
  builder:set(client, "buildVersion", build[1], "client.buildVersion")
  builder:set(client, "buildNumber", build[2], "client.buildNumber")
  builder:set(client, "buildDate", build[3], "client.buildDate")
  builder:set(client, "interfaceVersion", build[4], "client.interfaceVersion", true)
  builder:set(client, "localizedVersion", build[5], "client.localizedVersion")
  builder:set(client, "locale", returnsOf("GetLocale")[1], "client.locale")
  builder:set(client, "regionId", returnsOf("GetCurrentRegion")[1], "client.regionId", true)
  builder:set(client, "regionName", returnsOf("GetCurrentRegionName")[1], "client.regionName")
  return client
end

-- 2. 게임 모드 -------------------------------------------------------------------

local function collectGameMode(builder)
  local gameMode = {}
  builder:set(gameMode, "activeGameMode", returnsOf("C_GameRules.GetActiveGameMode")[1], "gameMode.activeGameMode", true)
  builder:set(gameMode, "gameModeRecordId", returnsOf("C_GameRules.GetCurrentGameModeRecordID")[1],
    "gameMode.gameModeRecordId", true)
  builder:set(gameMode, "isHardcore", returnsOf("C_GameRules.IsHardcoreActive")[1], "gameMode.isHardcore")
  builder:set(gameMode, "isSelfFoundAllowed", returnsOf("C_GameRules.IsSelfFoundAllowed")[1], "gameMode.isSelfFoundAllowed")
  builder:set(gameMode, "isStandard", returnsOf("C_GameRules.IsStandard")[1], "gameMode.isStandard")
  builder:set(gameMode, "foreverExperiencePreset", returnsOf("C_GameRules.GetForeverExperiencePreset")[1],
    "gameMode.foreverExperiencePreset", true)
  return gameMode
end

-- 3. 캐릭터 ----------------------------------------------------------------------

local function collectCharacter(builder)
  local character = {}
  builder:set(character, "guid", returnsOf("UnitGUID", "player")[1], "character.guid")

  -- Forever UI 소스는 두 번째 반환값을 surname(성)으로 사용한다. 의미는 게임 내 실행 검증 필요.
  local names = returnsOf("UnitNameUnmodified", "player")
  if ns.Clean(names[1]) == nil then
    names = returnsOf("UnitName", "player")
  end
  builder:set(character, "name", names[1], "character.name")
  builder:set(character, "surname", names[2], "character.surname")

  builder:set(character, "level", returnsOf("UnitLevel", "player")[1], "character.level", true)

  local class = returnsOf("UnitClass", "player")
  builder:set(character, "className", class[1], "character.className")
  builder:set(character, "classFile", class[2], "character.classFile")
  builder:set(character, "classId", class[3], "character.classId", true)

  local race = returnsOf("UnitRace", "player")
  builder:set(character, "raceName", race[1], "character.raceName")
  builder:set(character, "raceFile", race[2], "character.raceFile")
  builder:set(character, "raceId", race[3], "character.raceId", true)

  local faction = returnsOf("UnitFactionGroup", "player")
  builder:set(character, "faction", faction[1], "character.faction")
  builder:set(character, "factionName", faction[2], "character.factionName")

  local inGuild = builder:set(character, "isInGuild", returnsOf("IsInGuild")[1], "character.isInGuild")
  if inGuild ~= false then
    builder:set(character, "guildName", returnsOf("GetGuildInfo", "player")[1], "character.guildName")
  end
  return character
end

-- 4. 장비 ------------------------------------------------------------------------

local function slotIdOf(slotName)
  local id = ns.CleanInteger(returnsOf("C_PaperDollInfo.GetInventorySlotInfo", slotName)[1])
  if id == nil then
    id = ns.CleanInteger(returnsOf("GetInventorySlotInfo", slotName)[1])
  end
  return id
end

local function equipmentLocation(slotId)
  local itemLocation = ns.Resolve("ItemLocation")
  if type(itemLocation) ~= "table" or type(itemLocation.CreateFromEquipmentSlot) ~= "function" then
    return nil
  end
  local ok, location = pcall(itemLocation.CreateFromEquipmentSlot, itemLocation, slotId)
  if ok and type(location) == "table" then
    return location
  end
  return nil
end

local function collectSlot(builder, slotName, slotId, pending)
  local path = "gear[" .. slotName .. "]"
  local link = ns.Clean(returnsOf("GetInventoryItemLink", "player", slotId)[1])
  if type(link) ~= "string" then
    return nil -- 비어 있는 슬롯
  end

  local item = { slotName = slotName, slotId = slotId, itemLink = link }
  local itemId = builder:set(item, "itemId", returnsOf("GetInventoryItemID", "player", slotId)[1], path .. ".itemId", true)
  local location = equipmentLocation(slotId)

  if location then
    local cached = ns.Clean(returnsOf("C_Item.IsItemDataCached", location)[1])
    if cached ~= nil then
      item.dataCached = cached
    end
    if cached == false then
      ns.Call("C_Item.RequestLoadItemData", location)
      if itemId then
        pending[itemId] = true
      end
    end
  end

  -- 아이템 레벨: 1순위 C_Item.GetCurrentItemLevel(ItemLocation), 2순위 C_Item.GetDetailedItemLevelInfo(링크)
  local level = location and ns.Clean(returnsOf("C_Item.GetCurrentItemLevel", location)[1]) or nil
  if type(level) == "number" then
    item.itemLevel = level
    item.itemLevelSource = "C_Item.GetCurrentItemLevel"
  else
    level = ns.Clean(returnsOf("C_Item.GetDetailedItemLevelInfo", link)[1])
    if type(level) == "number" then
      item.itemLevel = level
      item.itemLevelSource = "C_Item.GetDetailedItemLevelInfo"
    else
      builder:missing(path .. ".itemLevel")
    end
  end

  local quality = location and ns.CleanInteger(returnsOf("C_Item.GetItemQuality", location)[1]) or nil
  if quality == nil then
    quality = returnsOf("GetInventoryItemQuality", "player", slotId)[1]
  end
  builder:set(item, "quality", quality, path .. ".quality", true)
  builder:set(item, "icon", returnsOf("GetInventoryItemTexture", "player", slotId)[1], path .. ".icon", true)
  if location then
    builder:set(item, "inventoryType", returnsOf("C_Item.GetItemInventoryType", location)[1], path .. ".inventoryType", true)
  else
    builder:missing(path .. ".inventoryType")
  end

  local sockets = builder:set(item, "socketCount", returnsOf("C_Item.GetItemNumSockets", link)[1], path .. ".socketCount", true)
  if sockets then
    local gems = ns.Array({})
    for index = 1, sockets do
      local gemId = ns.CleanInteger(returnsOf("C_Item.GetItemGemID", link, index)[1])
      if gemId and gemId > 0 then
        gems[#gems + 1] = gemId
      end
    end
    item.gemIds = gems
  end

  if location == nil then
    builder:missing(path .. ".itemLocation")
  end
  return item
end

local function collectGear(builder)
  local gear = ns.Array({})
  local pending = {}
  local foundSlot = false
  for _, slotName in ipairs(ns.SLOT_NAMES) do
    local slotId = slotIdOf(slotName)
    if slotId then
      foundSlot = true
      local item = collectSlot(builder, slotName, slotId, pending)
      if item then
        gear[#gear + 1] = item
      end
    end
  end
  if not foundSlot then
    builder:missing("gear.slotId")
  end
  ns.pendingItems = pending
  return gear
end

local function collectAverageItemLevel(builder)
  local returns = returnsOf("GetAverageItemLevel")
  local average = {}
  builder:set(average, "overall", returns[1], "clientAverageItemLevel.overall")
  builder:set(average, "equipped", returns[2], "clientAverageItemLevel.equipped")
  builder:set(average, "pvp", returns[3], "clientAverageItemLevel.pvp")
  if next(average) == nil then
    return nil
  end
  return average
end

-- 5. 레벨 상승 기록 ----------------------------------------------------------------

-- PLAYER_LEVEL_UP의 첫 번째 값은 새 레벨이다(APIDocumentation 기준).
function ns.RecordLevelUp(level)
  local cleanLevel = ns.CleanInteger(level)
  if not cleanLevel then
    return
  end
  local db = ns.GetDB()
  local now = ns.Now()
  local guid = ns.Clean(returnsOf("UnitGUID", "player")[1])
  local events = db.levelEvents
  events[#events + 1] = { guid = guid, level = cleanLevel, observedAt = now, event = "PLAYER_LEVEL_UP" }
  while #events > MAX_LEVEL_EVENTS do
    table.remove(events, 1)
  end
end

local function levelEventsFor(guid)
  local list = ns.Array({})
  for _, entry in ipairs(ns.GetDB().levelEvents) do
    if entry.guid == guid then
      list[#list + 1] = { level = entry.level, observedAt = entry.observedAt, event = entry.event }
    end
  end
  return list
end

-- 내보내기 ------------------------------------------------------------------------

function ns.BuildExport(trigger)
  local builder = newBuilder()
  local observedAt, source = ns.Now()
  local export = {
    schema = SCHEMA,
    schemaVersion = 1,
    collector = { name = "ForeverRankCollector", version = ns.VERSION },
    observedAt = observedAt,
    observedAtSource = source,
    trigger = trigger,
  }
  if observedAt == nil then
    builder:missing("observedAt")
  end

  local steps = {
    { "client", collectClient },
    { "gameMode", collectGameMode },
    { "character", collectCharacter },
    { "gear", collectGear },
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

  local okAverage, average = pcall(collectAverageItemLevel, builder)
  if okAverage and average then
    export.clientAverageItemLevel = average
  end
  export.levelEvents = levelEventsFor(export.character.guid)
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
