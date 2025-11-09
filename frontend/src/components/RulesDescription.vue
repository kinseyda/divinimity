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
  },
  setup() {
    return {};
  },
});
</script>
<template>
  <div class="flex flex-col gap-1">
    <span class="font-bold text-lg">Current Game Rules:</span>
    <ul class="list-disc list-inside">
      <li>Win condition: {{ winconditionToString(ruleset.winCondition) }}</li>
      <li v-if="ruleset.scoreCondition !== undefined">
        Scoring: {{ scoreConditionToString(ruleset.scoreCondition) }}
      </li>
      <li v-else>Scoring: None</li>
    </ul>
    <span class="divider" />
    <span class="font-bold text-lg">Game Controls:</span>
    <span>Slice boards by clicking and dragging</span>
    <span>
      Rearrange boards by holding
      <kbd class="kbd kbd-xs">Shift</kbd> or using the on-screen toggle button,
      then clicking and dragging boards
    </span>
  </div>
</template>
<style scoped></style>
