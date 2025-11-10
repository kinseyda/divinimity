import { persistentMap } from "@nanostores/persistent";

export enum SetupTabs {
  Players = "Players",
  Rules = "Rules",
  Boards = "Boards",
}

export enum InfoTabs {
  Turns = "Turns",
  Info = "Info",
  Analysis = "Analysis",
}

export type UIOptions = {
  setupTab: SetupTabs;
  infoTab: InfoTabs;
};

export const uiStore = persistentMap<UIOptions>(
  "gameSetupStore:",
  {
    setupTab: SetupTabs.Players,
    infoTab: InfoTabs.Turns,
  },
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);
