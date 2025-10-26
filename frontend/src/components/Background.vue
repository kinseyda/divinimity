<script lang="ts">
// Background component that demos a random game being played out on a loop
import { defineComponent } from "vue";
import { Game, NoMovesWinCondition, RandomPlayer } from "../model/BaseModel";
import { randomBoard, VisualState } from "../model/VisualModel";
import "../styles/global.css";
import GameDisplay from "./GameDisplay.vue";

export default defineComponent({
  components: {
    GameDisplay,
  },
  emits: {},
  data() {
    return {
      game: undefined as Game<VisualState> | undefined,
    };
  },
  methods: {
    newGame() {
      const boards = [randomBoard()];
      const randomPlayer1 = new RandomPlayer(0, "P1");
      const randomPlayer2 = new RandomPlayer(1, "P2");

      const game = new Game<VisualState>(
        new VisualState(
          [randomPlayer1.info, randomPlayer2.info],
          boards,
          () => {}
        ),
        [randomPlayer1, randomPlayer2],
        [NoMovesWinCondition],
        []
      );
      this.game = game;
      game.playLoop().then(() => {
        // Restart a new game when this one ends, check for memory leaks
        this.newGame();
      });
    },
  },
  mounted() {
    this.newGame();
  },
});
</script>

<template>
  <div v-if="game" class="size-full">
    <GameDisplay :game="game!" />
  </div>
</template>
