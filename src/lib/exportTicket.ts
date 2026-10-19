import type { GreenlitFilm } from '../game/types';
import { stock } from './palette';

/** The hosted preview can't save files or print; the deployed site can. */
export const IS_PREVIEW = import.meta.env.VITE_ARTIFACT === '1';
export const CAN_DOWNLOAD = !IS_PREVIEW;

/**
 * Draws a greenlit film as a PNG ticket and downloads it.
 * Done on a canvas (not a DOM screenshot) so it works offline and on phones.
 */
export async function downloadFilmTicket(film: GreenlitFilm) {
  const url = await renderFilmTicket(film);
  const a = document.createElement('a');
  a.href = url;
  a.download = `greenlit-${slug(film.title)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'picture';

export async function renderFilmTicket(film: GreenlitFilm): Promise<string> {
  const W = 1600;
  const H = 820;
  const STUB = 260;
  const R = 44;
  const s = stock(film.studioColour);

  try {
    await Promise.all([
      document.fonts.load('900 80px Archivo'),
      document.fonts.load('500 24px Jost'),
      document.fonts.load('400 24px "DM Mono"'),
    ]);
  } catch {
    /* fall back to whatever is installed */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');

  // Ticket body with bitten corners.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(W - R, 0);
  ctx.arc(W, 0, R, Math.PI, Math.PI / 2, true);
  ctx.lineTo(W, H - R);
  ctx.arc(W, H, R, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(R, H);
  ctx.arc(0, H, R, 0, -Math.PI / 2, true);
  ctx.lineTo(0, R);
  ctx.arc(0, 0, R, Math.PI / 2, 0, true);
  ctx.closePath();
  ctx.fillStyle = s.bg;
  ctx.fill();
  ctx.clip();

  // Paper grain.
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.restore();

  ctx.fillStyle = s.ink;
  ctx.strokeStyle = s.ink;

  // Inner frame and stub perforation.
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(W - STUB, 26);
  ctx.lineTo(W - STUB, H - 26);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const cx = (W - STUB) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Presents line.
  ctx.font = '500 26px Jost, sans-serif';
  spaced(ctx, `${film.studioName.toUpperCase()} PRESENTS`, cx, 108, 7);

  // Title, shrunk to fit, up to two lines.
  const title = film.title.toUpperCase();
  let size = 150;
  let lines: string[] = [];
  const maxW = W - STUB - 140;
  for (; size > 48; size -= 6) {
    ctx.font = `900 ${size}px Archivo, sans-serif`;
    lines = wrap(ctx, title, maxW);
    if (lines.length <= 2) break;
  }
  const lh = size * 0.95;
  let y = 150 + size;
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, cx, y);
    y += lh;
  }

  // Genre and reel boxes.
  y += 6;
  ctx.font = '400 26px "DM Mono", monospace';
  const tags = [film.genre.toUpperCase(), `REEL ${String(film.round).padStart(2, '0')}`];
  const widths = tags.map((t) => ctx.measureText(t).width + 30);
  let x = cx - (widths.reduce((a, b) => a + b, 0) + 16) / 2;
  tags.forEach((t, i) => {
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y - 30, widths[i], 42);
    ctx.textAlign = 'left';
    ctx.fillText(t, x + 15, y);
    x += widths[i] + 16;
  });
  ctx.textAlign = 'center';
  y += 62;

  if (film.logline) {
    ctx.font = 'italic 400 30px Jost, sans-serif';
    for (const line of wrap(ctx, film.logline, maxW).slice(0, 2)) {
      ctx.fillText(line, cx, y);
      y += 40;
    }
    y += 6;
  }

  // Cast.
  const castTop = H - 150;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, castTop);
  ctx.lineTo(W - STUB - 80, castTop);
  ctx.stroke();
  ctx.font = '400 26px "DM Mono", monospace';
  const cast = 'STARRING ' + film.cast.map((c) => c.name.toUpperCase() + (c.deck === 'legacy' ? ' ★' : '')).join(' / ');
  let cy = castTop + 46;
  for (const line of wrap(ctx, cast, maxW).slice(0, 2)) {
    ctx.fillText(line, cx, cy);
    cy += 36;
  }

  // Stub.
  ctx.save();
  ctx.translate(W - STUB / 2 - 30, H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.font = '900 70px Archivo, sans-serif';
  ctx.fillText('GREENLIT', 0, 0);
  ctx.font = '400 24px "DM Mono", monospace';
  ctx.fillText(`APPROVED BY ${film.commissionerName.toUpperCase()}`, 0, -80);
  ctx.restore();

  // Rubber stamp.
  ctx.save();
  ctx.translate(cx + 260, 250);
  ctx.rotate(-0.2);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#2C6A49';
  ctx.fillStyle = '#2C6A49';
  ctx.font = '900 64px Archivo, sans-serif';
  const sw = ctx.measureText('GREENLIT').width + 50;
  ctx.lineWidth = 6;
  ctx.strokeRect(-sw / 2, -60, sw, 84);
  ctx.lineWidth = 2;
  ctx.strokeRect(-sw / 2 + 9, -51, sw - 18, 66);
  ctx.fillText('GREENLIT', 0, 6);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let x = cx - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i];
  });
  ctx.textAlign = prev;
}
