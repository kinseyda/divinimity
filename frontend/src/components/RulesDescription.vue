<script lang="ts">
import { defineComponent, type PropType } from "vue";
import {
  ScoreConditionEnum,
  WinConditionEnum,
  type Ruleset,
} from "../../../shared";

export default defineComponent({
  components: {},
  props: {
    ruleset: {
      type: Object as () => Ruleset,
      required: true,
    },
  },
  data() {
    return {};
  },
  emits: {},
  methods: {
    winconditionToString(winCondition: WinConditionEnum): string {
      switch (winCondition) {
        case WinConditionEnum.NoMovesLeft:
          return "No Moves Left";
        case WinConditionEnum.HighestScore:
          return "Highest Score";
        case WinConditionEnum.LowestScore:
          return "Lowest Score";
        default:
          return "Unknown Win Condition";
      }
    },
    scoreConditionToString(
      scoreCondition: ScoreConditionEnum | undefined
    ): string {
      if (scoreCondition === undefined) {
        return "None";
      }
      switch (scoreCondition) {
        case ScoreConditionEnum.MarkedSquares:
          return "Marked Squares";
        case ScoreConditionEnum.TotalArea:
          return "Total Area";
        default:
          return "Unknown Score Condition";
      }
    },
    winConditionDescription(winCondition: WinConditionEnum): string {
      switch (winCondition) {
        case WinConditionEnum.NoMovesLeft:
          return "Players take turns until no moves are left. At this point, the last person to have made a valid move wins.";
        case WinConditionEnum.HighestScore:
          return "Players gain points by performing certain actions. The player with the highest score at the end wins.";
        case WinConditionEnum.LowestScore:
          return "Players gain points by performing certain actions. The player with the lowest score at the end wins.";
        default:
          return "Unknown Win Condition";
      }
    },
    scoreConditionDescription(
      scoreCondition: ScoreConditionEnum | undefined
    ): string {
      if (scoreCondition === undefined) {
        return "The game is played without scoring.";
      }
      switch (scoreCondition) {
        case ScoreConditionEnum.MarkedSquares:
          return "Players gain points by removing marked squares from play. ";
        case ScoreConditionEnum.TotalArea:
          return "Players gain points based on the total area they remove from play.";
        default:
          return "Unknown Score Condition";
      }
    },
  },
});
</script>
<template>
  <div class="flex flex-col gap-1">
    <span class="font-bold text-lg">Current Game Rules:</span>
    <ul class="">
      <li>
        Win condition:
        <span class="font-bold">{{
          winconditionToString(ruleset.winCondition)
        }}</span>
        <div class="ml-4 text-xs">
          {{ winConditionDescription(ruleset.winCondition) }}
        </div>
      </li>
      <li>
        Scoring:
        <span class="font-bold">{{
          scoreConditionToString(ruleset.scoreCondition)
        }}</span>
        <div class="ml-4 text-xs">
          {{ scoreConditionDescription(ruleset.scoreCondition) }}
        </div>
      </li>
    </ul>
    <span class="divider" />
    <span class="font-bold text-lg">Game Controls:</span>
    <span class="flex flex-col gap-2 text-xs">
      <p>Slice boards by clicking and dragging</p>
      <p>
        Rearrange boards by holding
        <kbd class="kbd kbd-xs">Shift</kbd> or using the on-screen toggle
        button, then clicking and dragging boards
      </p>
    </span>
    <span class="divider" />
    <span class="font-bold text-lg">Game Description:</span>
    <span class="flex flex-col gap-2 text-xs">
      <p>
        Divinim is an abstract strategy game where players take turns slicing
        boards in two.
      </p>
      <p>Boards are grids of tiles, with some tiles marked.</p>
      <p>
        Every time a player slices a board, two boards are created from the
        slice, but only boards that contain a marked tile are kept in play.
      </p>
      <p>The game ends when no boards are left to play on.</p>
      <p>
        The winner is determined based on the selected win condition and scoring
        rules.
      </p>
    </span>
  </div>
</template>
<style scoped></style>
