# GREENLIT

*A game of stars, money and questionable decisions.*

You've got $20 million. You need five stars. You have absolutely no idea what film you're making.

This is the digital table companion for the GREENLIT card game. One device sits on the table (laptop, tablet or phone) and handles the decks, the money, the rules and the score. The people handle the bidding, the bluffing and the pitches.

## Run it locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

## Deploy to Netlify

The repo already includes `netlify.toml`.

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Netlify reads the build settings from `netlify.toml` (`npm run build`, publishes `dist`). Deploy.

Or drag-and-drop: run `npm run build` locally and drop the `dist` folder onto app.netlify.com/drop.

## How a game runs

1. **Open the studios.** 3 to 8 studios, each with a name and a ticket colour. The game shuffles a Commissioner rota so everyone judges exactly once. One reel per player.
2. **The commission.** Pass the device to the Commissioner. They press and hold to read the secret genre, then seal it.
3. **Casting auction.** Draw the next star. Bids are shouted in the room. The Commissioner taps the winning studio, sets the fee and signs off the sale, or bins the card if nobody bites. A few vault legends are hidden at random points in every reel and surface on their own.
4. **The reveal.** The envelope opens for everyone.
5. **Trading floor.** One deal per studio: swap stars, add cash, or borrow against the next picture (IOUs). Both studios sign before it goes through.
6. **Pitch prep.** A screen of prompts (title, logline, use all five stars, own the genre, the money shot, the budget) and the running order.
7. **The pitches.** Each studio gets a 2-minute clock. Titles go on the tickets.
8. **Scoring.** In private, the Commissioner punches each studio's loyalty card: up to 5 stamps each for casting, budget and plot (15 max). A tie at the top needs the Commissioner's casting vote.
9. **The Oscar.** "Commissioner, put the phone on the table." Open the envelope, a drumroll pause, then the winner. Everyone banks their stamps as points; the winner is greenlit, takes a stub and goes in the archive.

After the final reel: final standings by points (greenlight stubs break a tie, then a tie-breaker pitch) and the night's films.

## Rules the app enforces

| Rule | Detail |
| --- | --- |
| Budget | $20M per studio per reel, adjusted by IOUs |
| Cast | Exactly 5 stars; full studios can't buy |
| Bids | $1M minimum, $1M steps |
| Reserve | A studio must keep $1M for every empty slot, so no one can go bust mid-casting |
| Leftover cash | Doesn't roll over. Spend it at auction or use it in a deal |
| Trades | One completed deal per studio per reel; equal numbers of stars each way |
| IOUs | Up to $15M owed at once. Taken off the debtor's budget the next time it competes (not while it's Commissioner) and paid to the other studio the next time *it* competes. No IOUs once a studio has no picture left |
| Commissioner | Doesn't pitch or score themselves; casting vote on a tie |
| The vault | One hidden legend per two competing studios (1–3 a reel), at secret random draws, always before casting closes |
| Scoring | 0–5 stamps each for casting, budget, plot. Every studio banks its stamps as points; most points after the final reel wins |
| Decks | Star decks reshuffle every reel; no repeats within a reel. Genres don't repeat within a game |

Every rule number lives in one place: `RULES` at the top of `src/game/engine.ts` (including `pitchSeconds` and `stampsPerCategory`), with the vault count in `legacyPerReel`.

## Editing the decks

The decks are plain JSON, so you can change them without touching the code:

- `src/data/talent.json` – 100 living stars
- `src/data/legacy.json` – 40 legends for the vault
- `src/data/genres.json` – 16 core genres plus 8 "director's cut" genres (switch them on at setup)

Add, remove or rename cards freely. Each card just needs a unique `id`.

## Undo, saving and the archive

- **Undo** in the top bar reverses the last action, including a sale, a deal or a greenlight.
- The game saves to the browser as you go. Refresh, close the tab, come back: it carries on.
- Every greenlit film goes into **The archive**, which survives between game nights on that device. Filter by genre or studio, and download any film as a ticket image.

## Print the decks

**Print the decks** (on the home screen) lays out every card at poker size (63 × 88 mm), nine to an A4 sheet: talent, legacy, genres, $1M notes, greenlight stubs and card backs. Print at 100% scale with background graphics on. This is the starting point for the physical edition.

## Under the hood

- React 19 + TypeScript + Vite. No backend: everything runs in the browser and saves to `localStorage`.
- `src/game/engine.ts` holds the whole rulebook as pure functions (`createGame`, `draw`, `sell`, `executeTrade`, `greenlight`, `nextReel`…). The UI never changes game state any other way, which is what makes Undo trivial.
- `src/game/engine.test.ts` simulates full games for 3 to 6 studios. Run with `npm test`.
- `npm run typecheck` runs the TypeScript checker.

### Type and colour

Fonts load from Google Fonts: **Archivo** (condensed heavy, the ticket titles), **Jost** (the wide-spaced Futura-style captions) and **DM Mono** (serial numbers and ledgers). If you buy a licence for Beth Mathews' *Parts List*, swap it in via `--f-mono` or `--f-wide` in `src/styles/global.css`.

The eight studio ticket stocks (Grenadine, Beeswax, Darlington, Powder Blue, Lobby Lilac, Bubblegum, Mustard, Café Latte) are in `src/lib/palette.ts`.

## Structure

```
src/
  data/            the three decks (edit me)
  game/            rules engine, types, tests
  components/      tickets, star cards, studio stubs, the manila sleeve
  screens/         home, setup, play (all game phases), archive, rules, print shop
  lib/             palette, saving, ticket image export
  styles/          global.css
```
