/**
 * 압축하지 않는(STORE) ZIP 파일 만들기와 읽기
 *
 * - Collector 다운로드 파일(ForeverRankCollector.zip)을 외부 라이브러리 없이 만든다.
 * - 같은 파일과 같은 시각이면 항상 같은 바이트가 나온다(압축 구현 차이가 없도록 STORE 방식만 쓴다).
 *   그래서 SHA-256을 미리 계산해 사이트에 표시할 수 있다.
 * - 읽기(readStoredZip)는 테스트와 검증용이다. 이 모듈이 만든 형식(STORE, 단일 디스크)만 읽는다.
 */

export interface ZipEntryInput {
  /** ZIP 안 경로. 폴더는 "/"로 끝난다. */
  name: string;
  data: Uint8Array;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc32: number;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** "YYYY-MM-DD" → DOS 날짜/시각 (시간대 없이 그 날짜 0시) */
function dosDateTime(date: string): { time: number; date: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`ZIP 날짜 형식이 올바르지 않습니다: ${date}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1980 || year > 2107) throw new Error(`ZIP에 쓸 수 없는 연도입니다: ${year}`);
  return { time: 0, date: ((year - 1980) << 9) | (month << 5) | day };
}

const encoder = new TextEncoder();

/** STORE 방식 ZIP을 만든다. 항목 순서는 입력 순서를 따른다. */
export function createStoredZip(entries: readonly ZipEntryInput[], modifiedDate: string): Uint8Array {
  const { time, date } = dosDateTime(modifiedDate);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const names = new Set<string>();

  for (const entry of entries) {
    if (!/^[A-Za-z0-9_.\-/]+$/.test(entry.name) || entry.name.startsWith("/") || entry.name.includes("..")) {
      throw new Error(`ZIP 항목 이름이 올바르지 않습니다: ${entry.name}`);
    }
    if (names.has(entry.name)) throw new Error(`ZIP 항목 이름이 겹칩니다: ${entry.name}`);
    names.add(entry.name);
    const name = encoder.encode(entry.name);
    const isDir = entry.name.endsWith("/");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 10, true); // 필요한 버전 1.0
    local.setUint16(6, 0, true); // 플래그
    local.setUint16(8, 0, true); // STORE
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, entry.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // 만든 버전 2.0 (MS-DOS 호환 속성)
    central.setUint16(6, 10, true);
    central.setUint16(8, 0, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, name.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, isDir ? 0x10 : 0x20, true); // MS-DOS 폴더 / 보관 속성
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

/** createStoredZip이 만든 ZIP을 읽는다. 형식이 다르거나 CRC가 맞지 않으면 오류. */
export function readStoredZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = bytes.length - 22;
  if (endOffset < 0 || view.getUint32(endOffset, true) !== 0x06054b50) throw new Error("ZIP 끝 레코드를 찾지 못했습니다.");
  const count = view.getUint16(endOffset + 10, true);
  let pointer = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("ZIP 중앙 디렉터리가 올바르지 않습니다.");
    const method = view.getUint16(pointer + 10, true);
    const crc = view.getUint32(pointer + 16, true);
    const size = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    if (method !== 0) throw new Error(`STORE가 아닌 항목입니다: ${name}`);
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`로컬 헤더가 올바르지 않습니다: ${name}`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(start, start + size);
    if (crc32(data) !== crc) throw new Error(`CRC가 맞지 않습니다: ${name}`);
    entries.push({ name, data, crc32: crc });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
