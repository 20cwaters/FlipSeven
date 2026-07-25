/**
 * Core type definitions for Flip 7.
 *
 * The game is fully public information: every field in `GameState` is broadcast
 * to every client as-is. There are no hidden hands, only a hidden deck ORDER.
 */

export type ActionKind = 'freeze' | 'flip_three' | 'second_chance';

export interface NumberCard {
  id: string;
  kind: 'number';
  /** 0–12. Also the card's point value. */
  value: number;
}

export interface ActionCard {
  id: string;
  kind: 'action';
  action: ActionKind;
}

export type ModifierCard =
  | { id: string; kind: 'modifier'; modifier: 'x2' }
  | { id: string; kind: 'modifier'; modifier: 'plus'; value: number };

export type Card = NumberCard | ActionCard | ModifierCard;

export type PlayerStatus =
  /** Still in the round, can be dealt to / can hit. */
  | 'active'
  /** Banked their points (chose Stay, was Frozen, or the round ended early). */
  | 'stayed'
  /** Drew a duplicate number with no Second Chance. Scores 0 this round. */
  | 'busted';

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  /** Cumulative score across rounds. First to `targetScore` wins. */
  totalScore: number;
  /** Unique number cards collected this round. */
  numbers: NumberCard[];
  /** x2 / flat-bonus cards collected this round. */
  modifiers: ModifierCard[];
  /** At most one at a time; sits face-up in the tableau. */
  secondChance: ActionCard | null;
  status: PlayerStatus;
  /** Score earned in the most recently completed round (null before round 1). */
  lastRoundScore: number | null;
  /** True if this player completed a Flip 7 in the current/most recent round. */
  hitFlipSeven: boolean;
}

export type GamePhase =
  | 'lobby'
  /** Dealing the one-card-each opening of a round. */
  | 'dealing'
  /** Normal Hit/Stay turn order. */
  | 'playing'
  /** Round scored; showing the summary before the next round. */
  | 'round_end'
  | 'game_over';

/** A pending forced-draw sequence (from Flip Three). Stored as a stack. */
export interface ForcedDraw {
  playerId: string;
  remaining: number;
  /** Id of the Flip Three card that caused this, for UI labelling. */
  sourceCardId: string;
}

export type TargetReason =
  | 'freeze'
  | 'flip_three'
  /** Drawer already holds a Second Chance and must pass this one on. */
  | 'second_chance_pass';

/** Blocks the game until `actorId` picks one of `targets`. */
export interface PendingTarget {
  card: ActionCard;
  reason: TargetReason;
  actorId: string;
  targets: string[];
}

export type LogKind =
  | 'info'
  | 'draw'
  | 'bust'
  | 'flip7'
  | 'stay'
  | 'freeze'
  | 'flip_three'
  | 'second_chance'
  | 'modifier'
  | 'round'
  | 'win';

export interface LogLine {
  id: number;
  kind: LogKind;
  text: string;
  playerId?: string;
}

export interface RoundSummaryRow {
  playerId: string;
  name: string;
  busted: boolean;
  /** Sum of number cards before modifiers. */
  base: number;
  /** True if an x2 card was applied. */
  doubled: boolean;
  /** Sum of flat +N modifier cards. */
  bonus: number;
  /** 15 if this player completed a Flip 7, else 0. */
  flipSevenBonus: number;
  total: number;
  newTotal: number;
}

/** Drives the "a card just landed" animation on clients. */
export interface CardFlash {
  seq: number;
  playerId: string;
  card: Card;
  /** 'deal' = opening deal, 'hit' = voluntary, 'forced' = Flip Three draw. */
  source: 'deal' | 'hit' | 'forced';
  /** Set when this draw busted the player. */
  busted?: boolean;
  /** Set when a Second Chance absorbed a duplicate. */
  savedBySecondChance?: boolean;
}

export interface GameSettings {
  targetScore: number;
  /** Max seats in the room (2–8 in practice). */
  maxPlayers: number;
  /** ms between automatic engine steps (deals, forced draws). */
  dealDelayMs: number;
  /** ms a bot "thinks" before acting. */
  botDelayMs: number;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  round: number;
  hostId: string;
  settings: GameSettings;
  players: PlayerState[];
  /** Index into `players`. Rotates clockwise each round. */
  dealerIndex: number;
  /** Index into `players`. Whose Hit/Stay decision we're waiting on. */
  turnIndex: number;
  deck: Card[];
  discard: Card[];
  /** Player ids still owed their opening card this round. */
  dealQueue: string[];
  /** Stack of Flip Three sequences; the last entry resolves first. */
  forced: ForcedDraw[];
  pending: PendingTarget | null;
  /** Set the instant someone completes 7 unique numbers. */
  flipSevenBy: string | null;
  flash: CardFlash | null;
  log: LogLine[];
  roundSummary: RoundSummaryRow[] | null;
  winnerIds: string[];
  /** Monotonic counter so clients can detect any change cheaply. */
  version: number;
}

/** What the engine is blocked on, if anything. */
export type WaitingOn =
  | { type: 'target'; playerId: string }
  | { type: 'decision'; playerId: string }
  | { type: 'round_end' }
  | { type: 'game_over' }
  | { type: 'lobby' }
  /** Nothing to wait for — call `tick()` to advance. */
  | null;
