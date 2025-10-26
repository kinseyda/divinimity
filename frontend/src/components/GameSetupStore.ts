import { persistentMap } from "@nanostores/persistent";
import z from "zod";

export enum PlayerType {
  Random = "Random",
  NetworkInitiator = "Network (Initiator)",
  NetworkResponder = "Network (Responder)",
  Visual = "Visual",
}

export enum ScoringSystem {
  None = "Unscored",
  MarkedSquares = "Marked Squares",
  TotalArea = "Total Area",
}

export enum WinCondition {
  NoMovesLeft = "No Moves Left",
  NoMovesHighestScore = "No Moves - Highest Score Wins",
  NoMovesLowestScore = "No Moves - Lowest Score Wins",
}

export type GameSetupOptions = {
  secondPlayerType: PlayerType;
  randomPlayerDelay: number;
  winCondition: WinCondition;
  scoringSystem: ScoringSystem;
  sessionId: string | null;
};

export const gameSetupStore = persistentMap<GameSetupOptions>(
  "gameSetupStore:",
  {
    secondPlayerType: PlayerType.Random,
    randomPlayerDelay: 1000,
    winCondition: WinCondition.NoMovesLeft,
    scoringSystem: ScoringSystem.None,
    sessionId: null,
  },
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

const gameSetupValidation = z.object({
  secondPlayerType: z.nativeEnum(PlayerType),
  randomPlayerDelay: z.number().min(0).max(10000),
  winCondition: z.nativeEnum(WinCondition),
  scoringSystem: z.nativeEnum(ScoringSystem),
  sessionId: z.string().nullable(),
});
