import { persistentMap } from "@nanostores/persistent";

export enum PlayerType {
  Random = "Random",
  Network = "Network",
  Visual = "Visual",
}

export type GameSetupOptions = {
  secondPlayerType: PlayerType;
};

export const gameSetupStore = persistentMap<GameSetupOptions>(
  "gameSetupStore:",
  {
    secondPlayerType: PlayerType.Random,
  },
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);
