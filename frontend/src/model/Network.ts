import { BaseState, Player, type Action } from "./BaseModel";

function generateConnectionId(): string {
  // Simple function to generate a random connection ID
  // Connection IDs are 6 lowercase letters.
  // TODO switch to UUIDs
  return Math.random().toString(36).substring(2, 8);
}

async function updateNetworkAndGetAction(
  state: BaseState,
  connectionId: string
): Promise<Action> {
  // connectionId is a key in the activeGames table. Getting player's selected
  // action just means waiting for the next change to that key after our update

  return new Promise((resolve, reject) => {});
}

export class NetworkPlayer extends Player<BaseState> {
  connectionId: string;

  constructor(name: string, turnRemainder: number) {
    const connectionId = generateConnectionId();
    super(name, turnRemainder, (state: BaseState) =>
      updateNetworkAndGetAction(state, this.connectionId)
    );
    this.connectionId = connectionId;
  }
}
