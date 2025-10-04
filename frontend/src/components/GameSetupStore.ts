import { persistentMap } from "@nanostores/persistent";

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
