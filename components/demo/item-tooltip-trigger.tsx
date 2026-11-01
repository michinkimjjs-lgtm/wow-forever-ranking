"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 아이템 툴팁 열기·닫기와 위치 (화면 미리보기 전용)
 *
 * - PC: 마우스를 올리면 열리고 떼면 닫힌다. 키보드: 초점을 받으면 열리고, 초점이 빠지거나 Esc를 누르면 닫힌다.
 * - 터치: 누르면 열리고, 다시 누르거나 바깥을 누르면 닫힌다.
 * - 표(가로 스크롤 영역) 안에서도 잘리지 않도록 화면 기준(fixed)으로 띄우고, 화면 끝에 닿으면 반대쪽으로 옮긴다.
 * - 툴팁 내용은 서버에서 만든 요소를 그대로 받는다(문구는 locales/ko에 있음).
 */
export function ItemTooltipTrigger({
  label,
  content,
  className,
  children,
}: {
  label: string;
  content: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const touchRef = useRef(false);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const r = trigger.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const gap = 8;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 기본은 오른쪽 아래. 오른쪽 공간이 없으면 왼쪽, 아래 공간이 없으면 위로.
    let left = r.right + gap;
    if (left + w > vw - margin) left = r.left - gap - w;
    if (left < margin) left = Math.min(Math.max(margin, r.left), vw - margin - w);
    let top = left >= r.right || left + w <= r.left ? r.top : r.bottom + gap;
    if (top + h > vh - margin) top = Math.max(margin, (left >= r.right || left + w <= r.left ? r.bottom : r.top - gap) - h);
    setPos({ top: Math.max(margin, top), left: Math.max(margin, left) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // 스크롤·창 크기 변경 시에는 닫지 않고 위치만 다시 잡는다(키보드 초점 이동으로 생기는 스크롤 포함)
    const reposition = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !tipRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        data-demo-item-tooltip-trigger="true"
        className={cn(
          "flex min-w-0 cursor-help items-center rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          className,
        )}
        onPointerDown={(e) => {
          touchRef.current = e.pointerType === "touch";
        }}
        onMouseEnter={() => {
          if (!touchRef.current) setOpen(true);
        }}
        onMouseLeave={() => {
          if (!touchRef.current) setOpen(false);
        }}
        onFocus={() => {
          if (!touchRef.current) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={() => {
          if (touchRef.current) setOpen((v) => !v);
        }}
      >
        {children}
      </button>
      {open ? (
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          className={cn("pointer-events-none fixed z-50 w-72 max-w-[calc(100vw-16px)]", pos ? "visible" : "invisible")}
          style={pos ?? { top: 0, left: 0 }}
        >
          {content}
        </div>
      ) : null}
    </>
  );
}
