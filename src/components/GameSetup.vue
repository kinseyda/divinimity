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
              <option :value="PlayerType.Network">Network Player</option>
            </select>
          </fieldset>
        </li>
        <li>
          {{ secondPlayerType }}
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

export default {
  components: { GameDisplay, XMarkIcon, WrenchIcon },
  emits: {},
  data() {
    return {
      PlayerType,
      localPlayer: undefined as VisualPlayer | undefined,
      otherPlayer: undefined as
        | VisualPlayer
        | NetworkPlayer
        | RandomPlayer
        | undefined,
      game: undefined as Game<VisualState> | undefined,
    };
  },
  setup() {
    const secondPlayerType = useVModel(gameSetupStore, "secondPlayerType");
    return { secondPlayerType };
  },
  mounted() {
    this.newGame();
  },
  methods: {
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
      this.localPlayer = visualPlayer;
      const randomPlayer = new RandomPlayer(1);

      this.game = new Game<VisualState>(
        new VisualState(
          [visualPlayer.info, randomPlayer.info],
          boards,
          actionCallback
        ),
        [visualPlayer, randomPlayer]
      );
      this.game.playLoop();
    },
  },
};
</script>

<style scoped></style>
