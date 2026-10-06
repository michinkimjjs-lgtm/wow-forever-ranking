--[[
  ForeverRankProbe 오프라인 테스트 하네스 (Lua 5.1)

  게임 밖에서 애드온 파일을 TOC 순서대로 불러와 실행 흐름만 검사한다.
  - 여기의 스텁 함수와 값은 테스트용 가짜이며, 실제 WoW: Forever API의 존재나 반환값을 뜻하지 않는다.
  - 실제 API 확인은 게임 안에서 /frp scan을 실행해야만 할 수 있다.

  사용: lua5.1 tests/harness.lua bare|stubbed
]]

local scenario = arg[1] or "bare"
local failures = 0
local output = {}

local function check(condition, message)
  if condition then
    io.write("  ok   ", message, "\n")
  else
    failures = failures + 1
    io.write("  FAIL ", message, "\n")
  end
end

-- 채팅 출력을 모아 둔다.
_G.print = function(...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[#parts + 1] = tostring((select(i, ...)))
  end
  output[#output + 1] = table.concat(parts, " ")
end

local registeredEvents = {}
local eventHandler

if scenario == "stubbed" then
  -- 테스트용 가짜 클라이언트 API (일부만 존재, 일부는 오류)
  _G.CreateFrame = function()
    local frame = {}
    function frame:SetScript(_, handler) eventHandler = handler end
    function frame:RegisterEvent(name)
      if name == "UNKNOWN_EVENT_FOR_TEST" then error("unknown event") end
      registeredEvents[name] = true
    end
    return frame
  end
  _G.time = function() return 1000 end
  _G.date = function(fmt, t) return "DATE(" .. fmt .. "," .. tostring(t) .. ")" end
  _G.UnitName = function(unit) assert(unit == "player"); return "Tester", nil end
  _G.UnitGUID = function() return "Player-0000-TEST" end
  _G.UnitLevel = function() return 12 end
  _G.UnitClass = function() return "TestClassName", "TESTCLASS", 99 end
  _G.UnitRace = function() error("stub error from UnitRace") end
  _G.GetGuildInfo = function() return nil end
  _G.GetBuildInfo = function() return "0.0.0", "00000", "Jan 1 2000", 16001 end
  _G.GetInventorySlotInfo = function(name)
    if name == "HeadSlot" then return 1, "icon-head" end
    if name == "MainHandSlot" then return 16, "icon-main" end
    error("Invalid inventory slot in GetInventorySlotInfo")
  end
  _G.GetInventoryItemLink = function(_, slotId)
    if slotId == 1 then return "|cff1eff00|Hitem:111:5:0:0:0:0:0:0|h[Test Helm]|h|r" end
    if slotId == 16 then return "|cffffffff|Hitem:222::::::::|h[Test Sword]|h|r" end
    return nil
  end
  _G.GetInventoryItemID = function(_, slotId) return slotId == 1 and 111 or 222 end
  _G.GetItemInfo = function(link)
    if string.find(link, "item:111", 1, true) then
      return "Test Helm", link, 2, 15, 10, "Armor", "Cloth", 1, "INVTYPE_HEAD", "icon"
    end
    return nil -- 캐시되지 않은 상황 흉내
  end
end

-- 애드온 파일을 TOC 순서대로 불러온다.
local ns = {}
local toc = io.open("ForeverRankProbe/ForeverRankProbe.toc"):read("*a")
for file in string.gmatch(toc, "\n([%w_]+%.lua)") do
  local chunk = assert(loadfile("ForeverRankProbe/" .. file))
  chunk("ForeverRankProbe", ns)
end

io.write("[", scenario, "]\n")
check(type(SlashCmdList.FOREVERRANKPROBE) == "function", "/frp 명령이 등록된다")
check(SLASH_FOREVERRANKPROBE1 == "/frp", "슬래시 명령 이름은 /frp")

if scenario == "stubbed" then
  check(registeredEvents.ADDON_LOADED == true, "ADDON_LOADED 이벤트를 등록한다")
  eventHandler(nil, "ADDON_LOADED", "ForeverRankProbe")
  check(type(ForeverRankProbeDB) == "table", "ADDON_LOADED에서 SavedVariables를 초기화한다")
end

-- 도움말
SlashCmdList.FOREVERRANKPROBE("")
check(string.find(table.concat(output, "\n"), "/frp scan", 1, true) ~= nil, "/frp 만 입력하면 도움말을 보여 준다")

-- 검사 전 보고
output = {}
SlashCmdList.FOREVERRANKPROBE("report")
check(string.find(output[1] or "", "저장된 검사 결과가 없습니다", 1, true) ~= nil, "검사 전 /frp report 안내")

-- 검사
output = {}
SlashCmdList.FOREVERRANKPROBE("  SCAN ")
local db = ForeverRankProbeDB
check(string.find(table.concat(output, "\n"), "검사 완료", 1, true) ~= nil, "/frp scan 이 끝까지 실행된다")
check(db.probeVersion == "0.1.0" and db.schemaVersion == 1, "probeVersion / schemaVersion 저장")
check(type(db.capabilities) == "table" and next(db.capabilities) ~= nil, "capabilities 저장")
for id, cap in pairs(db.capabilities) do
  if cap.status ~= "AVAILABLE" and cap.status ~= "NEEDS_CHECK" and cap.status ~= "UNAVAILABLE"
    and cap.status ~= "NOT_CALLED" and cap.status ~= "NOT_COLLECTED" then
    check(false, "알 수 없는 상태: " .. id)
  end
end
check(db.capabilities.accountInfo.status == "NOT_COLLECTED", "계정 정보는 수집하지 않는다")
check(db.capabilities["inspect.notifyInspect"].status == "NOT_CALLED", "NotifyInspect는 호출하지 않는다")
check(db.capabilities.externalServerApi.status == "UNAVAILABLE", "외부 서버 API는 사용 불가로 표시한다")

if scenario == "bare" then
  -- WoW API가 하나도 없는 환경: 값을 지어내지 않아야 한다.
  check(db.capabilities.unitName.available == false and db.capabilities.unitName.status == "UNAVAILABLE",
    "없는 API는 available=false, 사용 불가")
  check(next(db.character) == nil, "API가 없으면 캐릭터 정보가 비어 있다 (값을 지어내지 않음)")
  check(db.timestamp == nil, "time()이 없으면 timestamp도 비어 있다")
  check(db.clientBuild == nil and db.interfaceVersion == nil, "GetBuildInfo가 없으면 빌드 정보도 비어 있다")
  check(#db.equipment.slots == 0, "장비 API가 없으면 슬롯도 없다")
  check(db.capabilities.levelUpEvent.status == "UNAVAILABLE", "이벤트 프레임이 없으면 레벨 상승 이벤트도 사용 불가")
else
  local caps = db.capabilities
  check(caps.unitName.status == "AVAILABLE" and db.character.name == "Tester", "UnitName 결과를 저장한다")
  check(caps.unitClass.value.classFile == "TESTCLASS" and db.character.classId == 99, "UnitClass 반환값 3개를 나눠 저장한다")
  check(caps.unitRace.available == true and caps.unitRace.callable == false
    and string.find(caps.unitRace.error, "stub error", 1, true) ~= nil, "오류가 난 API는 callable=false와 오류를 기록한다")
  check(caps.unitLevel.status == "AVAILABLE", "UnitRace 오류 뒤에도 다른 API 검사를 계속한다")
  check(caps.guildInfo.status == "NEEDS_CHECK", "호출은 됐지만 값이 없으면 확인 필요")
  check(caps.realmName.status == "UNAVAILABLE", "없는 API(GetRealmName)는 사용 불가")
  check(db.interfaceVersion == 16001 and db.clientBuild.build == "00000", "GetBuildInfo의 빌드 / interface 값을 저장한다")
  check(db.timestamp == 1000 and db.timestampSource == "time", "GetServerTime이 없으면 time()을 쓴다")
  check(#db.equipment.slots == 2, "이름과 번호 검사로 발견한 슬롯 2개를 저장한다")
  check(caps["equip.slotNames"].status == "NEEDS_CHECK", "일부 슬롯 이름만 있으면 확인 필요")
  check(caps["equip.itemLink"].status == "AVAILABLE", "아이템 링크 검사")
  check(caps["equip.itemLevel.getItemInfo"].status == "NEEDS_CHECK"
    and caps["equip.itemLevel.getItemInfo"].value.slotsWithValue == 1, "일부 슬롯만 아이템 레벨이 있으면 확인 필요")
  check(caps["equip.itemLevel.current"].status == "UNAVAILABLE", "C_Item.GetCurrentItemLevel이 없으면 사용 불가")
  local head = db.equipment.slots[1]
  check(head.slotId == 1 and head.itemStringFields[2] == "111" and head.itemStringFields[3] == "5",
    "아이템 링크 필드를 빈 칸까지 유지하며 나눈다")
  check(#db.equipment.slots[2].itemStringFields == 10, "빈 필드가 이어진 링크도 필드 수를 유지한다")
  check(caps["equip.enchant"].value.slotsWithNonZeroField == 1, "마법부여 추정 필드 집계")

  -- 보고
  output = {}
  SlashCmdList.FOREVERRANKPROBE("report")
  local text = table.concat(output, "\n")
  for _, header in ipairs({ "[사용 가능]", "[확인 필요]", "[사용 불가]", "[호출하지 않음]", "[수집하지 않음]", "[캐릭터]", "[장비]" }) do
    check(string.find(text, header, 1, true) ~= nil, "보고에 " .. header .. " 구역이 있다")
  end
  check(string.find(text, "오류: ", 1, true) ~= nil and string.find(text, "stub error from UnitRace", 1, true) ~= nil, "보고에 오류 내용을 함께 보여 준다")

  -- 레벨 상승 이벤트
  check(registeredEvents.PLAYER_LEVEL_UP == true, "PLAYER_LEVEL_UP 이벤트를 등록한다")
  eventHandler(nil, "PLAYER_LEVEL_UP", 13, 5, 0)
  local events = ForeverRankProbeDB.levelUpEvents
  check(#events == 1 and events[1].level == 13 and events[1].time == 1000, "레벨 상승 이벤트를 시각과 함께 기록한다")
end

-- 초기화
SlashCmdList.FOREVERRANKPROBE("reset")
check(next(ForeverRankProbeDB.capabilities) == nil and next(ForeverRankProbeDB.character) == nil, "/frp reset 은 결과를 지운다")

if failures > 0 then
  io.write(failures, " failure(s)\n")
  os.exit(1)
end
io.write("all passed\n")
