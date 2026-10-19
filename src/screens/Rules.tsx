import { RULES } from '../game/engine';

export function Rules({ onBack }: { onBack: () => void }) {
  return (
    <main className="page page--narrow">
      <div className="page-head">
        <h1 className="page-title t-ticket">How to play</h1>
        <button className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </div>

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
              <strong>The commission.</strong> Pass the device to the Commissioner. They hold to read the secret genre, then seal it.
            </li>
            <li>
              <strong>The casting auction.</strong> The Commissioner draws the next star. Studios bid out loud in $1M steps. The Commissioner taps the winner, sets the fee and signs it off.
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
          <p>Tap Undo in the top bar to reverse the last action: a sale, a deal, even a greenlight. The game saves as you go, so a refresh or a flat battery won’t lose the night.</p>
        </section>
      </div>
    </main>
  );
}
