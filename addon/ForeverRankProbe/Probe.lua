--[[
  Forever Rank Probe — API 검사

  원칙
  - 아래 API 이름은 다른 WoW 클라이언트에서 쓰이는 "후보"일 뿐이다.
    WoW: Forever 클라이언트에 실제로 있는지는 이 검사로 확인한다.
  - 모든 호출은 pcall로 감싸서, 한 API의 오류 때문에 검사 전체가 멈추지 않게 한다.
  - 검사 대상은 현재 로그인한 자신의 캐릭터("player")뿐이다.
  - NotifyInspect 같은 서버 요청 API는 존재 여부만 확인하고 호출하지 않는다.
  - 값이 없는 API의 결과를 임의의 값으로 채우지 않는다.

  capability 상태
  - AVAILABLE    : 함수가 있고, 호출에 성공했고, 값을 돌려줌  → [사용 가능]
  - NEEDS_CHECK  : 호출은 됐지만 값이 비었거나 일부 슬롯만 성공 → [확인 필요]
  - UNAVAILABLE  : 함수가 없거나 호출 중 오류                → [사용 불가]
  - NOT_CALLED   : 정책상 호출하지 않음 (존재 여부만 기록)     → [호출하지 않음]
  - NOT_COLLECTED: 민감 정보라 수집하지 않음                   → [수집하지 않음]
]]

local _, ns = ...

local MAX_STRING = 300
local MAX_TABLE_ENTRIES = 40
local MAX_DISCOVERY = 300

-- 공통 도구 --------------------------------------------------------------

local function pack(...)
  return { n = select("#", ...), ... }
end

-- SavedVariables에 넣을 수 있는 값으로 바꾼다. (함수, userdata, 깊은 테이블 제외)
function ns.Sanitize(value, depth)
  local valueType = type(value)
  if valueType == "string" then
    if #value > MAX_STRING then
      return string.sub(value, 1, MAX_STRING) .. "…"
    end
    return value
  elseif valueType == "number" or valueType == "boolean" or valueType == "nil" then
    return value
  elseif valueType == "table" then
    depth = depth or 0
    if depth >= 3 then
      return "<table>"
    end
    local copy, count = {}, 0
    for key, item in pairs(value) do
      local keyType = type(key)
      if keyType == "string" or keyType == "number" then
        count = count + 1
        if count > MAX_TABLE_ENTRIES then
          copy["…"] = "생략됨"
          break
        end
        copy[key] = ns.Sanitize(item, depth + 1)
      end
    end
    return copy
  end
  return "<" .. valueType .. ">"
end

local function sanitizeReturns(returns)
  local list = {}
  for i = 1, math.min(returns.n or 0, 20) do
    list[i] = ns.Sanitize(returns[i], 1)
  end
  return list
end

-- "C_Item.GetItemInfo" 같은 경로를 _G에서 찾는다. 없으면 nil.
local function resolve(path)
  local current = _G
  for part in string.gmatch(path, "[^%.]+") do
    if type(current) ~= "table" then
      return nil
    end
    local ok, nextValue = pcall(function()
      return current[part]
    end)
    if not ok then
      return nil
    end
    current = nextValue
  end
  return current
end

-- 서버 시각이 있으면 서버 시각, 없으면 time()
function ns.Now()
  local getServerTime = resolve("GetServerTime")
  if type(getServerTime) == "function" then
    local ok, value = pcall(getServerTime)
    if ok and type(value) == "number" then
      return value, "GetServerTime"
    end
  end
  local timeFn = resolve("time")
  if type(timeFn) == "function" then
    local ok, value = pcall(timeFn)
    if ok and type(value) == "number" then
      return value, "time"
    end
  end
  return nil, nil
end

-- 함수 하나를 검사한다. returns에는 반환값 전체가 들어 있다.
local function callApi(path, ...)
  local fn = resolve(path)
  if type(fn) ~= "function" then
    return { api = path, available = false, callable = false, returns = pack() }
  end
  local results = pack(pcall(fn, ...))
  if not results[1] then
    return { api = path, available = true, callable = false, error = tostring(results[2]), returns = pack() }
  end
  local returns = { n = results.n - 1 }
  for i = 2, results.n do
    returns[i - 1] = results[i]
  end
  return { api = path, available = true, callable = true, returns = returns }
