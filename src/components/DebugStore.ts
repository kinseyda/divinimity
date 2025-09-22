import { persistentMap } from "@nanostores/persistent";

export type DebugOptions = {
  debugMode: boolean;
};

export const debugStore = persistentMap<DebugOptions>(
  "debugStore:",
  {
    debugMode: false,
  },
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);
