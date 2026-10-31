import Image from "next/image";
import type { DemoClass, DemoRace } from "@/lib/demo/home-preview-fixture";
import { DEMO_RACE_PORTRAITS, demoRacePortraitSrc, type DemoRacePortrait } from "@/lib/demo/race-portraits";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 홈 기능 미리보기(DEMO) 캐릭터 초상화
 *
 * - 얼굴은 종족(demoRace)의 초상화 이미지, 바깥 테두리 색은 직업(demoClass)으로 정한다. 두 값은 서로 독립이다.
 * - 직업 색상은 app/globals.css의 --color-demo-* 토큰만 쓴다.
 * - 초상화가 등록되지 않은 종족은 이미지 없이 빈 틀만 보여 준다(깨진 이미지·이니셜·임의 그림 없음).
 *   직업·종족 이름은 초상화 옆에 항상 텍스트로 표시한다.
 */

/** 직업별 색상 클래스 (Tailwind가 찾을 수 있도록 전체 이름으로 적는다) */
export const DEMO_CLASS_STYLE: Record<DemoClass, { text: string; border: string; glow: string; bar: string }> = {
  warrior: { text: "text-demo-warrior", border: "border-demo-warrior", glow: "shadow-[0_0_10px_-3px_var(--color-demo-warrior)]", bar: "bg-demo-warrior" },
  paladin: { text: "text-demo-paladin", border: "border-demo-paladin", glow: "shadow-[0_0_10px_-3px_var(--color-demo-paladin)]", bar: "bg-demo-paladin" },
  hunter: { text: "text-demo-hunter", border: "border-demo-hunter", glow: "shadow-[0_0_10px_-3px_var(--color-demo-hunter)]", bar: "bg-demo-hunter" },
  rogue: { text: "text-demo-rogue", border: "border-demo-rogue", glow: "shadow-[0_0_10px_-3px_var(--color-demo-rogue)]", bar: "bg-demo-rogue" },
  priest: { text: "text-demo-priest", border: "border-demo-priest", glow: "shadow-[0_0_10px_-3px_var(--color-demo-priest)]", bar: "bg-demo-priest" },
  shaman: { text: "text-demo-shaman", border: "border-demo-shaman", glow: "shadow-[0_0_10px_-3px_var(--color-demo-shaman)]", bar: "bg-demo-shaman" },
  mage: { text: "text-demo-mage", border: "border-demo-mage", glow: "shadow-[0_0_10px_-3px_var(--color-demo-mage)]", bar: "bg-demo-mage" },
  warlock: { text: "text-demo-warlock", border: "border-demo-warlock", glow: "shadow-[0_0_10px_-3px_var(--color-demo-warlock)]", bar: "bg-demo-warlock" },
  druid: { text: "text-demo-druid", border: "border-demo-druid", glow: "shadow-[0_0_10px_-3px_var(--color-demo-druid)]", bar: "bg-demo-druid" },
};

const SIZE = { md: { frame: "size-11", px: 38 }, sm: { frame: "size-6", px: 20 } } as const;

export function DemoPortrait({
  demoRace,
  demoClass,
  size = "md",
  portraits = DEMO_RACE_PORTRAITS,
}: {
  demoRace: DemoRace;
  /** 없으면(종족 분포 등) 직업 색상 대신 중립 테두리 */
  demoClass?: DemoClass;
  size?: "md" | "sm";
  portraits?: Record<DemoRace, DemoRacePortrait | null>;
}) {
  const d = getMessages().home.demo;
  const src = demoRacePortraitSrc(demoRace, portraits);
  const style = demoClass ? DEMO_CLASS_STYLE[demoClass] : null;
  const label = demoClass
    ? t(d.portrait.labelWithClass, { race: d.races[demoRace], className: d.classes[demoClass] })
    : t(d.portrait.label, { race: d.races[demoRace] });
  return (
    <span
      data-demo-portrait={demoRace}
      data-demo-portrait-class={demoClass ?? "none"}
      data-portrait-missing={src ? undefined : "true"}
      {...(src ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-md bg-background",
        SIZE[size].frame,
        style ? cn(size === "md" ? "border-[3px]" : "border-2", style.border, style.glow) : "border border-border-strong",
      )}
    >
      {src ? (
        <Image src={src} alt="" width={SIZE[size].px} height={SIZE[size].px} className="size-full object-cover" />
      ) : null}
      {/* 이미지와 테두리 사이의 어두운 안쪽 구분선 */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[3px] ring-1 ring-black/60 ring-inset" />
    </span>
  );
}
