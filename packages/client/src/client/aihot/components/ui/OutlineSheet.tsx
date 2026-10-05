// AIHOT cc66cceb1dc7a0bc147e942e49ff94c9cee418c6 — MIT; native adapters are recorded in SOURCE_MAP.
// An outline as a bottom sheet (phones): an article's headings, a report's pages. The section being read
// is marked, and choosing one scrolls there.
import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet.tsx";
import {useNative} from '../../native/context.tsx';

export interface OutlineEntry {
  id: string;
  text: string;
  /** 2 or less: a top-level entry, numbered in order; deeper ones are indented. */
  level: number;
  /** In place of the running number ("" for none). */
  mark?: string;
  /** On the right: how much the section holds ("5 件"). */
  note?: string;
}

/**
 * Scrolls an anchor to the top (its scroll margin keeps it clear of the bar) and puts it in the address
 * without a new history entry: back still leaves the page for the one it came from, at its position.
 */
export function scrollToAnchor(id: string, root:HTMLElement|null, scroll:HTMLElement|null) {
  const target = root?.querySelector<HTMLElement>('#'+CSS.escape(id));
  if (!target||!scroll) return;
  scroll.scrollTo({top:scroll.scrollTop+target.getBoundingClientRect().top-scroll.getBoundingClientRect().top-24,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}

export function OutlineSheet({ open, onClose, outline, title = "目录" }: { open: boolean; onClose: () => void; outline: OutlineEntry[]; title?: string }) {
  const {root,scroll}=useNative();const frame=useRef(0);
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    // The section being read: the last one whose start has reached the bar.
    const bar = (scroll?.getBoundingClientRect().top??0)+24;
    let at: string | null = null;
    for (const o of outline) {
      const el = root?.querySelector('#'+CSS.escape(o.id));
      if (el && el.getBoundingClientRect().top <= bar + 24) at = o.id;
    }
    setCurrent(at);
  }, [open, outline,root,scroll]);
  let n = 0;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ol className="px-3">
        {outline.map((o) => {
          const top = o.level <= 2;
          if (top && o.mark === undefined) n += 1;
          const mark = o.mark ?? (top ? String(n).padStart(2, "0") : "");
          const on = o.id === current;
          return (
            <li key={o.id}>
              <a
                href={`#${o.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onClose();
                  cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(() => scrollToAnchor(o.id,root,scroll));
                }}
                aria-current={on ? "location" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-tile px-2 py-2 transition-colors active:bg-bg-sunk ${on ? "bg-accent-softer text-accent" : ""} ${top ? "" : "pl-9"}`}
              >
                {top && <span className={`mono w-5 shrink-0 text-[13px] ${on ? "font-bold" : "text-ink-4"}`}>{mark}</span>}
                <span className={`min-w-0 flex-1 leading-[1.45] ${top ? "text-[15.5px]" : "text-[14px]"} ${on ? "font-semibold" : top ? "text-ink-2" : "text-ink-3"}`}>{o.text}</span>
                {on ? <span className="shrink-0 text-[11.5px] font-semibold">正在读</span> : o.note && <span className="num shrink-0 text-[12px] text-ink-4">{o.note}</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
