import { useState } from 'react';
import type { ReactNode } from 'react';
import { GENRES, LEGACY, TALENT } from '../game/engine';
import { StarTicket } from '../components/Cards';
import { FitText, Ticket } from '../components/Ticket';
import { IS_PREVIEW } from '../lib/exportTicket';

type Sheet = 'talent' | 'legacy' | 'genres' | 'money' | 'awards' | 'backs';

const SHEETS: { key: Sheet; label: string; note: string }[] = [
  { key: 'talent', label: 'Talent deck', note: `${TALENT.length} cards` },
  { key: 'legacy', label: 'Legacy vault', note: `${LEGACY.length} cards` },
  { key: 'genres', label: 'Genre deck', note: `${GENRES.length} cards` },
  { key: 'money', label: '$1M notes', note: '9 per sheet, print 20 per studio' },
  { key: 'awards', label: 'Greenlight stubs', note: '9 per sheet' },
  { key: 'backs', label: 'Card backs', note: 'One sheet of each deck back' },
];

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function GenreCard({ name, n }: { name: string; n: number }) {
  return (
    <Ticket className="star pcard genre-card" frame={false}>
      <div className="star__side star__side--left">GENRE {String(n).padStart(3, '0')}</div>
      <div className="star__body" style={{ justifyContent: 'center' }}>
        <div className="star__top">
          <span>Commission</span>
          <span>Eyes only</span>
        </div>
        <div className="star__presents t-wide">Your next picture is</div>
        <div className="star__name t-ticket">
          <FitText text={name} max={30} />
        </div>
        <div className="star__presents t-wide">Keep a straight face</div>
      </div>
      <div className="star__side">GENRE {String(n).padStart(3, '0')}</div>
    </Ticket>
  );
}

function MoneyCard() {
  return (
    <Ticket className="star pcard money-card" serrated frame={false}>
      <div className="star__side star__side--left">STUDIO BANK</div>
      <div className="star__body" style={{ justifyContent: 'center' }}>
        <div className="star__presents t-wide">Legal tender</div>
        <div className="star__name t-ticket">
          <span style={{ fontSize: '40pt' }}>$1M</span>
        </div>
        <div className="star__presents t-wide">One million dollars</div>
      </div>
      <div className="star__side">STUDIO BANK</div>
    </Ticket>
  );
}

function AwardCard() {
  return (
    <Ticket className="star pcard award-card" frame={false}>
      <div className="star__side star__side--left">ADMIT ONE WINNER</div>
      <div className="star__body" style={{ justifyContent: 'center' }}>
        <div className="star__presents t-wide">This picture is</div>
        <div className="star__name t-ticket">
          <span style={{ fontSize: '26pt' }}>Greenlit</span>
        </div>
        <div className="star__presents t-wide">Keep this stub</div>
      </div>
      <div className="star__side">ADMIT ONE WINNER</div>
    </Ticket>
  );
}

function Back({ kind }: { kind: 'talent' | 'legacy' | 'genre' }) {
  const look = {
    talent: { bg: '#D44720', ink: '#F4E7CE', text: 'Talent' },
    legacy: { bg: '#1D1814', ink: '#D2A94E', text: 'The Vault' },
    genre: { bg: '#C99A45', ink: '#2B2117', text: 'Classified' },
  }[kind];
  return (
    <Ticket className="star pcard star--back" bg={look.bg} ink={look.ink}>
      <div className="star__body">
        <div className="star__presents t-wide">Greenlit</div>
        <div className="star__name t-ticket">
          <span style={{ fontSize: '22pt' }}>{look.text}</span>
        </div>
      </div>
    </Ticket>
  );
}

export function PrintShop({ onBack }: { onBack: () => void }) {
  const [sheet, setSheet] = useState<Sheet>('talent');

  let cards: ReactNode[] = [];
  if (sheet === 'talent') cards = TALENT.map((c) => <StarTicket key={c.id} card={c} print />);
  if (sheet === 'legacy') cards = LEGACY.map((c) => <StarTicket key={c.id} card={c} print />);
  if (sheet === 'genres') cards = GENRES.map((g, i) => <GenreCard key={g.id} name={g.name} n={i + 1} />);
  if (sheet === 'money') cards = Array.from({ length: 9 }, (_, i) => <MoneyCard key={i} />);
  if (sheet === 'awards') cards = Array.from({ length: 9 }, (_, i) => <AwardCard key={i} />);
  if (sheet === 'backs')
    cards = (['talent', 'legacy', 'genre'] as const).flatMap((k) => Array.from({ length: 9 }, (_, i) => <Back key={`${k}${i}`} kind={k} />));

  const pages = chunk(cards, 9);

  return (
    <main className="page">
      <div className="page-head no-print">
        <div>
          <h1 className="page-title t-ticket">Print the decks</h1>
          <p className="lede">The physical prototype. Poker-size cards (63 × 88 mm), nine to an A4 sheet. Print at 100% scale with background graphics switched on.</p>
        </div>
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="print-controls no-print" role="group" aria-label="Choose a sheet">
        {SHEETS.map((s) => (
          <button key={s.key} className="chip" aria-pressed={sheet === s.key} onClick={() => setSheet(s.key)} title={s.note}>
            {s.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="muted">
          {pages.length} {pages.length === 1 ? 'sheet' : 'sheets'}
        </span>
        {IS_PREVIEW ? (
          <span className="muted">Printing works from the deployed site.</span>
        ) : (
          <button className="btn btn--small" onClick={() => window.print()}>
            Print these sheets
          </button>
        )}
      </div>

      {pages.map((page, i) => (
        <div className="sheet" key={i}>
          {page}
        </div>
      ))}
    </main>
  );
}
