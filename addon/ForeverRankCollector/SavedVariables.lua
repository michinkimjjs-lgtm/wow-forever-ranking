--[[
  Forever Rank Collector — 저장소 (SavedVariables)
  - 내보내기 결과는 ForeverRankCollectorDB 전역 테이블에 둔다.
  - WoW 클라이언트가 로그아웃하거나 /reload 할 때 이 테이블을 다음 파일에 저장한다.
      WTF\Account\<계정 폴더>\SavedVariables\ForeverRankCollector.lua
    실제 저장 시점과 위치는 게임 내 실행 검증 필요.
  - 저장소 형식 버전(FORMAT_VERSION)은 Export 형식 버전과 별개다. 형식이 다르면 새로 만든다.
]]

local _, ns = ...

ns.FORMAT_VERSION = 1

local function emptyDB()
  return { formatVersion = ns.FORMAT_VERSION, collectorVersion = ns.VERSION, levelEvents = {} }
end

function ns.GetDB()
  if type(ForeverRankCollectorDB) ~= "table" or ForeverRankCollectorDB.formatVersion ~= ns.FORMAT_VERSION then
    ForeverRankCollectorDB = emptyDB()
  end
  ForeverRankCollectorDB.levelEvents = ForeverRankCollectorDB.levelEvents or {}
  ForeverRankCollectorDB.collectorVersion = ns.VERSION
  return ForeverRankCollectorDB
end

function ns.ClearDB()
  ForeverRankCollectorDB = emptyDB()
end
