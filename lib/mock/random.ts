/**
 * 결정적 난수 생성기 (mulberry32). 같은 seed는 항상 같은 수열을 만든다.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 정수 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error("빈 목록에서 고를 수 없습니다.");
    return list[Math.floor(this.next() * list.length)]!;
  }

  /** 가중치 목록에서 하나를 고른다. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** UUID v4 형식의 결정적 ID */
  uuid(): string {
    const hex = Array.from({ length: 16 }, () => this.int(0, 255));
    hex[6] = (hex[6]! & 0x0f) | 0x40;
    hex[8] = (hex[8]! & 0x3f) | 0x80;
    const s = hex.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
}

export function createDeterministicIdGenerator(seed: number): () => string {
  const random = new SeededRandom(seed ^ 0x5eed1d);
  return () => random.uuid();
}
