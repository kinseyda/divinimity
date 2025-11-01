<template>
  <div class="size-full">
    <DrawerContent
      :drawerId="gameSetupDrawerId"
      drawerTitle="Game Setup"
      :drawerLeft="true"
    >
      <template #fabIcon>
        <PencilRulerIcon class="size-8" />
      </template>
      <template #content>
        <DrawerContent
          :drawerId="gameInfoDrawerId"
          drawerTitle="Current Game"
          :drawerLeft="false"
          v-if="game"
        >
          <template #fabIcon>
            <InfoIcon class="size-8" />
          </template>
          <template #content>
            <GameDisplay :interactive="true" :game="game" />
          </template>
          <template #drawerContent>
            <TabGroup
              :titles="['Turns', 'Info', 'Analysis']"
              groupName="infoTabs"
              v-model="activeTabInfo"
            >
              <template v-slot:Turns>
                <div class="flex flex-col gap-4 size-full">
                  <div class="flex-grow overflow-auto relative">
                    <!-- Using relative and absolute here to make the table
                    scroll without affecting the layout -->
                    <table
                      class="table table-pin-rows table-xs w-full max-h-full overflow-scroll absolute inset-0"
                    >
                      <thead>
                        <tr>
                          <th>Turn</th>
                          <th>Player</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(entry, index) in game?.state.turnHistory"
                          :key="index"
                        >
                          <td>{{ index + 1 }}</td>
                          <td>{{ entry.player.name }}</td>
                          <td>{{ actionToString(entry.action) }}</td>
                        </tr>
                        <tr>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div
                    class="shrink-0 collapse collapse-arrow bg-base-100 border-base-300 border"
                  >
                    <input type="checkbox" />
                    <div
                      class="collapse-title font-semibold flex flex-row items-center gap-2"
                    >
                      <CircleQuestionMarkIcon class="inline-block" />
                      <span>Help</span>
                    </div>
                    <div class="collapse-content text-sm">
                      <RulesDescription
                        :winConditions="[
                          winCondition === WinConditionEnum.NoMovesLeft
                            ? WinCondition.NoMovesLeft
                            : winCondition ===
                              WinConditionEnum.NoMovesHighestScore
                            ? WinCondition.HighestScore
                            : WinCondition.LowestScore,
                        ]"
                        :scoreConditions="
                          scoringSystem === ScoringSystemEnum.None
                            ? [] as ScoreCondition[]
                            : scoringSystem === ScoringSystemEnum.MarkedSquares
                            ? [ScoreCondition.MarkedSquares]
                            : [ScoreCondition.TotalArea]
                        "
                      />
                    </div>
                  </div>
                </div>
              </template>
              <template v-slot:Info>
                You will be able to see statistics about the current game and
                the players here.
              </template>
              <template v-slot:Analysis>
                You will be able to see analysis of the current game here.
              </template>
            </TabGroup>
          </template>
        </DrawerContent>
      </template>
      <template #drawerContent>
        <TabGroup
          :titles="['Players', 'Rules', 'Boards']"
          groupName="setupTabs"
          v-model="activeTabSetup"
        >
          <template v-slot:Players>
            <TabGroup
              :titles="[PlayerTypeEnum.AI, PlayerTypeEnum.Network]"
              groupName="networkSelectTabs"
              v-model="otherPlayerType"
            >
              <template v-slot:AI>
                <div groupName="networkSelectTabs" :isActive="true">
                  <fieldset class="fieldset">
                    <legend class="fieldset-legend">AI Strategy</legend>
                    <select class="select" v-model="aiStrategy">
                      <option :value="AIStrategyEnum.Random">Random</option>
                    </select>
                  </fieldset>
                  <fieldset
                    class="fieldset"
                    v-if="aiStrategy === AIStrategyEnum.Random"
                  >
                    <legend class="fieldset-legend">Random Player Delay</legend>
                    <input
                      type="range"
                      class="range range-primary"
                      min="0"
                      max="1000"
                      step="100"
                      v-model="randomPlayerDelay"
                    />
                    <div class="flex justify-between px-2.5 mt-2 text-xs">
                      <span>0 ms</span>
                      <span>1000 ms</span>
                    </div>
                  </fieldset>
                </div>
              </template>
              <template v-slot:Network>
                <fieldset class="fieldset">
                  <select class="select" v-model="networkRole">
                    <option :value="NetworkRoleEnum.NetworkInitiator">
                      Host a new game
                    </option>
                    <option :value="NetworkRoleEnum.NetworkJoiner">
                      Join a game
                    </option>
                  </select>
                </fieldset>
                <fieldset
                  class="fieldset"
                  v-if="networkRole === NetworkRoleEnum.NetworkJoiner"
                >
                  <label class="label">
                    <span class="label-text">Session ID</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Session ID"
                    class="input input-bordered w-full"
                    v-model="sessionId"
                  />
                  <button
                    class="btn btn-secondary btn-sm mt-2"
                    :class="{ disabled: !sessionId }"
                    @click="joinSession(sessionId!)"
                  >
                    Join Session
                  </button>
                </fieldset>
                <fieldset
                  class="fieldset"
                  v-if="networkRole === NetworkRoleEnum.NetworkInitiator"
                >
                  <legend class="fieldset-legend">Your Session ID:</legend>
                  <label class="input input-bordered w-full">
                    <input
                      type="text"
                      :value="session ? session.id : ''"
                      class="font-mono"
                      readonly
                    />
                    <ClipboardIcon
                      class="size-4 ml-2 cursor-pointer"
                      :title="session ? 'Copy Session ID to clipboard' : ''"
                      @click="writeSessionIDToClipboard()"
                    />
                  </label>
                  <button
                    class="btn btn-secondary btn-sm mt-2"
                    @click="newSession"
                  >
                    New Session
                  </button>
                </fieldset>
                <fieldset
                  class="fieldset"
                  v-if="
                    networkRole === NetworkRoleEnum.NetworkInitiator ||
                    networkRole === NetworkRoleEnum.NetworkJoiner
                  "
                >
                  <legend class="fieldset-legend">Session Info</legend>
                  <!-- For debugging -->
                  session: {{ session }}, socket: {{ socket?.id }}
                </fieldset>
              </template>
            </TabGroup>
          </template>
          <template v-slot:Rules>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Win Conditions</legend>
              <select class="select" v-model="winCondition">
                <option :value="WinConditionEnum.NoMovesLeft">
                  No Moves Left - Last Player Wins
                </option>
                <option :value="WinConditionEnum.NoMovesHighestScore">
                  No Moves Left - Highest Score Wins
                </option>
                <option :value="WinConditionEnum.NoMovesLowestScore">
                  No Moves Left - Lowest Score Wins
                </option>
              </select>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Scoring System</legend>
              <select class="select" v-model="scoringSystem">
                <option :value="ScoringSystemEnum.None">Unscored</option>
                <option :value="ScoringSystemEnum.MarkedSquares">
                  Marked Squares
                </option>
                <option :value="ScoringSystemEnum.TotalArea">Total Area</option>
              </select>
            </fieldset>
          </template>
          <template v-slot:Boards>
            You will be able to select board configurations (dimensions and
            markings) here.
          </template>
        </TabGroup>

        <label
          :for="gameSetupDrawerId"
          @click="newGame"
          class="btn btn-primary btn-lg fixed bottom-0 right-0 m-8"
        >
          New Game <PlayIcon />
        </label>
      </template>
    </DrawerContent>
  </div>
