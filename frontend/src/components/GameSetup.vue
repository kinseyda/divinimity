<template>
  <div class="drawer lg:drawer-open size-full">
    <input id="game-setup-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
      <!-- Content beside the drawer goes here -->
      <div class="size-full relative">
        <div class="fab lg:hidden">
          <label
            for="game-setup-drawer"
            class="btn btn-lg btn-primary btn-circle drawer-button lg:hidden absolute bottom-0 left-0 m-4 z-1"
          >
            <WrenchIcon class="size-8" />
          </label>
        </div>
        <div v-if="game">
          <GameDisplay :interactive="true" :game="game" />
        </div>
      </div>
    </div>
    <div class="drawer-side size-full flex flex-col">
      <!-- using size-full here because the daisyUi drawer-side class sets the
      height to 100dvh -->
      <label for="game-setup-drawer" class="drawer-overlay"></label>
      <ul class="bg-base-200 z-50 size-full w-xs h-full p-4 gap-4">
        <li>
          <span class="flex justify-between items-center">
            <h2 class="text-2xl font-bold">Game Setup</h2>
            <label
              class="btn btn-ghost btn-square lg:hidden"
              for="game-setup-drawer"
            >
              <XMarkIcon /> </label
          ></span>
        </li>
        <li>
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

          <label
            class="label validator"
            v-if="secondPlayerType === PlayerType.NetworkResponder"
          >
            <input
              type="text"
              required
              class="input input-bordered w-full"
              placeholder="Game ID"
              pattern="[a-z]{6}"
              minlength="6"
              maxlength="6"
              title="6 lowercase letters"
            />
          </label>
          <p class="validator-hint">Enter a valid game ID</p>
          <button class="btn btn-secondary mt-2" @click="pingMultiplayerServer">
            Ping Multiplayer Server
          </button>
        </li>

        <li class="fixed bottom-0 right-0 m-4">
          <button class="btn btn-primary btn-lg w-full" @click="newGame">
            New Game
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { XMarkIcon, WrenchIcon } from "@heroicons/vue/24/outline";
import { useVModel } from "@nanostores/vue";
import {
  Game,
  RandomPlayer,
  type Action,
  type Board,
  type Slice,
} from "../model/BaseModel";
import { NetworkPlayer } from "../model/Network";
import { randomBoard, VisualPlayer, VisualState } from "../model/VisualModel";
import GameDisplay from "./GameDisplay.vue";
import { gameSetupStore, PlayerType } from "./GameSetupStore";

const backendUrl = import.meta.env.PUBLIC_URL;
const backendPrefix = import.meta.env.PUBLIC_BACKEND_PREFIX;

if (!backendUrl) {
  throw new Error("PUBLIC_URL is not set");
}

if (!backendPrefix) {
  throw new Error("PUBLIC_BACKEND_PREFIX is not set");
}

export default {
  components: { GameDisplay, XMarkIcon, WrenchIcon },
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
    pingMultiplayerServer() {
      console.log(
        "Pinging multiplayer server at",
        `${backendUrl}/${backendPrefix}/ping`
      );

      fetch(`${backendUrl}/${backendPrefix}/ping`)
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
};
</script>

<style scoped></style>
