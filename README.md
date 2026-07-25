# Flip 7

A multiplayer web version of **Flip 7**, the press-your-luck card game by Eric Olsen
(published by The Op). Create a room, share the 4-letter code, and race to 200 —
with friends, bots, or both.

Unofficial fan project.

---

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The client dev server proxies Socket.IO traffic to
the game server on port 3001.

> If port 3001 is already in use on your machine, set `PORT` before `npm run dev`
> and update the proxy target in [client/vite.config.ts](client/vite.config.ts).

### Playing solo

Create a game, pick 1–6 bots, and hit **Start**. Bots act on a short delay so you can
watch a round unfold.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Client (Vite, :5173) and server (tsx watch, :3001) together |
| `npm run build` | Builds the client, then bundles the server to `server/dist` |
| `npm start` | Runs the production build — one server, serving everything |
| `npm test` | Vitest suite over the rules engine, deck, and bots |
| `npm run typecheck` | Typechecks the shared game code |

## Layout

```
shared/game/     Rules engine — pure TypeScript, no I/O. Used by both sides.
  cards.ts       ← DECK DATA. Edit card counts here and nowhere else.
  types.ts       Every shape that crosses the wire.
  engine.ts      The state machine: dealing, hits, action cards, scoring.
  bot.ts         Heuristic AI — odds math and targeting.
  protocol.ts    Socket.IO event contract.
server/src/      Express + Socket.IO. Rooms, the drive loop, bot scheduling.
client/src/      React + Tailwind UI.
tests/           Vitest suite.
```

### Adjusting the deck

Every count lives in [`shared/game/cards.ts`](shared/game/cards.ts). Change the numbers
to match your physical copy and bump `EXPECTED_DECK_SIZE` to match; the deck test will
tell you if the totals stop lining up.

The shipped default is the stock 94-card deck: 79 number cards (number *N* appears *N*
times, except one 0 and one 1), 3 each of Freeze / Flip Three / Second Chance, and one
each of +2, +4, +6, +8, +10, ×2.

## How the engine works

The engine never schedules anything itself. The server asks `waitingOn(state)` what the
game is blocked on:

- `null` → the engine can advance itself; call `tick(state)` (deal a card, run a forced
  draw, score a finished round).
- `{ type: 'decision', playerId }` → waiting on a Hit/Stay.
- `{ type: 'target', playerId }` → waiting on an Action card target.
- `{ type: 'round_end' | 'game_over' | 'lobby' }` → terminal for now.

`server/src/rooms.ts` loops on that, putting a delay in front of each automatic step so
the table is watchable, and asking a bot to decide when the blocked player is one.

**Flip Three is a stack**, which is what makes the nasty cases fall out for free: drawing
a Flip Three *during* a Flip Three pushes a new sequence that resolves immediately, then
control returns to the interrupted one. A bust or a Flip 7 clears the affected entries.

### Rules calls worth knowing

A few situations aren't spelled out identically across sources; here's what this
implementation does:

- **One flip per turn.** Play goes around the table one player at a time; hitting draws a
  single card and then passes play on, rather than letting a player chain flips. Forced
  Flip Three draws are the exception — those three run back to back off their own stack.
- **Nested Flip Three** resolves innermost-first, then finishes the outer sequence.
- **Flip 7 mid-sequence** stops the remaining forced draws and ends the round for everyone
  immediately. Players who already busted stay busted.
- **A duplicate Second Chance** must be passed to an active player who has none. If exactly
  one qualifies it's passed automatically; if several do, the drawer picks; if nobody does,
  it's discarded.
- **Freeze / Flip Three with only one legal target** auto-resolves rather than prompting.
- **Ties at the target score** are a shared win between everyone on the top score.
- **A busted tableau stays face-up** until the round is scored, with the offending card set
  apart and ringed in red, so everyone can see which duplicate did it. The cards only reach
  the discard pile at scoring time.
- **Deck exhaustion** reshuffles the discard pile back in mid-round.

## Multiplayer & disconnects

Rooms are in-memory and short-lived — no database. Everything face-up is public
information, so the `GameState` is broadcast to everyone as-is, with one exception: the
draw pile and discard pile are replaced by same-length filler before sending
(`publicState` in [server/src/rooms.ts](server/src/rooms.ts)), so opening devtools can't
show you the next card. Clients and bots only ever read the lengths.

Players can **leave at any time** — the ⏻ button in the game header, or Leave in the
lobby. Mid-round departures are repaired rather than aborted: the leaver's cards go back
to the discard pile, the dealer and turn markers shift to keep pointing at the same
seats, forced draws they owed are dropped, and any targeting prompt they owned is
cancelled (one merely aimed at them just loses that option). See `removePlayer` in
[shared/game/engine.ts](shared/game/engine.ts).

Leaving is permanent for that game. Dropping *without* leaving is not — if a player's
connection fails, their seat is held: they can rejoin with the same code
(the client stores its session in `localStorage` and re-claims the seat automatically on
reconnect). Meanwhile the table doesn't stall — after a few seconds the server plays a
conservative move on their behalf. In the lobby, a disconnect just frees the seat.

## Deploying to Render

[`render.yaml`](render.yaml) is a ready blueprint. `npm run build` produces
`client/dist` and `server/dist`, and `npm start` serves both from one Node process on
Render's `PORT`.

Keep it at **one instance** — Socket.IO plus in-memory rooms means a second instance
would have its own, separate set of games.

## Tests

```bash
npm test
```

Covers deck composition and shuffling, bust detection, the Second Chance interaction
(absorb, pass, discard), Flip Three's forced sequence including the nested and
interrupted cases, Flip 7 detection and bonus attribution, scoring with modifiers, the
win condition, the opening deal, and the bot's odds and targeting. There's also a fuzz
test that plays random rounds to prove the state machine always settles.

Live/manual testing is left to you — nothing here drives a browser.