</template>
<script lang="ts">
import { useVModel } from "@nanostores/vue";
import {
  CircleQuestionMarkIcon,
  ClipboardIcon,
  InfoIcon,
  PencilRulerIcon,
  PlayIcon,
} from "lucide-vue-next";
import { io, Socket } from "socket.io-client";
import { defineComponent } from "vue";
import {
  ClientToClientMessageType,
  ClientToServerMessageType,
  ScoreCondition,
  ServerToClientMessageType,
  WinCondition,
  type Action,
  type Board,
  type ClientToServerMessage,
  type JoinSessionData,
  type NewGameData,
  type NewGameMessage,
  type ServerToClientMessage,
  type ServerToClientMessageData,
  type SessionInfo,
  type Slice,
  type SliceResult,
  type StartSessionData,
  type TurnData,
  type TurnMessage,
} from "../../../shared";
import {
  actionToString,
  BaseState,
  Game,
  Player,
  randomBoard,
  RandomPlayer,
  type TurnResult,
} from "../model/BaseModel";
import { generateLoremIpsum } from "../model/StyleUtils";
import { VisualPlayer, VisualState } from "../model/VisualModel";
import DrawerContent from "./DrawerContent.vue";
import GameDisplay from "./GameDisplay.vue";
import {
  gameSetupStore,
  AIStrategy as UIAIStrategyEnum,
  NetworkRole as UINetworkRoleEnum,
  PlayerType as UIPlayerTypeEnum,
  ScoringSystem as UIScoringSystemEnum,
  WinCondition as UIWinConditionEnum,
} from "./GameSetupStore";
import RulesDescription from "./RulesDescription.vue";
import TabGroup from "./TabGroup.vue";
import TurnIndicator from "./TurnIndicator.vue";
import { uiStore } from "./UIStore";

