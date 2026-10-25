import type { Card, GreenlitFilm, RoundStudio, ScoreCategory, Scorecard, Studio } from '../game/types';
import { CATEGORIES, RULES, cardTotal, isSkint, maxBid, maxReelScore, slotsLeft } from '../game/engine';
import { stock } from '../lib/palette';
import { FitText, Ticket, serialFor } from './Ticket';

/* ---------------------------------------------------------------------- */
/*  Star ticket: one living star (cream stock) or one vault legend (black) */
/* ---------------------------------------------------------------------- */
export function StarTicket({
  card,
  print = false,
  className = '',
}: {
  card: Card;
  print?: boolean;
  className?: string;
}) {
  const legacy = card.deck === 'legacy';
  const num = card.id.replace(/\D/g, '');
  const serial = serialFor(card.name);
  return (
    <Ticket
      serrated
      frame={false}
      wrapClassName={className}
      className={`star ${legacy ? 'star--legacy' : 'star--talent'} ${card.oscar ? 'star--oscar' : ''} ${print ? 'pcard' : ''}`}
    >
      <div className="star__side star__side--left" aria-hidden="true">
        {serial}
      </div>
      <div className="star__body">
        <div className="star__top">
          <span>Admit one star</span>
          <span>No. {num}</span>
        </div>
        <div className="star__presents t-wide">{legacy ? 'From the vault' : card.oscar ? 'Oscar winner' : 'Now casting'}</div>
        <div className="star__name t-ticket">
          <FitText text={card.name} max={print ? 34 : 60} />
        </div>
        <div className="star__presents t-wide">{legacy ? (card.oscar ? '★ Legend · Oscar winner ★' : '★ A late, great legend ★') : card.oscar ? '★ Academy Award winner ★' : 'The talent deck'}</div>
        <div className="star__meta">
          <div>
            Deck<b>{legacy ? 'L' : 'T'}</b>
          </div>
          <div>
            Card<b>{num}</b>
          </div>
          <div>
            Fee<b>Open</b>
          </div>
        </div>
      </div>
      <div className="star__side" aria-hidden="true">
        {serial}
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/*  Studio stub: a studio's ticket in the ledger                           */
/* ---------------------------------------------------------------------- */
export function StudioStub({
  studio,
  rs,
  tokens,
  badge,
  hideMoney = false,
}: {
  studio: Studio;
  rs?: RoundStudio;
  tokens?: number;
  badge?: string;
  hideMoney?: boolean;
}) {
  const s = stock(studio.colour);
  let auto: { text: string; alarm?: boolean } | null = null;
  if (rs) {
    if (slotsLeft(rs) === 0) auto = { text: 'Full house' };
    else if (isSkint(rs)) auto = { text: 'Skint', alarm: true };
  }
  const shown = badge ? { text: badge } : auto;
  return (
    <Ticket bg={s.bg} ink={s.ink} className="stub">
      <div className="stub__head">
        <div className="stub__name t-ticket">{studio.name}</div>
        {shown && <span className={`badge ${shown.alarm ? 'badge--alarm' : ''}`}>{shown.text}</span>}
      </div>
      {rs && !hideMoney && (
        <div className="stub__money">
          <span>
            Budget
            <br />
            <span style={{ opacity: 0.75 }}>max bid ${maxBid(rs)}M</span>
          </span>
          <b>${rs.budget}M</b>
        </div>
      )}
      {rs && (
        <ol className="slots">
          {Array.from({ length: RULES.castSize }, (_, i) => {
            const c = rs.cast[i];
            return (
              <li key={i} className={c ? '' : 'empty'}>
                <span>{i + 1}</span>
                <span>
                  {c ? c.name : 'Open slot'}
                  {c?.oscar && <span className="oscar-mark">Oscar</span>}
                  {c?.deck === 'legacy' && <span className="legacy-mark">Vault</span>}
                </span>
                <span>{c ? `$${c.price}M` : ''}</span>
              </li>
            );
          })}
        </ol>
      )}
      {tokens !== undefined && <TokenRow count={tokens} />}
    </Ticket>
  );
}

export function TokenRow({ count }: { count: number }) {
  return (
    <div className="tokens" aria-label={`${count} greenlight ${count === 1 ? 'stub' : 'stubs'}`}>
      {count === 0 ? (
        <span style={{ opacity: 0.7 }}>No greenlights yet</span>
      ) : (
        <>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className="token" />
          ))}
          <span>
            {count} greenlit
          </span>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  The manila sleeve that holds the secret genre                         */
/* ---------------------------------------------------------------------- */
export function Sleeve({
  genre,
  showGenre,
  peeking,
  reel,
  commissionerName,
}: {
  genre: string;
  showGenre: boolean;
  peeking: boolean;
  reel: number;
  commissionerName: string;
}) {
  return (
    <div className={`sleeve ${peeking ? 'is-peeking' : ''}`}>
      <div className="sleeve__card">
        <div className="sleeve__card-head">
          <span>Commission no. {String(reel).padStart(2, '0')}</span>
          <span>Eyes only</span>
        </div>
        <div className={`sleeve__genre t-ticket ${showGenre ? '' : 'sleeve__genre--hidden'}`} aria-live="polite">
          {showGenre ? genre : 'Classified'}
        </div>
      </div>
      <div className="sleeve__body">
        <div className="t-wide">Studio commission</div>
        <div className="sleeve__title t-ticket">Genre classified</div>
        <div className="sleeve__lines">
          <div>
            <span>Commissioner</span>
            <strong>{commissionerName}</strong>
          </div>
          <div>
            <span>Reel</span>
            <strong>{String(reel).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>To be opened</span>
            <strong>After casting</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  A greenlit picture, printed as a full ticket                          */
/* ---------------------------------------------------------------------- */
export function FilmTicket({
  film,
  stamped = false,
  slam = false,
  compact = false,
}: {
  film: GreenlitFilm;
  stamped?: boolean;
  slam?: boolean;
  compact?: boolean;
}) {
  const s = stock(film.studioColour);
  const date = new Date(film.gameDate);
  return (
    <Ticket bg={s.bg} ink={s.ink} className={`film ${compact ? 'film--compact' : ''}`}>
      <div className="film__main">
        <div className="film__presents t-wide">{film.studioName} presents</div>
        <div className="film__title t-ticket">{film.title}</div>
        <div className="film__genre">
          <span>{film.genre}</span>
          <span>Reel {String(film.round).padStart(2, '0')}</span>
        </div>
        {film.logline && <p className="film__logline">{film.logline}</p>}
        <div className="film__cast">
          Starring{' '}
          {film.cast.map((c, i) => (
            <b key={c.name}>
              {c.name}
              {c.deck === 'legacy' ? ' ★' : ''}
              {i < film.cast.length - 1 ? ' / ' : ''}
            </b>
          ))}
        </div>
        {stamped && <div className={`stamp ${slam ? 'stamp-slam' : ''} ${compact ? 'stamp--small' : ''}`}>Greenlit</div>}
      </div>
      <div className="film__stub" aria-hidden="true">
        <div className="perf-v" />
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="vert vert--big">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
          <span className="vert">Approved by {film.commissionerName}</span>
        </div>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/*  Money stepper                                                          */
/* ---------------------------------------------------------------------- */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  small = false,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`stepper ${small ? 'stepper--small' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label={`Lower ${label}`}>
        −
      </button>
      <output aria-live="polite">${value}M</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label={`Raise ${label}`}>
        +
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Loyalty card: the Commissioner punches stamps in three categories      */
/* ---------------------------------------------------------------------- */
export function LoyaltyCard({
  studio,
  title,
  rs,
  card,
  onPunch,
}: {
  studio: Studio;
  title: string;
  rs: RoundStudio;
  card: Scorecard;
  onPunch?: (cat: ScoreCategory, value: number) => void;
}) {
  const s = stock(studio.colour);
  const spent = rs.startBudget - rs.budget;
  return (
    <Ticket className="loyalty" frame={false}>
      <div className="loyalty__band" style={{ background: s.bg, color: s.ink }}>
        <div className="loyalty__studio t-ticket">{studio.name}</div>
        <div className="loyalty__title">{title}</div>
      </div>
      <div className="loyalty__body">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="loyalty__row">
            <div className="loyalty__label">
              <strong className="t-ticket">{cat.label}</strong>
              <small>
                {cat.key === 'budget'
                  ? `Spent $${spent}M of $${rs.startBudget}M. $${rs.budget}M unspent.`
                  : cat.key === 'casting'
                    ? rs.cast.map((c) => c.name).join(', ')
                    : cat.hint}
              </small>
            </div>
            <div className="punches" role="group" aria-label={`${cat.label} stamps for ${studio.name}`}>
              {Array.from({ length: RULES.stampsPerCategory }, (_, i) => {
                const on = i < card[cat.key];
                return (
                  <button
                    key={i}
                    type="button"
                    className={`punch ${on ? 'is-on' : ''}`}
                    style={{ ['--tilt' as string]: `${((i * 37) % 21) - 10}deg` }}
                    aria-pressed={on}
                    aria-label={`${i + 1} of ${RULES.stampsPerCategory}`}
                    disabled={!onPunch}
                    onClick={() => onPunch?.(cat.key, card[cat.key] === i + 1 ? i : i + 1)}
                  >
                    {on ? '★' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="loyalty__total">
          <span>Total</span>
          <b>
            {cardTotal(card)}
            <small>/{maxReelScore()}</small>
          </b>
        </div>
      </div>
    </Ticket>
  );
}
