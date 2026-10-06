--[[
  Forever Rank Collector — JSON 인코더
  - 업로드용 문자열(latestExportJson)을 만든다.
  - 키를 정렬해 같은 입력이면 항상 같은 문자열이 나온다.
  - 배열은 ns.Array로 표시한 테이블만 배열로 쓴다. (빈 배열도 []로 나온다)
  - 지원하지 않는 값(함수, NaN, 무한대)은 오류로 처리한다.
]]

local _, ns = ...

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
