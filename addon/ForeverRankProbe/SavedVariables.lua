--[[
  Forever Rank Probe — SavedVariables 관리

  ForeverRankProbeDB 구조 (README / docs/PHASE2-DATA-COLLECTION.md 참고)
  {
    schemaVersion   = 1,
    probeVersion    = "0.1.0",
    timestamp       = 마지막 검사 시각 (time() 값, 없으면 nil),
    timestampSource = "GetServerTime" 또는 "time",
    clientBuild     = { version, build, date },
    interfaceVersion= GetBuildInfo의 tocversion,
    character       = { ... 검사로 얻은 캐릭터 정보 ... },
    capabilities    = { [id] = { label, group, api, available, callable, value, error, status, note } },
    equipment       = { slots = { ... } },
    discovery       = { ... 클라이언트에 실제로 있는 API 이름 목록 ... },
    levelUpEvents   = { { level, time, timeSource }, ... },
  }

  계정 정보(Battle.net 계정, BattleTag, 이메일)와 비밀번호는 저장하지 않는다.
]]

local _, ns = ...

local MAX_LEVEL_UP_EVENTS = 200

local function newDB()
  return {
    schemaVersion = ns.SCHEMA_VERSION,
    probeVersion = ns.PROBE_VERSION,
    timestamp = nil,
    timestampSource = nil,
    clientBuild = nil,
    interfaceVersion = nil,
    character = {},
    capabilities = {},
    equipment = { slots = {} },
    discovery = {},
    levelUpEvents = {},
  }
end

function ns.InitDB()
  if type(ForeverRankProbeDB) ~= "table" or ForeverRankProbeDB.schemaVersion ~= ns.SCHEMA_VERSION then
    ForeverRankProbeDB = newDB()
  end
  ForeverRankProbeDB.levelUpEvents = ForeverRankProbeDB.levelUpEvents or {}
  return ForeverRankProbeDB
end

function ns.GetDB()
  if type(ForeverRankProbeDB) ~= "table" then
    return ns.InitDB()
  end
  return ForeverRankProbeDB
end

function ns.ResetDB()
  ForeverRankProbeDB = newDB()
  return ForeverRankProbeDB
end

-- 검사 결과(레벨 상승 기록은 유지)를 새 결과로 바꾼다.
function ns.SaveScan(result)
  local db = ns.GetDB()
  db.schemaVersion = ns.SCHEMA_VERSION
  db.probeVersion = ns.PROBE_VERSION
  db.timestamp = result.timestamp
  db.timestampSource = result.timestampSource
  db.clientBuild = result.clientBuild
  db.interfaceVersion = result.interfaceVersion
  db.character = result.character
  db.capabilities = result.capabilities
  db.equipment = result.equipment
  db.discovery = result.discovery
  db.levelUpEventRegistration = ns.levelUpEventRegistration
  return db
end

-- PLAYER_LEVEL_UP 이벤트가 실제로 발생하는지와 그 시각을 기록한다.
-- 첫 번째 인자가 새 레벨이라는 것은 다른 WoW 클라이언트 기준의 가정이므로, 받은 인자를 그대로 함께 저장한다.
function ns.RecordLevelUp(...)
  local db = ns.GetDB()
  local now, source = ns.Now()
  local args = {}
  for i = 1, math.min(select("#", ...), 10) do
    args[i] = ns.Sanitize((select(i, ...)), 1)
  end
  local events = db.levelUpEvents
  events[#events + 1] = { level = args[1], args = args, time = now, timeSource = source }
  while #events > MAX_LEVEL_UP_EVENTS do
    table.remove(events, 1)
  end
end
