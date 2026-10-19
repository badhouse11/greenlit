import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface TicketProps {
  children: ReactNode;
  className?: string;
  bg?: string;
  ink?: string;
  serrated?: boolean;
  frame?: boolean;
  style?: CSSProperties;
  wrapClassName?: string;
}

/** A piece of ticket stock: masked corners (or scalloped edges), grain, inner rule. */
export function Ticket({ children, className = '', bg, ink, serrated, frame = true, style, wrapClassName = '' }: TicketProps) {
  const vars = { ...(bg ? { '--tk-bg': bg } : {}), ...(ink ? { '--tk-ink': ink } : {}), ...style } as CSSProperties;
  return (
    <div className={`tkt-wrap ${wrapClassName}`}>
      <div className={`tkt ${serrated ? 'tkt--serrated' : ''} ${className}`} style={vars}>
        {frame && <div className="tkt__frame" aria-hidden="true" />}
        {children}
      </div>
    </div>
  );
}

/** Six-digit serial, stable for a given string. Printed down the sides like a roll ticket. */
export function serialFor(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(Math.abs(h) % 900000 + 100000);
}


/**
 * Shrinks its text until every word fits on the line and the block fits its box.
 * Never breaks a name mid-word.
 */
export function FitText({ text, max, min = 9, className = '' }: { text: string; max: number; min?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      let size = max;
      el.style.fontSize = `${size}px`;
      while (size > min && (el.scrollWidth > el.clientWidth + 1 || el.offsetHeight > box.clientHeight + 1)) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Refit once the real fonts arrive: they are wider than the fallbacks.
    document.fonts?.ready.then(fit).catch(() => undefined);
    document.fonts?.addEventListener?.('loadingdone', fit);
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [text, max, min]);
  return (
    <span ref={ref} className={`fit ${className}`}>
      {text}
    </span>
  );
}
