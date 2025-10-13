<template>
  <div class="size-full">
    <DrawerContent
      drawerId="game-setup-drawer"
      drawerTitle="Game Setup"
      :drawerLeft="true"
    >
      <template #fabIcon>
        <PencilRulerIcon class="size-8" />
      </template>
      <template #content>
        <DrawerContent
          drawerId="game-info-drawer"
          drawerTitle="Current Game"
          :drawerLeft="false"
          v-if="game"
        >
          <template #fabIcon>
            <InfoIcon class="size-8" />
          </template>
          <template #content>
            <div class="size-full relative">
              <GameDisplay :interactive="true" :game="game" />
            </div>
          </template>
          <template #drawerContent>
            <TabGroup>
              <TabContent groupName="infoTabs" :isActive="true" tabName="Turns">
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
                  <div class="shrink-0 flex flex-col gap-2 text-xs">
                    <span>Slice boards by clicking and dragging</span>
                    <span>Last player to take a turn wins</span>
                    <span>
                      Rearrange boards by holding
                      <kbd class="kbd kbd-xs">Shift</kbd> or using the on-screen
                      toggle button, then clicking and dragging boards
                    </span>
                  </div>
                </div>
              </TabContent>
              <TabContent groupName="infoTabs" tabName="Info">
                You will be able to see statistics about the current game and
                the players here.
              </TabContent>
              <TabContent groupName="infoTabs" tabName="Analysis">
                You will be able to see analysis of the current game here.
              </TabContent>
            </TabGroup>
          </template>
        </DrawerContent>
      </template>
      <template #drawerContent>
        <TabGroup>
          <TabContent groupName="setupTabs" :isActive="true" tabName="Players">
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Second Player</legend>
              <select class="select" v-model="secondPlayerType">
                <option :value="PlayerType.Random">Random Player</option>
                <option :value="PlayerType.NetworkInitiator">
                  Network (Host new game)
                </option>
                <option :value="PlayerType.NetworkResponder">
                  Network (Join a game)
                </option>
              </select>
            </fieldset>
            <fieldset
              class="fieldset"
              v-if="secondPlayerType === PlayerType.Random"
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
            <fieldset
              class="fieldset"
              v-else-if="secondPlayerType === PlayerType.NetworkResponder"
            >
              <div>Not yet implemented</div>
            </fieldset>
            <fieldset
              class="fieldset"
              v-else-if="secondPlayerType === PlayerType.NetworkInitiator"
            >
              <div>Not yet implemented</div>
              <button
                class="btn btn-secondary mt-2"
                @click="pingMultiplayerServer"
              >
                Ping Multiplayer Server
              </button>
              <button class="btn btn-primary mt-2" @click="backendHealthCheck">
                Test Server Health
              </button>
              <button class="btn btn-accent mt-2" @click="backendDbHealthCheck">
                Test Database Health
              </button>
              <button
                class="btn btn-info mt-2"
                @click="testWebSocketConnection"
              >
                Test WebSocket Connection
              </button>
            </fieldset>
          </TabContent>
          <TabContent groupName="setupTabs" tabName="Rules">
            You will be able to select game rules here.</TabContent
          >
          <TabContent groupName="setupTabs" tabName="Boards">
            You will be able to select board configurations (dimensions and
            markings) here.
          </TabContent>
        </TabGroup>

        <button
          class="btn btn-primary btn-lg fixed bottom-0 right-0 m-8"
          @click="newGame"
        >
          New Game <PlayIcon class="" />
        </button>
      </template>
    </DrawerContent>
  </div>
</template>
<script lang="ts">
import { useVModel } from "@nanostores/vue";
import { InfoIcon, MoveIcon, PencilRulerIcon, PlayIcon } from "lucide-vue-next";
import { defineComponent } from "vue";
import {
  actionToString,
  Game,
  RandomPlayer,
  type Action,
  type Board,
  type Slice,
} from "../model/BaseModel";
import { NetworkPlayer } from "../model/Network";
import { generateLoremIpsum } from "../model/StyleUtils";
import { randomBoard, VisualPlayer, VisualState } from "../model/VisualModel";
import DrawerContent from "./DrawerContent.vue";
import GameDisplay from "./GameDisplay.vue";
import { gameSetupStore, PlayerType } from "./GameSetupStore";
import TabContent from "./TabContent.vue";
import TabGroup from "./TabGroup.vue";
import TurnIndicator, { PlayerState } from "./TurnIndicator.vue";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;

if (!backendUrl) {
  throw new Error("PUBLIC_BACKEND_URL is not set");
}

export default defineComponent({
  components: {
    PencilRulerIcon,
    InfoIcon,
    PlayIcon,
    GameDisplay,
    DrawerContent,
    TabGroup,
    TabContent,
    TurnIndicator,
  },
  emits: {},
  data() {
    return {
      PlayerType,
      game: undefined as Game<VisualState> | undefined,
    };
  },
  setup() {
    const secondPlayerType = useVModel(gameSetupStore, "secondPlayerType");
    const randomPlayerDelay = useVModel(gameSetupStore, "randomPlayerDelay");
    return { secondPlayerType, randomPlayerDelay };
  },
  mounted() {
    this.newGame();
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
      const socket = io(backendUrl, { path: "/ws" });
      // Open and close a connection quickly
      socket.on("connect", () => {
        console.log("Connected to server");
      });
      socket.on("disconnect", () => {
        console.log("Disconnected from server");
      });
      setTimeout(() => {
        socket.close();
      }, 1000);
    },
    newGame() {
      const boards = [] as Board[];
      const maxBoards = 5;
      for (let i = 0; i < Math.floor(Math.random() * maxBoards + 1); i++) {
        boards.push(randomBoard());
      }

      // We'll use a Promise and its resolver to "pipe" between getActionCallback
      // and actionCallback. When getActionCallback is called, it returns a
      // Promise<Action> and stores its resolver. When actionCallback is called
      // (by the slice tool), it resolves the stored Promise.

      let resolveAction: ((action: Action) => void) | null = null;

      // The actionCallback will be called inside the slice tool's onMouseDown
      // function. It shall resolve the getActionCallback promise
      const actionCallback = (slice: Slice, board: Board) => {
        if (resolveAction) {
          resolveAction({ slice, board });
          resolveAction = null;
        }
      };

      // The getActionCallback will be used when the player needs to make a
      // turn. It shall just wait for the slice tool to be used, returns a
      // promise of an action.
      const getActionCallback = (state: VisualState) => {
        return new Promise<Action>((resolve) => {
          resolveAction = resolve;
        });
      };

      const visualPlayer = new VisualPlayer("User", 0, getActionCallback);
      let secondPlayer;

      switch (this.secondPlayerType) {
        case PlayerType.Random:
          secondPlayer = new RandomPlayer(
            1,
            "Random CPU",
            this.randomPlayerDelay
          );
          break;
        case PlayerType.NetworkInitiator:
          secondPlayer = new NetworkPlayer("Network", 1);
          break;
        case PlayerType.NetworkResponder:
          throw new Error("Not implemented yet");
        default:
          throw new Error("Unknown player type");
      }

      this.game = new Game<VisualState>(
        new VisualState(
          [visualPlayer.info, secondPlayer.info],
          boards,
          actionCallback
        ),
        [visualPlayer, secondPlayer]
      );
      this.game.playLoop();
    },
  },
});
</script>

<style scoped></style>
