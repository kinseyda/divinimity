import { persistentMap } from "@nanostores/persistent";
import z from "zod";

export enum PlayerType {
  AI = "AI",
  Network = "Network",
  Visual = "Visual",
}

export enum AIStrategy {
  Random = "Random",
}

export enum NetworkRole {
  NetworkInitiator = "Network Initiator",
  NetworkJoiner = "Network Joiner",
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
  turnRemainder: number;
  otherPlayerType: PlayerType;
  aiStrategy: AIStrategy;
  networkRole: NetworkRole;
  randomPlayerDelay: number;
  winCondition: WinCondition;
  scoringSystem: ScoringSystem;
};

export const gameSetupStore = persistentMap<GameSetupOptions>(
  "gameSetupStore:",
  {
    turnRemainder: 1,
    otherPlayerType: PlayerType.AI,
    aiStrategy: AIStrategy.Random,
    networkRole: NetworkRole.NetworkInitiator,
    randomPlayerDelay: 1000,
    winCondition: WinCondition.NoMovesLeft,
    scoringSystem: ScoringSystem.None,
  },
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

const gameSetupValidation = z.object({
  turnRemainder: z.number().min(0).max(1),
  secondPlayerType: z.nativeEnum(PlayerType),
  randomPlayerDelay: z.number().min(0).max(10000),
  winCondition: z.nativeEnum(WinCondition),
  scoringSystem: z.nativeEnum(ScoringSystem),
  sessionId: z.string().nullable(),
});