const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;

if (!backendUrl) {
  throw new Error("PUBLIC_BACKEND_URL is not set");
}

const publicUrl = import.meta.env.PUBLIC_URL;

if (!publicUrl) {
  throw new Error("PUBLIC_URL is not set");
}

const websocketUrl = import.meta.env.PUBLIC_WEBSOCKET_URL;

if (!websocketUrl) {
  throw new Error("PUBLIC_WEBSOCKET_URL is not set");
}

const websocketPath = import.meta.env.PUBLIC_WEBSOCKET_PATH;

if (!websocketPath) {
  throw new Error("PUBLIC_WEBSOCKET_PATH is not set");
}

const gameInfoDrawerId = "game-info-drawer";
const gameSetupDrawerId = "game-setup-drawer";

/**
 * A player that gets its actions from a network source.
 */
class NetworkPlayer extends Player<BaseState> {
  constructor(
    name: string,
    turnRemainder: number,
    getActionCallback: (
      state: BaseState
    ) => Promise<[Action, Board[] | undefined]>
  ) {
    super(name, turnRemainder, getActionCallback);
  }
}

export default defineComponent({
  components: {
    PencilRulerIcon,
    InfoIcon,
    PlayIcon,
    ClipboardIcon,
    CircleQuestionMarkIcon,
    GameDisplay,
    DrawerContent,
    TabGroup,
    TurnIndicator,
    RulesDescription,
  },
  emits: {},
  data() {
    return {
      PlayerTypeEnum: UIPlayerTypeEnum,
      WinConditionEnum: UIWinConditionEnum,
      WinCondition: WinCondition,
      ScoreCondition: ScoreCondition,
      ScoringSystemEnum: UIScoringSystemEnum,
      AIStrategyEnum: UIAIStrategyEnum,
      NetworkRoleEnum: UINetworkRoleEnum,
      game: undefined as Game<VisualState> | undefined,
      gameInfoDrawerId,
      gameSetupDrawerId,
      session: undefined as SessionInfo | undefined,
      socket: undefined as Socket | undefined,
      sessionId: undefined as string | undefined,
    };
  },
  setup() {
    const otherPlayerType = useVModel(gameSetupStore, "otherPlayerType");
    const aiStrategy = useVModel(gameSetupStore, "aiStrategy");
    const networkRole = useVModel(gameSetupStore, "networkRole");
    const randomPlayerDelay = useVModel(gameSetupStore, "randomPlayerDelay");
    const winCondition = useVModel(gameSetupStore, "winCondition");
    const scoringSystem = useVModel(gameSetupStore, "scoringSystem");
    const activeTabInfo = useVModel(uiStore, "infoTab");
    const activeTabSetup = useVModel(uiStore, "setupTab");
    return {
      otherPlayerType,
      aiStrategy,
      networkRole,
      randomPlayerDelay,
      winCondition,
      scoringSystem,
      activeTabInfo,
      activeTabSetup,
    };
  },
  mounted() {
    this.newGame();
  },
  computed: {
    sessionReady(): boolean {
      return this.session !== undefined && this.session.players.length > 1;
    },
  },
  methods: {
    generateLoremIpsum(words: number): string {
      return generateLoremIpsum(words);
    },
    getVisualPlayer(): VisualPlayer | null {
      if (!this.game) return null;
      const players = this.game.players.filter(
        (p) => p instanceof VisualPlayer
      ) as VisualPlayer[];
      if (players.length === 0) return null;
      return players[0];
    },
    isWinnerVisualPlayer(): boolean {
      if (!this.game) return false;
      const winnerInfos = this.game.winners;
      if (winnerInfos.length === 0) return false;
      return winnerInfos.includes(this.getVisualPlayer()?.info!);
    },
    actionToString(action: Action): string {
      return actionToString(action);
    },
    pingMultiplayerServer() {
      console.log("Pinging multiplayer server at", `${backendUrl}/ping`);

      fetch(`${backendUrl}/ping`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.text();
        })
        .then((data) => {
          console.log("Ping response:", data);
        })
        .catch((error) => {
          console.error("There was a problem with the fetch operation:", error);
        });
    },
    backendHealthCheck() {
      return fetch(`${backendUrl}/health/backend`).then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        console.log("Backend health check response:", response);
        return;
      });
    },
    backendDbHealthCheck() {
      return fetch(`${backendUrl}/health/db`).then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        console.log("Backend DB health check response:", response);
        return;
      });
    },
    testWebSocketConnection() {
      console.log(
        "Testing WebSocket connection to",
        websocketUrl,
        "with path",
        websocketPath
      );
      const socket = io(websocketUrl, {
        path: websocketPath,
        transports: ["websocket"],
      });
      socket.on("connect_error", (err) => {
        console.error("Connection error:", err);
      });
      // Open and close a connection quickly
      socket.on("connect", () => {
        console.log("Connected to server");
      });
      socket.on("disconnect", () => {
        console.log("Disconnected from server");
      });
      setTimeout(() => {
        socket.close();
        console.log("Closed connection");
      }, 1000);
    },

    newSession() {
      console.log("Creating a new session");
      const socket = io(websocketUrl, {
        path: websocketPath,
        transports: ["websocket"],
      });
      socket.on("connect", () => {
        console.log("Connected to multiplayer server with id", socket.id);
        this.socket = socket;
        // Send start session request
        const startSessionData: StartSessionData = {
          playerInfo: {
            uuid: "player-" + Math.random().toString(36).substring(2, 15),
            name: "Host Player",
            turnRemainder: 0,
          },
          ruleset: {
            winCondition:
              this.winCondition == UIWinConditionEnum.NoMovesLeft
                ? WinCondition.NoMovesLeft
                : this.winCondition == UIWinConditionEnum.NoMovesHighestScore
                ? WinCondition.HighestScore
                : WinCondition.LowestScore,
            scoreCondition:
              this.scoringSystem == UIScoringSystemEnum.None
                ? undefined
                : this.scoringSystem == UIScoringSystemEnum.MarkedSquares
                ? ScoreCondition.MarkedSquares
                : ScoreCondition.TotalArea,
          },
        };
        const startSessionMessage: ClientToServerMessage = {
          type: ClientToServerMessageType.StartSession,
          data: startSessionData,
        };
        socket.emit(
          ClientToServerMessageType.StartSession,
          startSessionMessage
        ); // Request server start a session
      });
      socket.on("disconnect", () => {
        console.log("Disconnected from multiplayer server");
        this.socket = undefined;
      });
      socket.on(
        ServerToClientMessageType.StartSuccess,
        (msg: ServerToClientMessage) => {
          // Respond to the session started below
          console.log("Session started:", msg);
          this.session = (msg.data as ServerToClientMessageData).session;
        }
      );
      socket.on(
        ServerToClientMessageType.StartFailure,
        (msg: ServerToClientMessage) => {
          console.log("Session failed:", msg);
        }
      );
      socket.on(
        ServerToClientMessageType.SessionUpdated,
        (msg: ServerToClientMessage) => {
          console.log("Session updated:", msg);
          this.session = (msg.data as ServerToClientMessageData).session;
        }
      );
      this.attachNewGameListener();
    },
    joinSession(sessionId: string) {
      console.log("Joining session with ID:", sessionId);

      if (this.socket) {
        this.socket.close();
        this.socket = undefined;
      }

      const socket = io(websocketUrl, {
        path: websocketPath,
        transports: ["websocket"],
      });
      this.socket = socket;

      socket.on("connect", () => {
        console.log("Connected to multiplayer server with id", socket.id);
        this.socket = socket;
        // Send join session request
        const joinSessionData: JoinSessionData = {
          sessionId: sessionId,
          playerInfo: {
            uuid: "player-" + Math.random().toString(36).substring(2, 15),
            name: "Joining Player",
            turnRemainder: 1,
          },
        };
        const joinSessionMessage: ClientToServerMessage = {
          type: ClientToServerMessageType.JoinSession,
          data: joinSessionData,
        };
        socket.emit(ClientToServerMessageType.JoinSession, joinSessionMessage); // Request server to join a session
      });
      socket.on("disconnect", () => {
        console.log("Disconnected from multiplayer server");
        this.socket = undefined;
      });
      socket.on(
        ServerToClientMessageType.JoinSuccess,
        (msg: ServerToClientMessage) => {
          // Respond to the session joined below
          console.log("Session joined:", msg);
          this.session = (msg.data as ServerToClientMessageData).session;
        }
      );
      this.attachNewGameListener();
    },
    attachNewGameListener() {
      if (!this.socket) return;
      this.socket.on(
        ClientToClientMessageType.NewGame,
        (msg: NewGameMessage) => {
          console.log("New game message:", msg);
          const { boards, ruleset } = msg.data;
          // Set the setup according to the received ruleset
          this.winCondition =
            ruleset.winCondition === WinCondition.NoMovesLeft
              ? UIWinConditionEnum.NoMovesLeft
              : ruleset.winCondition === WinCondition.HighestScore
              ? UIWinConditionEnum.NoMovesHighestScore
              : UIWinConditionEnum.NoMovesLowestScore;
          this.scoringSystem =
            ruleset.scoreCondition === undefined
              ? UIScoringSystemEnum.None
              : ruleset.scoreCondition === ScoreCondition.MarkedSquares
              ? UIScoringSystemEnum.MarkedSquares
              : UIScoringSystemEnum.TotalArea;

          this.newGameWithBoards(boards);
        }
      );
    },
    attachNetworkActionHandler(turnCallback: (action: TurnData) => void) {
      if (!this.socket) return;
      console.log("Attaching network action handler");
      this.socket.on(ClientToClientMessageType.Turn, (msg: TurnMessage) => {
        console.log("Player action message:", msg);
        turnCallback(msg.data);
      });
    },
    detachNetworkActionHandler() {
      if (!this.socket) return;
      this.socket.off(ClientToClientMessageType.Turn);
    },
    writeSessionIDToClipboard() {
      if (this.session) {
        navigator.clipboard.writeText(this.session.id).then(
          () => {},
          (err) => {
            console.error("Could not copy session ID: ", err);
          }
        );
      }
    },
    newGameWithBoards(boards: Board[]) {
      if (
        this.otherPlayerType === this.PlayerTypeEnum.Network &&
        !this.sessionReady
      ) {
        console.log("Cannot start network game: session not ready");
        return;
      }
      let otherPlayer;

      switch (this.otherPlayerType) {
        case UIPlayerTypeEnum.AI:
          otherPlayer = new RandomPlayer(
            1,
            "Random CPU",
            this.randomPlayerDelay
          );
          break;
        case UIPlayerTypeEnum.Network:
          // Similar pattern to the VisualPlayer's getActionCallback below,
          // but for the NetworkPlayer instead. When the NetworkPlayer needs
          // to make a turn, it will attach a temporary listener to the socket
          // to wait for the turn message from the other player. When the
          // message is received, it will call the actionCallback to resolve
          // the turn.

          const getNetworkActionCallback = (state: BaseState) => {
            return new Promise<[Action, Board[] | undefined]>((resolve) => {
              console.log(
                "Network player waiting for action from other player"
              );
              this.attachNetworkActionHandler((turnData: TurnData) => {
                console.log(
                  "Network player received action from other player:",
                  turnData
                );
                this.detachNetworkActionHandler();
                const boards = Object.values(
                  turnData.sliceResult.boards
                ).filter((b) => b !== null) as Board[];

                resolve([turnData.turn.action, boards]);
              });
            });
          };

          otherPlayer = new NetworkPlayer(
            "Network Player",
            this.networkRole === UINetworkRoleEnum.NetworkInitiator ? 1 : 0,
            getNetworkActionCallback
          );
          break;
        default:
          throw new Error(`Unknown player type: '${this.otherPlayerType}'`);
      }

      // We'll use a Promise and its resolver to "pipe" between
      // getActionCallback and actionCallback. When getActionCallback is called,
      // it returns a Promise<[Action, Board | undefined]> and stores its
      // resolver. When actionCallback is called (by the slice tool), it
      // resolves the stored Promise.

      let resolveAction: ((value: [Action, undefined]) => void) | null = null;

      // The actionCallback will be called inside the slice tool's onMouseDown /
      // onMouseUp functions. It shall resolve the getActionCallback promise
      const actionCallback = (slice: Slice, board: Board) => {
        if (resolveAction) {
          resolveAction([{ slice, board }, undefined]);
          resolveAction = null;
        }
      };

      // The getActionCallback will be used when the player needs to make a
      // turn. It shall just wait for the slice tool to be used, returns a
      // promise of an action.
      const getActionCallback = (state: VisualState) => {
        return new Promise<[Action, undefined]>((resolve) => {
          resolveAction = resolve;
        });
      };

      const visualPlayer = new VisualPlayer(
        "User",
        otherPlayer.info.turnRemainder === 0 ? 1 : 0,
        getActionCallback
      );

      let scoringConditions = [];
      switch (this.scoringSystem) {
        case UIScoringSystemEnum.None:
          break;
        case UIScoringSystemEnum.MarkedSquares:
          scoringConditions.push(ScoreCondition.MarkedSquares);
          break;
        case UIScoringSystemEnum.TotalArea:
          scoringConditions.push(ScoreCondition.TotalArea);
          break;
        default:
          throw new Error("Unknown scoring system");
      }

      let winConditions = [];
      switch (this.winCondition) {
        case UIWinConditionEnum.NoMovesLeft:
          winConditions.push(WinCondition.NoMovesLeft);
          break;
        case UIWinConditionEnum.NoMovesHighestScore:
          winConditions.push(WinCondition.HighestScore);
          break;
        case UIWinConditionEnum.NoMovesLowestScore:
          winConditions.push(WinCondition.LowestScore);
          break;
        default:
          throw new Error("Unknown win condition");
      }
      this.game = new Game<VisualState>(
        new VisualState(
          [visualPlayer.info, otherPlayer.info],
          boards,
          actionCallback,
          [
            (turnResult: TurnResult) => {
              // Post turn updater to emit the slice and turn result to the
              // other player.
              if (this.socket && this.sessionReady) {
                if (
                  this.getVisualPlayer()!.info.uuid !==
                  turnResult.turn.player.uuid
                ) {
                  // Only emit turns made by the visual player (local player)
                  return;
                }
                const sliceResult: SliceResult = turnResult.sliceResult;
                const turnData: TurnData = {
                  turn: turnResult.turn,
                  sliceResult: sliceResult,
                };
                const turnMessage: TurnMessage = {
                  type: ClientToClientMessageType.Turn,
                  data: turnData,
                  sessionId: this.session!.id,
                };
                console.log("Emitting turn message:", turnMessage);
                this.socket.emit(ClientToClientMessageType.Turn, turnMessage);
              }
            },
          ]
        ),
        [visualPlayer, otherPlayer],
        winConditions,
        scoringConditions
      );
      if (this.sessionReady) {
        const newGameMessageData: NewGameData = {
          ruleset: {
            winCondition:
              this.winCondition == UIWinConditionEnum.NoMovesLeft
                ? WinCondition.NoMovesLeft
                : this.winCondition == UIWinConditionEnum.NoMovesHighestScore
                ? WinCondition.HighestScore
                : WinCondition.LowestScore,
            scoreCondition:
              this.scoringSystem == UIScoringSystemEnum.None
                ? undefined
                : this.scoringSystem == UIScoringSystemEnum.MarkedSquares
                ? ScoreCondition.MarkedSquares
                : ScoreCondition.TotalArea,
          },
          boards: boards,
        };
        const newGameMessage: NewGameMessage = {
          type: ClientToClientMessageType.NewGame,
          data: newGameMessageData,
          sessionId: this.session!.id,
        };
        console.log("Emitting new game message:", newGameMessage);
        this.socket?.emit(ClientToClientMessageType.NewGame, newGameMessage);
      }
      console.log("Starting game play loop");
      console.log("Game:", this.game);
      this.game.playLoop();
    },
    newGame() {
      const boards = [] as Board[];
      const maxBoards = 1;
      for (let i = 0; i < Math.floor(Math.random() * maxBoards + 1); i++) {
        boards.push(randomBoard());
      }

      this.newGameWithBoards(boards);
    },
  },
});
</script>

<style scoped></style>