end

local function hasValue(value)
  if value == nil then
    return false
  end
  if type(value) == "string" then
    return value ~= ""
  end
  if type(value) == "table" then
    return next(value) ~= nil
  end
  return true
end

local function statusOf(result, value)
  if not result.available or not result.callable then
    return "UNAVAILABLE"
  end
  if hasValue(value) then
    return "AVAILABLE"
  end
  return "NEEDS_CHECK"
end

-- 검사 실행 ---------------------------------------------------------------

local Scan = {}
Scan.__index = Scan

local function newScan()
  return setmetatable({ capabilities = {}, order = {} }, Scan)
end

function Scan:add(id, label, group, entry)
  entry.label = label
  entry.group = group
  self.capabilities[id] = entry
  self.order[#self.order + 1] = id
  return entry
end

-- 단일 호출 검사. pick(returns)로 저장할 값을 고른다. (기본값: 모든 반환값)
function Scan:probe(id, label, group, path, args, pick, note)
  local result = callApi(path, unpack(args or {}, 1, (args and args.n) or #(args or {})))
  local value
  if result.callable then
    if pick then
      local ok, picked = pcall(pick, result.returns)
      value = ok and picked or nil
    else
      value = sanitizeReturns(result.returns)
      if result.returns.n == 0 then
        value = nil
      end
    end
  end
  local entry = {
    api = path,
    available = result.available,
    callable = result.callable,
    value = ns.Sanitize(value),
    error = result.error,
    status = statusOf(result, value),
    note = note,
  }
  self:add(id, label, group, entry)
  return entry, result
end

-- 존재 여부만 확인하고 호출하지 않는 API
function Scan:existsOnly(id, label, group, path, note)
  local value = resolve(path)
  return self:add(id, label, group, {
    api = path,
    available = value ~= nil,
    callable = nil,
    value = value ~= nil and ("<" .. type(value) .. ">") or nil,
    status = "NOT_CALLED",
    note = note,
  })
end

-- 전역 상수 값 확인 (예: WOW_PROJECT_ID)
function Scan:constant(id, label, group, name, note)
  local value = resolve(name)
  local simple = type(value) == "number" or type(value) == "string" or type(value) == "boolean"
  return self:add(id, label, group, {
    api = name,
    available = value ~= nil,
    callable = nil,
    value = simple and value or (value ~= nil and ("<" .. type(value) .. ">") or nil),
    status = simple and "AVAILABLE" or (value ~= nil and "NEEDS_CHECK" or "UNAVAILABLE"),
    note = note,
  })
end

local function first(returns)
  return returns[1]
end

-- 1. 캐릭터 기본 정보 ------------------------------------------------------

local function scanCharacter(scan, character)
  local group = "character"
  local _, r

  _, r = scan:probe("unitName", "캐릭터 이름", group, "UnitName", { "player", n = 1 }, function(ret)
    return { name = ret[1], realm = ret[2] }
  end)
  if r.callable then
    character.name = r.returns[1]
    character.nameRealmPart = r.returns[2]
  end

  _, r = scan:probe("unitGuid", "캐릭터 GUID", group, "UnitGUID", { "player", n = 1 }, first,
    "캐릭터 외부 ID 후보. 형식과 고유 범위는 확인 필요")
  if r.callable then
    character.guid = r.returns[1]
  end

  _, r = scan:probe("unitLevel", "레벨", group, "UnitLevel", { "player", n = 1 }, first)
  if r.callable then
    character.level = r.returns[1]
  end

  _, r = scan:probe("unitClass", "직업 (이름 / 코드 / ID)", group, "UnitClass", { "player", n = 1 }, function(ret)
    return { localizedName = ret[1], classFile = ret[2], classId = ret[3] }
  end, "반환값 순서는 다른 WoW 클라이언트 기준. 게임 내 실행 검증 필요")
  if r.callable then
    character.className = r.returns[1]
    character.classFile = r.returns[2]
    character.classId = r.returns[3]
  end

  _, r = scan:probe("unitRace", "종족 (이름 / 코드 / ID)", group, "UnitRace", { "player", n = 1 }, function(ret)
    return { localizedName = ret[1], raceFile = ret[2], raceId = ret[3] }
  end, "반환값 순서는 다른 WoW 클라이언트 기준. 게임 내 실행 검증 필요")
  if r.callable then
    character.raceName = r.returns[1]
    character.raceFile = r.returns[2]
    character.raceId = r.returns[3]
  end

  _, r = scan:probe("unitFaction", "진영", group, "UnitFactionGroup", { "player", n = 1 }, function(ret)
    return { faction = ret[1], localizedName = ret[2] }
  end)
  if r.callable then
    character.faction = r.returns[1]
    character.factionName = r.returns[2]
  end

  _, r = scan:probe("isInGuild", "길드 가입 여부", group, "IsInGuild", nil, first)
  if r.callable then
    character.isInGuild = r.returns[1]
  end

  _, r = scan:probe("guildInfo", "길드 정보", group, "GetGuildInfo", { "player", n = 1 }, function(ret)
    return { guildName = ret[1], rankName = ret[2], rankIndex = ret[3], guildRealm = ret[4] }
  end, "길드가 없으면 값이 비어 있는 것이 정상일 수 있음. 길드 데이터가 늦게 오면 잠시 후 다시 검사")
  if r.callable then
    character.guildName = r.returns[1]
    character.guildRealm = r.returns[4]
  end

  _, r = scan:probe("realmName", "서버(realm) 이름", group, "GetRealmName", nil, first)
  if r.callable then
    character.realm = r.returns[1]
  end

  _, r = scan:probe("normalizedRealm", "서버(realm) 정규화 이름", group, "GetNormalizedRealmName", nil, first)
  if r.callable then
    character.normalizedRealm = r.returns[1]
  end

  _, r = scan:probe("region", "지역(region) 번호", group, "GetCurrentRegion", nil, first,
    "번호와 실제 지역의 대응은 확인 필요")
  if r.callable then
    character.regionId = r.returns[1]
  end

  _, r = scan:probe("regionName", "지역(region) 이름", group, "GetCurrentRegionName", nil, first)
  if r.callable then
    character.regionName = r.returns[1]
  end

  _, r = scan:probe("locale", "클라이언트 언어", group, "GetLocale", nil, first)
  if r.callable then
    character.locale = r.returns[1]
  end

  -- 게임 모드 후보: 아래 API가 WoW: Forever의 "게임 모드"를 뜻하는지는 확인되지 않았다.
  scan:constant("projectId", "프로젝트 ID (WOW_PROJECT_ID)", "gameMode", "WOW_PROJECT_ID",
    "게임 모드 판별에 쓸 수 있는지 확인 필요")
  _, r = scan:probe("hardcore", "하드코어 규칙 여부", "gameMode", "C_GameRules.IsHardcoreActive", nil, first,
    "다른 Classic 클라이언트의 API. WoW: Forever에서의 의미는 확인 필요")
  if r.callable then
    character.hardcoreActive = r.returns[1]
  end
  _, r = scan:probe("hasSeason", "시즌 서버 여부", "gameMode", "C_Seasons.HasActiveSeason", nil, first,
    "다른 Classic 클라이언트의 API. WoW: Forever에서의 의미는 확인 필요")
  if r.callable then
    character.hasActiveSeason = r.returns[1]
  end
  _, r = scan:probe("activeSeason", "시즌 번호", "gameMode", "C_Seasons.GetActiveSeason", nil, first)
  if r.callable then
    character.activeSeason = r.returns[1]
  end
end

-- 2. 클라이언트 빌드 --------------------------------------------------------

local function scanBuild(scan, result)
  local _, r = scan:probe("buildInfo", "클라이언트 빌드 / interface 버전", "client", "GetBuildInfo", nil, function(ret)
    return { version = ret[1], build = ret[2], date = ret[3], interfaceVersion = ret[4] }
  end, "4번째 반환값이 interface 버전이라는 것은 다른 WoW 클라이언트 기준. 게임 내 실행 검증 필요")
  if r.callable then
    result.clientBuild = { version = r.returns[1], build = r.returns[2], date = r.returns[3] }
    result.interfaceVersion = r.returns[4]
  end
  scan:probe("serverTime", "서버 시각", "client", "GetServerTime", nil, first)
end

-- 3. 장비 -----------------------------------------------------------------

-- 다른 WoW 클라이언트에서 쓰이는 장비 슬롯 이름 "후보". 실제로 있는지는 GetInventorySlotInfo로 확인한다.
local SLOT_NAME_CANDIDATES = {
  "HeadSlot", "NeckSlot", "ShoulderSlot", "BackSlot", "ChestSlot", "ShirtSlot", "TabardSlot",
  "WristSlot", "HandsSlot", "WaistSlot", "LegsSlot", "FeetSlot", "Finger0Slot", "Finger1Slot",
  "Trinket0Slot", "Trinket1Slot", "MainHandSlot", "SecondaryHandSlot", "RangedSlot", "AmmoSlot",
  "RelicSlot",
}

-- 이름으로 찾지 못한 슬롯도 발견하기 위해 번호를 직접 훑는다.
local NUMERIC_SLOT_RANGE = 30

-- 아이템 링크에서 "item:..." 부분을 꺼내 ':'로 나눈다. 빈 필드도 유지한다.
local function parseItemString(link)
  if type(link) ~= "string" then
    return nil
  end
  local itemString = string.match(link, "item:[^|]+")
  if not itemString then
    return nil
  end
  local fields = {}
  local position = 1
  while true do
    local separator = string.find(itemString, ":", position, true)
    if not separator then
      fields[#fields + 1] = string.sub(itemString, position)
      break
    end
    fields[#fields + 1] = string.sub(itemString, position, separator - 1)
    position = separator + 1
  end
  return itemString, fields
end

-- 여러 슬롯에 대해 같은 API를 호출한 결과를 하나의 capability로 합친다.
local function aggregate(scan, id, label, path, calls, valueOf, note)
  local available = type(resolve(path)) == "function"
  local successes, withValue, firstError = 0, 0, nil
  local sample
  for _, call in ipairs(calls) do
    if call.callable then
      successes = successes + 1
      local value = valueOf(call)
      if hasValue(value) then
        withValue = withValue + 1
        if sample == nil then
          sample = value
        end
      end
    elseif call.error and not firstError then
      firstError = call.error
    end
  end
  local status
  if not available or (successes == 0 and #calls > 0) then
    status = "UNAVAILABLE"
  elseif #calls == 0 then
    status = "NEEDS_CHECK"
  elseif withValue == #calls then
    status = "AVAILABLE"
  else
    status = "NEEDS_CHECK"
  end
  -- callable: 호출해 본 슬롯이 없으면 nil(검사 못 함), 있으면 한 번이라도 성공했는지
  local callable
  if not available then
    callable = false
  elseif #calls > 0 then
    callable = successes > 0
  end
  return scan:add(id, label, "equipment", {
    api = path,
    available = available,
    callable = callable,
    value = ns.Sanitize({ checkedSlots = #calls, slotsWithValue = withValue, sample = sample }),
    error = firstError,
    status = status,
    note = note,
  })
end

local function scanEquipment(scan, result)
  local slots = {}
  local slotById = {}

  -- 3-1. 슬롯 이름 → 번호
  local namedCalls = {}
  for _, slotName in ipairs(SLOT_NAME_CANDIDATES) do
    local call = callApi("GetInventorySlotInfo", slotName)
    namedCalls[#namedCalls + 1] = call
    if call.callable and type(call.returns[1]) == "number" then
      local slotId = call.returns[1]
      local slot = slotById[slotId] or { slotId = slotId, names = {} }
      slot.names[#slot.names + 1] = slotName
      slotById[slotId] = slot
    end
  end
  aggregate(scan, "equip.slotNames", "장비 슬롯 이름 → 번호", "GetInventorySlotInfo", namedCalls, function(call)
    return call.returns[1]
  end, "후보 슬롯 이름 중 일부만 존재하는 것이 정상일 수 있음. 실제 슬롯 목록은 equipment.slots 참고")

  -- 3-2. 번호를 직접 훑어 아이템이 있는 슬롯 찾기
  local linkCalls = {}
  for slotId = 0, NUMERIC_SLOT_RANGE do
    local call = callApi("GetInventoryItemLink", "player", slotId)
    if call.callable and type(call.returns[1]) == "string" then
      local slot = slotById[slotId] or { slotId = slotId, names = {} }
      slot.itemLink = call.returns[1]
      slotById[slotId] = slot
      linkCalls[#linkCalls + 1] = call
    elseif not call.callable then
      linkCalls[#linkCalls + 1] = call
      break
    end
  end

  -- 3-3. 아이템이 있는 슬롯별 상세 검사
  local idCalls, textureCalls, qualityCalls, infoCalls, cInfoCalls = {}, {}, {}, {}, {}
  local detailedCalls, cDetailedCalls, currentLevelCalls, gemCalls, equippedCalls = {}, {}, {}, {}, {}
  local itemLocation = resolve("ItemLocation")

  for slotId = 0, NUMERIC_SLOT_RANGE do
    local slot = slotById[slotId]
    if slot then
      slots[#slots + 1] = slot
      local link = slot.itemLink
      if link then
        local itemString, fields = parseItemString(link)
        slot.itemString = itemString
        -- 필드 의미(아이템 ID, 마법부여 ID, 보석 ID 위치)는 다른 WoW 클라이언트 기준의 추정이다.
        slot.itemStringFields = fields

        local call = callApi("GetInventoryItemID", "player", slotId)
        idCalls[#idCalls + 1] = call
        slot.itemId = call.callable and call.returns[1] or nil

        call = callApi("GetInventoryItemTexture", "player", slotId)
        textureCalls[#textureCalls + 1] = call
        slot.icon = call.callable and call.returns[1] or nil

        call = callApi("GetInventoryItemQuality", "player", slotId)
        qualityCalls[#qualityCalls + 1] = call
        slot.quality = call.callable and call.returns[1] or nil

        call = callApi("GetItemInfo", link)
        infoCalls[#infoCalls + 1] = call
        if call.callable then
          slot.getItemInfo = sanitizeReturns(call.returns)
        end

        call = callApi("C_Item.GetItemInfo", link)
        cInfoCalls[#cInfoCalls + 1] = call
        if call.callable then
          slot.cItemGetItemInfo = sanitizeReturns(call.returns)
        end

        call = callApi("GetDetailedItemLevelInfo", link)
        detailedCalls[#detailedCalls + 1] = call
        if call.callable then
          slot.detailedItemLevel = sanitizeReturns(call.returns)
        end

        call = callApi("C_Item.GetDetailedItemLevelInfo", link)
        cDetailedCalls[#cDetailedCalls + 1] = call
        if call.callable then
          slot.cItemDetailedItemLevel = sanitizeReturns(call.returns)
        end

        if type(itemLocation) == "table" and type(itemLocation.CreateFromEquipmentSlot) == "function" then
          local okLocation, location = pcall(itemLocation.CreateFromEquipmentSlot, itemLocation, slotId)
          if okLocation and location then
            call = callApi("C_Item.GetCurrentItemLevel", location)
          else
            call = { api = "C_Item.GetCurrentItemLevel", available = true, callable = false,
              error = "ItemLocation 생성 실패: " .. tostring(location), returns = pack() }
          end
        else
          call = { api = "C_Item.GetCurrentItemLevel", available = false, callable = false, returns = pack() }
        end
        currentLevelCalls[#currentLevelCalls + 1] = call
        if call.callable then
          slot.currentItemLevel = call.returns[1]
        end

        call = callApi("GetItemGem", link, 1)
        gemCalls[#gemCalls + 1] = call
        if call.callable then
          slot.firstGem = sanitizeReturns(call.returns)
        end

        if slot.itemId then
          call = callApi("IsEquippedItem", slot.itemId)
          equippedCalls[#equippedCalls + 1] = call
          slot.isEquippedItem = call.callable and call.returns[1] or nil
        end
      end
    end
  end

  local returnsAt = function(index)
    return function(call)
      return call.returns[index]
    end
  end

  aggregate(scan, "equip.itemLink", "아이템 링크", "GetInventoryItemLink", linkCalls, returnsAt(1),
    "슬롯 번호 0~" .. NUMERIC_SLOT_RANGE .. "을 훑어 아이템이 있는 슬롯만 기록")
  aggregate(scan, "equip.itemId", "아이템 ID", "GetInventoryItemID", idCalls, returnsAt(1))
  aggregate(scan, "equip.icon", "아이콘", "GetInventoryItemTexture", textureCalls, returnsAt(1))
  aggregate(scan, "equip.quality", "아이템 품질", "GetInventoryItemQuality", qualityCalls, returnsAt(1))
  aggregate(scan, "equip.itemName", "아이템 이름", "GetItemInfo", infoCalls, returnsAt(1),
    "아이템 정보가 아직 캐시되지 않으면 값이 비어 있을 수 있음. 잠시 후 다시 검사")
  aggregate(scan, "equip.itemLevel.getItemInfo", "아이템 레벨 (GetItemInfo 4번째 값)", "GetItemInfo", infoCalls,
    returnsAt(4), "4번째 반환값이 아이템 레벨이라는 것은 다른 WoW 클라이언트 기준. 게임 내 실행 검증 필요")
  aggregate(scan, "equip.itemInfo.cItem", "아이템 정보 (C_Item.GetItemInfo)", "C_Item.GetItemInfo", cInfoCalls,
    returnsAt(1))
  aggregate(scan, "equip.itemLevel.detailed", "아이템 레벨 (GetDetailedItemLevelInfo)", "GetDetailedItemLevelInfo",
    detailedCalls, returnsAt(1))
  aggregate(scan, "equip.itemLevel.cItemDetailed", "아이템 레벨 (C_Item.GetDetailedItemLevelInfo)",
    "C_Item.GetDetailedItemLevelInfo", cDetailedCalls, returnsAt(1))
  aggregate(scan, "equip.itemLevel.current", "아이템 레벨 (C_Item.GetCurrentItemLevel)", "C_Item.GetCurrentItemLevel",
    currentLevelCalls, returnsAt(1))
  aggregate(scan, "equip.gems", "보석 (GetItemGem)", "GetItemGem", gemCalls, returnsAt(1),
    "보석이 없는 장비는 값이 비어 있는 것이 정상. 아이템 링크 필드(itemStringFields)도 함께 확인")
  aggregate(scan, "equip.equipped", "장착 여부 (IsEquippedItem)", "IsEquippedItem", equippedCalls, returnsAt(1))

  -- 마법부여: 별도 API 없이 아이템 링크 필드에 들어 있다는 것은 다른 WoW 클라이언트 기준의 추정이다.
  local withEnchantField = 0
  for _, slot in ipairs(slots) do
    local fields = slot.itemStringFields
    if fields and fields[3] and fields[3] ~= "" and fields[3] ~= "0" then
      withEnchantField = withEnchantField + 1
    end
  end
  scan:add("equip.enchant", "마법부여 (아이템 링크 3번째 필드 추정)", "equipment", {
    api = "item link field",
    available = #linkCalls > 0,
    callable = nil,
    value = { slotsWithNonZeroField = withEnchantField },
    status = "NEEDS_CHECK",
    note = "링크 필드의 의미는 추정. 마법부여된 장비로 게임 내 실행 검증 필요",
  })

  scan:probe("averageItemLevel", "평균 아이템 레벨 (게임 제공 값)", "equipment", "GetAverageItemLevel", nil,
    function(ret)
      return { overall = ret[1], equipped = ret[2] }
    end, "게임이 계산한 값. 우리 랭킹은 Gear Profile로 직접 계산하므로 참고용")

  result.equipment = { slots = ns.Sanitize(slots, 0), slotNameCandidates = SLOT_NAME_CANDIDATES }
end

-- 4. 화면 / Inspect / 정책 항목 --------------------------------------------

local function scanPolicyItems(scan)
  scan:existsOnly("paperDollFrame", "캐릭터 창 (PaperDollFrame)", "ui", "PaperDollFrame",
    "존재 여부만 확인. 화면 요소를 조작하지 않음")
  scan:existsOnly("inspect.canInspect", "Inspect: CanInspect", "inspect", "CanInspect",
    "다른 플레이어 자동 검사 금지. 존재 여부만 확인")
  scan:existsOnly("inspect.notifyInspect", "Inspect: NotifyInspect", "inspect", "NotifyInspect",
    "서버에 요청을 보내는 API이므로 호출하지 않음")

  scan:add("externalServerApi", "외부 서버 API", "policy", {
    api = nil,
    available = false,
    callable = false,
    status = "UNAVAILABLE",
    note = "애드온은 외부 서버와 통신할 수 없고, 이 애드온도 통신하지 않음. 데이터는 SavedVariables 파일로만 남음",
  })
  scan:add("accountInfo", "계정 정보 (Battle.net 계정, BattleTag 등)", "policy", {
    api = nil,
    available = nil,
    callable = nil,
    status = "NOT_COLLECTED",
    note = "민감 정보라 호출하지도 저장하지도 않음. 랭킹에 필요하지 않음",
  })
  scan:add("levelUpEvent", "레벨 상승 이벤트 (PLAYER_LEVEL_UP)", "event", {
    api = "PLAYER_LEVEL_UP",
    available = ns.levelUpEventRegistration and ns.levelUpEventRegistration.ok or false,
    callable = nil,
    error = ns.levelUpEventRegistration and ns.levelUpEventRegistration.error or nil,
    value = { recordedEvents = #(ns.GetDB().levelUpEvents or {}) },
    status = (ns.levelUpEventRegistration and ns.levelUpEventRegistration.ok) and "NEEDS_CHECK" or "UNAVAILABLE",
    note = "이벤트 등록만 확인됨. 실제로 레벨이 오를 때 기록되는지는 게임 내 실행 검증 필요",
  })
end

-- 5. API 발견: 클라이언트에 실제로 있는 이름 목록 ----------------------------

local DISCOVERY_KEYWORDS = {
  "Item", "Inventory", "Equip", "Guild", "Realm", "Region", "GameRule", "Season", "Hardcore",
  "Build", "PaperDoll", "Inspect",
}

local function matchesKeyword(name)
  for _, keyword in ipairs(DISCOVERY_KEYWORDS) do
    if string.find(name, keyword, 1, true) then
      return true
    end
  end
  return false
end

local function sortedCapped(list)
  table.sort(list)
  local capped = {}
  for i = 1, math.min(#list, MAX_DISCOVERY) do
    capped[i] = list[i]
  end
  return capped, #list
end

local function scanDiscovery(result)
  local namespaces, globalFunctions, namespaceFunctions = {}, {}, {}
  local ok, err = pcall(function()
    for key, value in pairs(_G) do
      if type(key) == "string" then
        if type(value) == "table" and string.sub(key, 1, 2) == "C_" then
          namespaces[#namespaces + 1] = key
          if matchesKeyword(key) then
            for fnName, fn in pairs(value) do
              if type(fnName) == "string" and type(fn) == "function" then
                namespaceFunctions[#namespaceFunctions + 1] = key .. "." .. fnName
              end
            end
          end
        elseif type(value) == "function" and matchesKeyword(key) then
          globalFunctions[#globalFunctions + 1] = key
        end
      end
    end
  end)

  local discovery = { keywords = DISCOVERY_KEYWORDS }
  if not ok then
    discovery.error = tostring(err)
  end
  discovery.cNamespaces, discovery.cNamespaceCount = sortedCapped(namespaces)
  discovery.matchingNamespaceFunctions, discovery.matchingNamespaceFunctionCount = sortedCapped(namespaceFunctions)
  discovery.matchingGlobalFunctions, discovery.matchingGlobalFunctionCount = sortedCapped(globalFunctions)

  -- 클라이언트 내장 API 문서(APIDocumentation)가 로드되어 있으면 시스템 이름만 기록한다.
  local apiDocumentation = resolve("APIDocumentation")
  if type(apiDocumentation) == "table" then
    local okDoc, systems = pcall(function()
      local names = {}
      if type(apiDocumentation.systems) == "table" then
        for _, system in ipairs(apiDocumentation.systems) do
          if type(system) == "table" then
            names[#names + 1] = tostring(system.Name or system.Namespace or "?")
          end
        end
      end
      return names
    end)
    if okDoc then
      discovery.apiDocumentationSystems, discovery.apiDocumentationSystemCount = sortedCapped(systems)
    else
      discovery.apiDocumentationError = tostring(systems)
    end
  else
    discovery.apiDocumentationLoaded = false
  end

  result.discovery = discovery
end

-- 실행 / 보고 ---------------------------------------------------------------

function ns.RunScan()
  ns.Print("검사 시작")
  local scan = newScan()
  local timestamp, timestampSource = ns.Now()
  local result = {
    timestamp = timestamp,
    timestampSource = timestampSource,
    character = {},
  }

  local steps = {
    { "캐릭터", function() scanCharacter(scan, result.character) end },
    { "클라이언트", function() scanBuild(scan, result) end },
    { "장비", function() scanEquipment(scan, result) end },
    { "정책 항목", function() scanPolicyItems(scan) end },
    { "API 목록", function() scanDiscovery(result) end },
  }
  for _, step in ipairs(steps) do
    local ok, err = pcall(step[2])
    if not ok then
      ns.Print(step[1] .. " 검사 중 오류가 발생했습니다: " .. tostring(err))
      scan:add("scanError." .. step[1], step[1] .. " 검사 오류", "probe", {
        available = false, callable = false, error = tostring(err), status = "UNAVAILABLE",
      })
    end
  end

  result.character = ns.Sanitize(result.character)
  result.capabilities = scan.capabilities
  result.capabilityOrder = scan.order
  ns.SaveScan(result)
  ns.GetDB().capabilityOrder = scan.order

  ns.Print("검사 완료. 결과는 /frp report로 확인하세요.")
  ns.Print("결과는 게임을 종료하거나 /reload 할 때 SavedVariables 파일에 저장됩니다.")
end

local STATUS_SECTIONS = {
  { "AVAILABLE", "[사용 가능]" },
  { "NEEDS_CHECK", "[확인 필요]" },
  { "UNAVAILABLE", "[사용 불가]" },
  { "NOT_CALLED", "[호출하지 않음]" },
  { "NOT_COLLECTED", "[수집하지 않음]" },
}

local function describe(value)
  if value == nil then
    return "-"
  end
  return tostring(value)
end

function ns.PrintReport()
  local db = ns.GetDB()
  if type(db.capabilities) ~= "table" or next(db.capabilities) == nil then
    ns.Print("저장된 검사 결과가 없습니다. 먼저 /frp scan을 입력하세요.")
    return
  end

  ns.Print("검사 결과 요약")
  local dateFn = resolve("date")
  if db.timestamp and type(dateFn) == "function" then
    local ok, text = pcall(dateFn, "%Y-%m-%d %H:%M", db.timestamp)
    if ok then
      ns.PrintRaw("검사 시각: " .. text .. " (" .. describe(db.timestampSource) .. ")")
    end
  end
  local build = db.clientBuild or {}
  ns.PrintRaw("클라이언트: " .. describe(build.version) .. " / 빌드 " .. describe(build.build)
    .. " / interface " .. describe(db.interfaceVersion))

  local order = db.capabilityOrder or {}
  for _, section in ipairs(STATUS_SECTIONS) do
    local lines = {}
    for _, id in ipairs(order) do
      local cap = db.capabilities[id]
      if cap and cap.status == section[1] then
        local line = "  " .. describe(cap.label)
        if cap.api then
          line = line .. " (" .. cap.api .. ")"
        end
        if cap.error then
          line = line .. " - 오류: " .. describe(cap.error)
        end
        lines[#lines + 1] = line
      end
    end
    if #lines > 0 then
      ns.PrintRaw(section[2])
      for _, line in ipairs(lines) do
        ns.PrintRaw(line)
      end
    end
  end

  local c = db.character or {}
  ns.PrintRaw("[캐릭터]")
  ns.PrintRaw("  " .. describe(c.name) .. " · 레벨 " .. describe(c.level) .. " · " .. describe(c.className)
    .. "(" .. describe(c.classFile) .. ") · " .. describe(c.raceName) .. "(" .. describe(c.raceFile) .. ") · "
    .. describe(c.faction))
  ns.PrintRaw("  길드: " .. describe(c.guildName) .. " · 서버: " .. describe(c.realm) .. " · 지역: "
    .. describe(c.regionName or c.regionId))

  local slots = (db.equipment and db.equipment.slots) or {}
  local withItem = 0
  for _, slot in pairs(slots) do
    if type(slot) == "table" and slot.itemLink then
      withItem = withItem + 1
    end
  end
  ns.PrintRaw("[장비] 발견한 슬롯 " .. #slots .. "개, 아이템이 있는 슬롯 " .. withItem .. "개")

  local discovery = db.discovery or {}
  ns.PrintRaw("[API 목록] C_ 네임스페이스 " .. describe(discovery.cNamespaceCount) .. "개, 관련 함수 "
    .. describe((discovery.matchingNamespaceFunctionCount or 0) + (discovery.matchingGlobalFunctionCount or 0)) .. "개")
  ns.PrintRaw("모든 결과는 이 클라이언트가 돌려준 값입니다. 값의 의미는 사람이 확인해야 합니다.")
end
