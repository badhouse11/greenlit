import { RULES } from '../game/engine';
import { Ticket } from '../components/Ticket';

const STEPS = [
  { head: 'Secret genre', body: 'One player is the Commissioner. Only they see what film everyone is making.' },
  { head: 'Auction', body: 'Everyone else bids on movie stars from their phone. $20M, five stars, no idea why.' },
  { head: 'Reveal', body: 'The genre drops. Your action-hero cast is now making a period drama.' },
  { head: 'Trade', body: 'One deal each to swap stars, sweeten it with cash, or borrow against your next film.' },
  { head: 'Pitch', body: 'Two minutes each to sell your film to the Commissioner, out loud.' },
  { head: 'The Oscar', body: 'The Commissioner scores casting, budget and plot in secret. Then the envelope opens.' },
];

const WAYS = [
  { head: 'Everyone’s phone', body: 'One person taps Start a game and shares the code. Everyone else taps Join a game. Works anywhere, from the pub to the sofa.' },
  { head: 'Add a big screen', body: 'Optional. Open the site on a laptop or TV, tap Watch a game, type the code. The whole table sees the bidding and the big reveals.' },
  { head: 'One phone', body: 'No signal? Pass one phone round the table. Shout your bids and the Commissioner taps them in.' },
];

export function Rules({ onBack }: { onBack: () => void }) {
  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1 className="page-title t-ticket">How it works</h1>
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>

      <section className="explainer" aria-labelledby="pitch-h">
        <Ticket className="explainer__pitch">
          <h2 id="pitch-h" className="t-ticket explainer__big">
            Cast your film. Then find out what it is.
          </h2>
          <p>
            Each studio buys five movie stars at auction <em>before</em> anyone knows the genre. Then you pitch whatever film you can make with them. Best pitch wins the Oscar. Most points at the end
            of the night wins the game.
          </p>
          <div className="explainer__facts">
            <span>
              <b>3–8</b> players
            </span>
            <span>
              <b>45–90</b> minutes
            </span>
            <span>
              <b>Phones</b> only
            </span>
          </div>
        </Ticket>

        <h2 className="t-ticket explainer__h">A round in six steps</h2>
        <ol className="explainer__steps">
          {STEPS.map((step, i) => (
            <li key={step.head}>
              <span className="explainer__no t-ticket">{i + 1}</span>
              <span>
                <strong className="t-ticket">{step.head}</strong>
                <span>{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="muted">Everyone takes one turn as Commissioner, so a game is one round per player.</p>

        <h2 className="t-ticket explainer__h">Three ways to play</h2>
        <div className="explainer__ways">
          {WAYS.map((w) => (
            <Ticket key={w.head} className="explainer__way" serrated bg="#F4E7CE">
              <strong className="t-ticket">{w.head}</strong>
              <span>{w.body}</span>
            </Ticket>
          ))}
        </div>
      </section>

      <h2 className="t-ticket explainer__h" style={{ marginTop: 36 }}>
        The full rules
      </h2>
      <div className="form-sheet rules">
        <section>
          <p className="lede" style={{ color: 'inherit' }}>
            Every player runs a film studio. Each reel, one player is the Commissioner: they secretly know the genre and they choose the winning pitch. Everyone else casts five stars at auction
            without knowing what film they’re making.
          </p>
        </section>

        <section>
          <h2 className="t-ticket">A reel, start to finish</h2>
          <ol>
            <li>
              <strong>The commission.</strong> The Commissioner holds their phone to read the secret genre, then seals it. (Pass-the-phone: hand them the phone.)
            </li>
            <li>
              <strong>The casting auction.</strong> The Commissioner draws the next star. Studios bid in $1M steps from their phones (or out loud, if you’re passing one phone round). A short countdown resets with every bid; when it runs out, the star is sold.
              Nobody bites? Bin the card. Repeat until every studio has five. A few vault legends are hidden in every reel and turn up on their own, without warning.
            </li>
            <li>
              <strong>The reveal.</strong> The Commissioner opens the envelope. Groans are expected.
            </li>
            <li>
              <strong>The trading floor.</strong> Each studio may make one deal: swap stars, add cash, or promise money from its next picture. Both studios sign before it goes through. Skipping is
              fine.
            </li>
            <li>
              <strong>Pitch prep.</strong> A few prompts to get the films in shape, and the running order.
            </li>
            <li>
              <strong>The pitch.</strong> Each studio gets {RULES.pitchSeconds / 60} minutes on the clock to pitch a film in the revealed genre using all five stars. Out loud, with conviction.
            </li>
            <li>
              <strong>The scoring.</strong> In private, the Commissioner punches each studio’s loyalty card: up to {RULES.stampsPerCategory} stamps each for casting, budget and plot.
            </li>
            <li>
              <strong>The Oscar.</strong> Phone on the table, envelope open. The top card is greenlit, takes a greenlight stub and goes in the archive. Every studio banks its stamps as points.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="t-ticket">House rules</h2>
          <table>
            <tbody>
              <tr>
                <td>Budget</td>
                <td>${RULES.startingBudget}M per studio, every reel, plus or minus any IOUs.</td>
              </tr>
              <tr>
                <td>Cast</td>
                <td>Exactly {RULES.castSize} stars. A full studio can’t bid.</td>
              </tr>
              <tr>
                <td>Bids</td>
                <td>$1M minimum, in $1M steps.</td>
              </tr>
              <tr>
                <td>The reserve</td>
                <td>You must keep $1M back for every empty slot, so nobody goes bust mid-casting. The ledger shows each studio’s highest legal bid.</td>
              </tr>
              <tr>
                <td>Leftover cash</td>
                <td>Doesn’t roll over. Spend it at auction or use it to sweeten a deal.</td>
              </tr>
              <tr>
                <td>Trades</td>
                <td>One completed deal per studio per reel. Swap the same number of stars each way so everyone keeps five.</td>
              </tr>
              <tr>
                <td>IOUs</td>
                <td>
                  Borrow against your next picture, up to ${RULES.maxIouPerStudio}M owed at once. The debt comes off your budget the next time you compete (not while you’re Commissioner) and goes
                  to the other studio the next time they compete. No IOUs once you have no picture left to make.
                </td>
              </tr>
              <tr>
                <td>The Commissioner</td>
                <td>Doesn’t cast, doesn’t pitch, can’t score themselves. Breaks a tie at the top with a casting vote. Everyone gets one turn, so a game is one reel per player.</td>
              </tr>
              <tr>
                <td>Winning</td>
                <td>Most points after the final reel. Level on points? Most greenlight stubs wins. Still level? A tie-breaker pitch.</td>
              </tr>
              <tr>
                <td>The decks</td>
                <td>Both star decks are reshuffled every reel. No star appears twice in the same reel. Genres don’t repeat within a game.</td>
              </tr>
              <tr>
                <td>The vault</td>
                <td>One hidden legend per two competing studios, between one and three a reel. Where they fall in the deck is random and secret.</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="t-ticket">Mistakes happen</h2>
          <p>Playing on everyone’s phones? The host’s Room menu has Undo, and a phone that drops out rejoins with the room code. Passing one phone round? Undo is in the top bar. Either way the game saves as you go, so a flat battery won’t lose the night.</p>
        </section>
      </div>
    </main>
  );
}
