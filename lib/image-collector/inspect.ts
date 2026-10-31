/**
 * 이미지 파일 검사: 실제 형식(파일 앞부분의 서명), 해상도, 손상 여부
 *
 * 확장자나 응답 헤더를 믿지 않고 내용으로 형식을 판단한다. 지원 형식: PNG, JPEG, WebP, GIF.
 */

export type ImageFormat = "png" | "jpeg" | "webp" | "gif";

export const IMAGE_MIME: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** 형식별로 허용하는 파일 확장자 */
export const IMAGE_EXTENSIONS: Record<ImageFormat, readonly string[]> = {
  png: ["png"],
  jpeg: ["jpg", "jpeg"],
  webp: ["webp"],
  gif: ["gif"],
};

export type InspectResult =
  | { ok: true; format: ImageFormat; mime: string; width: number; height: number; bytes: number }
  | { ok: false; reason: "UNSUPPORTED_FORMAT" | "CORRUPT" };

const startsWith = (b: Uint8Array, sig: readonly number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u24le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
const u32be = (b: Uint8Array, o: number) => ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!;

export function detectFormat(b: Uint8Array): ImageFormat | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "gif";
  return null;
}

function dimensions(format: ImageFormat, b: Uint8Array): { width: number; height: number } | null {
  switch (format) {
    case "png": {
      // 서명(8) + IHDR 길이(4) + "IHDR"(4) + 너비(4) + 높이(4), 끝에 IEND가 있어야 완전한 파일
      if (b.length < 33 || ascii(b, 12, 4) !== "IHDR") return null;
      if (ascii(b, b.length - 8, 4) !== "IEND") return null;
      return { width: u32be(b, 16), height: u32be(b, 20) };
    }
    case "jpeg": {
      // 끝 표식(EOI)이 있어야 완전한 파일
      if (!(b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9)) return null;
      let o = 2;
      while (o + 9 < b.length) {
        if (b[o] !== 0xff) return null;
        const marker = b[o + 1]!;
        const len = u16be(b, o + 2);
        // SOF0~SOF15 (DHT·JPG·DAC 제외)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: u16be(b, o + 5), width: u16be(b, o + 7) };
        }
        o += 2 + len;
      }
      return null;
    }
    case "webp": {
      // RIFF 크기와 실제 길이가 맞아야 완전한 파일
      if (b.length < 30 || u32le(b, 4) + 8 !== b.length) return null;
      const chunk = ascii(b, 12, 4);
      if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
      if (chunk === "VP8 ") return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
      if (chunk === "VP8L" && b[20] === 0x2f) {
        const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    case "gif": {
      if (b.length < 13 || b[b.length - 1] !== 0x3b) return null;
      return { width: u16le(b, 6), height: u16le(b, 8) };
    }
  }
}

function u32le(b: Uint8Array, o: number) {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

export function inspectImage(bytes: Uint8Array): InspectResult {
  const format = detectFormat(bytes);
  if (!format) return { ok: false, reason: "UNSUPPORTED_FORMAT" };
  const size = dimensions(format, bytes);
  if (!size || size.width <= 0 || size.height <= 0) return { ok: false, reason: "CORRUPT" };
  return { ok: true, format, mime: IMAGE_MIME[format], ...size, bytes: bytes.length };
}

/** 파일 이름의 확장자가 실제 형식과 맞는지 */
export function extensionMatches(fileName: string, format: ImageFormat): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS[format].includes(ext);
}
