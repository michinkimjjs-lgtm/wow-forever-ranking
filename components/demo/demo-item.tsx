import type React from "react";
import { DemoItemIcon } from "@/components/demo/demo-item-icon";
import { ItemTooltipTrigger } from "@/components/demo/item-tooltip-trigger";
import { ItemName } from "@/components/game-labels";
import { DEMO_ITEM_TOOLTIPS, type DemoItemEffect } from "@/lib/demo/demo-item-tooltips";
import { demoItem, type DemoItemId } from "@/lib/demo/demo-items";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 예시 아이템(아이콘 + 이름)과 마우스 오버·터치·키보드로 여는 아이템 툴팁 (화면 미리보기 전용)
 *
 * - 툴팁은 게임 툴팁 순서를 따른다: 이름 → 아이템 레벨 → 귀속 → 부위·종류 → 방어도·무기 → 능력치 → 요구 레벨 → 효과.
 * - 값은 lib/demo/demo-items.ts와 lib/demo/demo-item-tooltips.ts의 정적 값뿐이다.
 */
export function DemoItem({
  itemId,
  iconSize = "md",
  className,
  nameClassName,
}: {
  itemId: DemoItemId;
  iconSize?: "md" | "sm";
  className?: string;
  nameClassName?: string;
}) {
  const item = demoItem(itemId);
  const tt = getMessages().demo.itemTooltip;
  return (
    <ItemTooltipTrigger
      label={t(tt.triggerLabel, { name: item.name })}
      content={<DemoItemTooltipCard itemId={itemId} />}
      className={cn(iconSize === "sm" ? "gap-1.5" : "gap-2.5", className)}
    >
      <DemoItemIcon icon={item.icon} quality={item.quality} size={iconSize} />
      <span className={cn("break-keep", nameClassName)} data-demo-item-id={itemId}>
        <ItemName name={item.name} quality={item.quality} />
      </span>
    </ItemTooltipTrigger>
  );
}

/** 임의의 내용(예: 장비 칸 전체)을 눌러·올려 툴팁을 여는 영역으로 만든다 */
export function DemoItemTooltip({ itemId, className, children }: { itemId: DemoItemId; className?: string; children: React.ReactNode }) {
  const tt = getMessages().demo.itemTooltip;
  return (
    <ItemTooltipTrigger label={t(tt.triggerLabel, { name: demoItem(itemId).name })} content={<DemoItemTooltipCard itemId={itemId} />} className={className}>
      {children}
    </ItemTooltipTrigger>
  );
}

function effectSuffix(effect: DemoItemEffect): string {
  const tt = getMessages().demo.itemTooltip;
  const parts: string[] = [];
  if (effect.cooldownSeconds) {
    parts.push(
      effect.cooldownSeconds % 60 === 0
        ? t(tt.cooldownMinutes, { minutes: effect.cooldownSeconds / 60 })
        : t(tt.cooldownSeconds, { seconds: effect.cooldownSeconds }),
    );
  }
  if (effect.charges) parts.push(t(tt.charges, { charges: effect.charges }));
  return parts.join(" ");
}

export function DemoItemTooltipCard({ itemId }: { itemId: DemoItemId }) {
  const item = demoItem(itemId);
  const tip = DEMO_ITEM_TOOLTIPS[itemId];
  const tt = getMessages().demo.itemTooltip;
  return (
    <div
      data-demo-item-tooltip={itemId}
      className="flex flex-col gap-0.5 rounded-md border border-border-strong bg-background/95 px-3 py-2.5 text-[13px] leading-snug text-foreground shadow-xl backdrop-blur"
    >
      <p className="text-sm font-semibold">
        <ItemName name={item.name} quality={item.quality} />
      </p>
      <p className="text-accent">{t(tt.itemLevel, { level: item.itemLevel })}</p>
      {tip ? <p>{tt.bind[tip.bind]}</p> : null}
      {tip?.unique ? <p>{tt.unique}</p> : null}
      <p className="flex justify-between gap-4">
        <span>{item.slot}</span>
        {item.type && item.type !== item.slot ? <span>{item.type}</span> : null}
      </p>
      {tip?.weapon ? (
        <>
          <p className="flex justify-between gap-4">
            <span>{t(tt.damage, { min: tip.weapon.min, max: tip.weapon.max })}</span>
            <span>{t(tt.speed, { speed: tip.weapon.speed.toFixed(2) })}</span>
          </p>
          <p>{t(tt.dps, { dps: tip.weapon.dps.toFixed(1) })}</p>
        </>
      ) : null}
      {tip?.armor !== undefined ? <p>{t(tt.armor, { value: tip.armor })}</p> : null}
      {tip?.block !== undefined ? <p>{t(tt.block, { value: tip.block })}</p> : null}
      {tip?.stats?.map((s) => (
        <p key={s.label}>{t(tt.stat, { value: s.value, label: s.label })}</p>
      ))}
      <p>{t(tt.requiredLevel, { level: item.requiredLevel })}</p>
      {tip?.effects?.map((e, i) => (
        <p key={i} className="text-quality-uncommon">
          {tt.trigger[e.trigger]} {e.text}
          {effectSuffix(e) ? ` ${effectSuffix(e)}` : ""}
        </p>
      ))}
      <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-subtle">{tt.note}</p>
    </div>
  );
}
