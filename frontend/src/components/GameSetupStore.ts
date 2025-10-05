import { persistentMap } from "@nanostores/persistent";
import z from "zod";

export enum PlayerType {
  Random = "Random",
  NetworkInitiator = "Network (Initiator)",
  NetworkResponder = "Network (Responder)",
  Visual = "Visual",
}

export type GameSetupOptions = {
  secondPlayerType: PlayerType;
  randomPlayerDelay: number;
};

export const gameSetupStore = persistentMap<GameSetupOptions>(
  "gameSetupStore:",
  {
    secondPlayerType: PlayerType.Random,
    randomPlayerDelay: 1000,
  },
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

const gameSetupValidation = z.object({
  secondPlayerType: z.nativeEnum(PlayerType),
  randomPlayerDelay: z.number().min(0).max(10000),
});
