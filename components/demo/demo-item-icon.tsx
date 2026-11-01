import Image from "next/image";
import type { DemoItemQuality } from "@/lib/demo/demo-items";
import { cn } from "@/lib/utils";

/**
 * 아이템 아이콘 (화면 미리보기 전용)
 *
 * - 이미지는 Blizzard 게임 아이콘을 변경 없이 저장한 로컬 파일(public/demo/items/{icon}.jpg)만 쓴다. 외부 주소를 쓰지 않는다.
 * - 테두리 색은 아이템 등급을 나타낸다. 아이템 이름은 항상 옆에 텍스트로 함께 표시하므로 이미지는 장식(alt 없음)이다.
 */
const QUALITY_BORDER: Record<DemoItemQuality, string> = {
  common: "border-quality-common/70",
  uncommon: "border-quality-uncommon/70",
  rare: "border-quality-rare/70",
  epic: "border-quality-epic/70",
};

const SIZE = { md: { frame: "size-9", px: 32 }, sm: { frame: "size-6", px: 20 } } as const;

export function DemoItemIcon({ icon, quality, size = "md" }: { icon: string; quality: DemoItemQuality; size?: "md" | "sm" }) {
  return (
    <span
      aria-hidden="true"
      data-demo-item-icon={icon}
      className={cn("relative flex shrink-0 overflow-hidden rounded-[4px] border bg-background", SIZE[size].frame, QUALITY_BORDER[quality])}
    >
      <Image src={`/demo/items/${icon}.jpg`} alt="" width={SIZE[size].px} height={SIZE[size].px} className="size-full object-cover" />
    </span>
  );
}

/** 빈 장비 칸 (아이콘 자리) */
export function DemoEmptySlot({ size = "md" }: { size?: "md" | "sm" }) {
  return <span aria-hidden="true" className={cn("flex shrink-0 rounded-[4px] border border-dashed border-border bg-background/40", SIZE[size].frame)} />;
}
