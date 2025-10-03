import { BaseState, Player, type Action } from "./BaseModel";

function updateNetworkAndGetAction(
  state: BaseState,
  connectionId: string
): Promise<Action> {
  // connectionId is a key in the activeGames table. Getting player's selected
  // action just means waiting for the next change to that key after our update

  let connection: Connection | null = null;
  connect({ host: "localhost", port: 28015 }, function (err, conn) {
    if (err) throw err;
    connection = conn;
  });

  console.log("DB CONNECTION", connection);

  return new Promise((resolve, reject) => {});
}

export class NetworkPlayer extends Player<BaseState> {
  connectionId: string;

  constructor(name: string, connectionId: string, turnRemainder: number) {
    super(name, turnRemainder, (state: BaseState) =>
      updateNetworkAndGetAction(state, connectionId)
    );
    this.connectionId = connectionId;
  }
}
