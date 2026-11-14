import type { ReactNode } from 'react';
import { stock } from '../lib/palette';
import type { StampKey } from '../lib/palette';

/**
 * Studio stamps: 1970s/80s tape-and-camera emblems, printed two or three colours
 * with a worn edge. Each studio set owns one (see PALETTE in lib/palette).
 */

const INK = '#1A1F25';
const CREAM = '#FBF4E6';

/** Shared filters and clip paths. Rendered once, near the top of the app. */
export function StampDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id="gl-worn" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -22 16.4" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="s" />
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" seed="9" result="t" />
          <feDisplacementMap in="s" in2="t" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <clipPath id="gl-sun">
          <circle cx="50" cy="50" r="40" />
        </clipPath>
        <clipPath id="gl-play">
          <path d="M30 20 L82 50 L30 80 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

const holes = (xs: number[], ys: number[]) =>
  xs.flatMap((x) => ys.map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" fill={CREAM} />));

function art(key: StampKey, main: string): ReactNode {
  switch (key) {
    case 'iris':
      return (
        <>
          <circle cx="50" cy="50" r="41" fill={CREAM} />
          <polygon points="50.0,38.0 60.4,44.0 60.4,56.0 50.0,62.0 39.6,56.0 39.6,44.0" fill={INK} />
          <path d="M50.0 38.0 L89.5 60.8 M60.4 44.0 L60.4 89.7 M60.4 56.0 L20.8 78.8 M50.0 62.0 L10.5 39.2 M39.6 56.0 L39.6 10.3 M39.6 44.0 L79.2 21.2" stroke={main} strokeWidth="5" />
        </>
      );
    case 'canister':
      return (
        <>
          <rect x="44" y="31" width="50" height="38" rx="2" fill={INK} />
          {holes([49, 58, 67, 76, 85], [34, 61])}
          <rect x="12" y="22" width="34" height="56" rx="4" fill={CREAM} />
          <rect x="12" y="38" width="34" height="26" fill="#F9A204" />
          <rect x="10" y="16" width="38" height="8" rx="2" fill={INK} />
          <rect x="10" y="76" width="38" height="8" rx="2" fill={INK} />
          <rect x="22" y="84" width="14" height="6" fill={INK} />
          <path d="M18 45 L40 45 M18 51 L34 51 M18 57 L38 57" stroke={INK} strokeWidth="2.4" />
        </>
      );
    case 'horizon':
      return (
        <>
          <g clipPath="url(#gl-sun)" fill={CREAM}>
            {[
              [10, 9], [21, 8], [31, 7], [40, 6], [48, 5], [55, 4.2], [61, 3.5], [66.5, 3], [71.5, 2.5], [76, 2], [80, 1.6], [83.5, 1.3], [86.8, 1],
            ].map(([y, h]) => (
              <rect key={y} x="0" y={y} width="100" height={h} />
            ))}
          </g>
          <rect x="4" y="60" width="92" height="3" fill={INK} />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#E5331F" strokeWidth="2.5" />
        </>
      );
    case 'spools':
      return (
        <g fill="none" stroke={CREAM} strokeWidth="1.8">
          {[10, 13.2, 16.4, 22.8, 29.2].map((r) => (
            <circle key={`a${r}`} cx="34" cy="48" r={r} />
          ))}
          <circle cx="34" cy="48" r="19.6" stroke="#7CC4A0" />
          <circle cx="34" cy="48" r="26" stroke="#6FB7D9" />
          {[8, 11.2, 14.4, 17.6].map((r) => (
            <circle key={`b${r}`} cx="76" cy="56" r={r} />
          ))}
          <path d="M34 77.2 L76 73.6" />
          <circle cx="34" cy="48" r="6" fill={CREAM} stroke="none" />
          <circle cx="34" cy="48" r="4" stroke={INK} />
          <circle cx="76" cy="56" r="5" fill={CREAM} stroke="none" />
          <circle cx="76" cy="56" r="3.2" stroke={INK} strokeWidth="1.6" />
        </g>
      );
    case 'chrome':
      return (
        <>
          <circle cx="38" cy="38" r="21" fill={CREAM} />
          <circle cx="38" cy="18" r="5.5" fill={main} />
          <circle cx="62" cy="44" r="21" fill={INK} />
          <circle cx="80" cy="34" r="5.5" fill={main} />
          <circle cx="46" cy="64" r="21" fill="#FFC72C" />
          <circle cx="28" cy="74" r="5.5" fill={main} />
        </>
      );
    case 'reel':
      return (
        <>
          <circle cx="50" cy="50" r="42" fill={CREAM} />
          <path
            d="M44.0 35.2 L56.0 35.2 L69.1 19.5 A36 36 0 0 0 30.9 19.5 Z M65.8 52.2 L59.9 62.6 L66.9 81.8 A36 36 0 0 0 86.0 48.7 Z M40.1 62.6 L34.2 52.2 L14.0 48.7 A36 36 0 0 0 33.1 81.8 Z"
            fill={main}
            stroke={main}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="50" r="10" fill={INK} />
          <circle cx="67.3" cy="40" r="2.2" fill={INK} />
          <circle cx="50" cy="70" r="2.2" fill={INK} />
          <circle cx="32.7" cy="40" r="2.2" fill={INK} />
        </>
      );
    case 'zigzag':
      return (
        <g fill="none" strokeWidth="7" strokeLinejoin="miter" strokeLinecap="square">
          <polyline points="12,30 21.5,23 31,30 40.5,23 50,30 59.5,23 69,30 78.5,23 88,30" stroke={CREAM} />
          <polyline points="12,50 21.5,43 31,50 40.5,43 50,50 59.5,43 69,50 78.5,43 88,50" stroke={INK} />
          <polyline points="12,70 21.5,63 31,70 40.5,63 50,70 59.5,63 69,70 78.5,63 88,70" stroke="#7A2943" />
          <circle cx="82" cy="84" r="5" fill={CREAM} stroke="none" />
          <rect x="12" y="80" width="8" height="8" fill={INK} stroke="none" transform="rotate(45 16 84)" />
        </g>
      );
    case 'quarters':
      return (
        <>
          <path d="M14 14 L50 14 A36 36 0 0 1 14 50 Z" fill={CREAM} />
          <path d="M86 14 L86 50 A36 36 0 0 1 50 14 Z" fill={INK} />
          <path d="M14 86 L14 50 A36 36 0 0 1 50 86 Z" fill="#E5331F" />
          <path d="M86 86 L50 86 A36 36 0 0 1 86 50 Z" fill="#F9A204" />
          <circle cx="50" cy="50" r="5" fill={INK} />
        </>
      );
    case 'sprocket':
      return (
        <g transform="rotate(-18 50 50)">
          <rect x="4" y="31" width="92" height="38" rx="2" fill={INK} />
          {holes([8, 18, 28, 38, 48, 58, 68, 78, 88], [34, 61])}
          <rect x="10" y="42" width="24" height="16" fill={CREAM} />
          <rect x="38" y="42" width="24" height="16" fill="#006633" />
          <rect x="66" y="42" width="24" height="16" fill={CREAM} />
        </g>
      );
    case 'lens':
      return (
        <>
          <circle cx="50" cy="50" r="41" fill={CREAM} />
          <circle cx="50" cy="50" r="34" fill={INK} />
          <circle cx="50" cy="50" r="27" fill="none" stroke="#F9A204" strokeWidth="2.4" />
          <circle cx="50" cy="50" r="18" fill="#E5331F" />
          <circle cx="50" cy="50" r="9" fill={INK} />
          <ellipse cx="42" cy="41" rx="5" ry="2.6" transform="rotate(-40 42 41)" fill={CREAM} />
        </>
      );
    case 'clapper':
      return (
        <>
          <rect x="16" y="46" width="68" height="38" rx="3" fill={CREAM} />
          <path d="M16 58 L84 58 M16 70 L84 70 M50 58 L50 84" stroke={main} strokeWidth="2.5" />
          <g transform="rotate(-14 16 42)">
            <rect x="16" y="30" width="68" height="13" fill={CREAM} />
            <g fill={INK}>
              <polygon points="24,30 33,30 27,43 18,43" />
              <polygon points="40,30 49,30 43,43 34,43" />
              <polygon points="56,30 65,30 59,43 50,43" />
              <polygon points="72,30 81,30 75,43 66,43" />
            </g>
          </g>
          <rect x="16" y="42" width="68" height="5" fill={INK} />
          <circle cx="19" cy="44" r="3.4" fill="#F9A204" />
        </>
      );
    case 'play':
      return (
        <>
          <g clipPath="url(#gl-play)">
            {[
              [20, '#E5331F'], [26.5, '#E5331F'], [33, '#F9A204'], [39.5, '#F9A204'], [46, '#006633'], [52.5, '#006633'], [59, '#026C80'], [65.5, '#026C80'], [72, INK],
            ].map(([y, c]) => (
              <rect key={y as number} x="0" y={y as number} width="100" height="4" fill={c as string} />
            ))}
          </g>
          <rect x="14" y="20" width="8" height="60" fill={INK} />
        </>
      );
  }
}

/** A studio's stamp, drawn for its colour key. `badge` puts it on a disc of the studio's own colour. */
export function Stamp({ colour, size = 40, badge = false, className = '', label }: { colour: string; size?: number; badge?: boolean; className?: string; label?: string }) {
  const set = stock(colour);
  return (
    <svg
      className={`studio-stamp ${badge ? 'studio-stamp--badge' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {badge && <rect x="0" y="0" width="100" height="100" rx="22" fill={set.bg} stroke={INK} strokeWidth="5" />}
      <g filter="url(#gl-worn)" transform={badge ? 'translate(10 10) scale(0.8)' : undefined}>
        {art(set.stamp, set.bg)}
      </g>
    </svg>
  );
}
