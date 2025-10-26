import type { Socket } from "socket.io-client";
import {
  type Action,
  type PlayerInfo,
  type SessionInfo,
} from "../../../shared";
import { BaseState, Player } from "./BaseModel";

async function updateNetworkAndGetAction(
  state: BaseState,
  connectionId: string
): Promise<Action> {
  // connectionId is a key in the sessions table. Getting player's selected
  // action just means waiting for the next change to that key after our update

  return new Promise((resolve, reject) => {});
}

export class NetworkPlayer extends Player<BaseState> {
  session: SessionInfo;
  playerInfo: PlayerInfo;

  constructor(playerInfo: PlayerInfo, session: SessionInfo) {
    super(playerInfo.name, playerInfo.turnRemainder, (state) =>
      updateNetworkAndGetAction(state, session.id)
    );
    this.playerInfo = playerInfo;
    this.session = session;
  }
}
