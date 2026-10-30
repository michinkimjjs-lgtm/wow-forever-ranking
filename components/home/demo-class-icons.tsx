import type { DemoClass, DemoRace } from "@/lib/demo/home-preview-fixture";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 홈 기능 미리보기(DEMO) 전용 직업·종족 표시
 *
 * - 직업 아이콘은 이 저장소에서 직접 그린 단순한 기호다(외부 이미지·게임 아이콘을 쓰지 않음).
 * - 직업 색상은 app/globals.css의 --color-demo-* 토큰만 쓴다. 종족 표시는 직업 색상과 섞지 않고 중립 색상으로 둔다.
 * - 아이콘만으로 구분하지 않도록 직업·종족 이름을 항상 텍스트로 함께 표시한다(아이콘은 보조).
 */

/** 직업별 색상 클래스 (Tailwind가 찾을 수 있도록 전체 이름으로 적는다) */
export const DEMO_CLASS_STYLE: Record<DemoClass, { text: string; border: string; tint: string; bar: string }> = {
  warrior: { text: "text-demo-warrior", border: "border-demo-warrior/70", tint: "bg-demo-warrior/10", bar: "bg-demo-warrior" },
  paladin: { text: "text-demo-paladin", border: "border-demo-paladin/70", tint: "bg-demo-paladin/10", bar: "bg-demo-paladin" },
  hunter: { text: "text-demo-hunter", border: "border-demo-hunter/70", tint: "bg-demo-hunter/10", bar: "bg-demo-hunter" },
  rogue: { text: "text-demo-rogue", border: "border-demo-rogue/70", tint: "bg-demo-rogue/10", bar: "bg-demo-rogue" },
  priest: { text: "text-demo-priest", border: "border-demo-priest/70", tint: "bg-demo-priest/10", bar: "bg-demo-priest" },
  shaman: { text: "text-demo-shaman", border: "border-demo-shaman/70", tint: "bg-demo-shaman/10", bar: "bg-demo-shaman" },
  mage: { text: "text-demo-mage", border: "border-demo-mage/70", tint: "bg-demo-mage/10", bar: "bg-demo-mage" },
  warlock: { text: "text-demo-warlock", border: "border-demo-warlock/70", tint: "bg-demo-warlock/10", bar: "bg-demo-warlock" },
  druid: { text: "text-demo-druid", border: "border-demo-druid/70", tint: "bg-demo-druid/10", bar: "bg-demo-druid" },
};

/** 24×24 선 기호 */
const CLASS_GLYPH: Record<DemoClass, string> = {
  // 검
  warrior: "M19 5 9 15M7 13l4 4M5 19l3-3M19 5v3M19 5h-3",
  // 십자 방패
  paladin: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6zM12 8v8M9 11h6",
  // 활과 화살
  hunter: "M6 3c8 1 13 6 15 15M6 3l15 15M4 20 15 9M15 9v3M15 9h-3",
  // 단검
  rogue: "M16 3l5 5-10 10-5-5zM6 13l-3 3M8 15l-3 3",
  // 빛
  priest: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6 7.8 7.8M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2",
  // 번개
  shaman: "M13 2 5 13h6l-1 9 9-12h-6z",
  // 별빛
  mage: "M12 3l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z",
  // 불꽃
  warlock: "M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-4 3-5 3-8 1 2 2 3 3 3 0-2 0-4 0-6z",
  // 잎
  druid: "M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8",
};

export function DemoClassIcon({ demoClass, size = "md" }: { demoClass: DemoClass; size?: "sm" | "md" }) {
  const d = getMessages().home.demo;
  const style = DEMO_CLASS_STYLE[demoClass];
  return (
    <span
      role="img"
      aria-label={t(d.classIcon, { name: d.classes[demoClass] })}
      data-demo-class={demoClass}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border",
        style.border,
        style.tint,
        style.text,
        size === "md" ? "size-9" : "size-6",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={size === "md" ? "size-5" : "size-3.5"} aria-hidden="true">
        <path d={CLASS_GLYPH[demoClass]} />
      </svg>
    </span>
  );
}

/** 종족 표시: 중립 색상의 원 안에 종족 이름 첫 글자 (이름은 옆에 텍스트로 함께 표시한다) */
export function DemoRaceMark({ demoRace }: { demoRace: DemoRace }) {
  const name = getMessages().home.demo.races[demoRace];
  return (
    <span
      aria-hidden="true"
      data-demo-race={demoRace}
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-[9px] leading-none font-semibold text-muted"
    >
      {name.slice(0, 1)}
    </span>
  );
}
