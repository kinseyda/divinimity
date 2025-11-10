<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { BaseState } from "../model/BaseModel";
import {
  ScoreConditionEnum,
  WinConditionEnum,
  type Ruleset,
} from "../../../shared";

export default defineComponent({
  components: {},
  props: {
    ruleset: {
      type: Object as PropType<Ruleset>,
      required: true,
    },
  },
  data() {
    return {};
  },
  emits: {},
  methods: {
    winConditionEnumToString(value: WinConditionEnum): string {
      switch (value) {
        case WinConditionEnum.NoMovesLeft:
          return "Last Player Wins";
        case WinConditionEnum.HighestScore:
          return "Highest Score Wins";
        case WinConditionEnum.LowestScore:
          return "Lowest Score Wins";
        default:
          return "Unknown";
      }
    },
    scoreConditionEnumToString(value: ScoreConditionEnum | undefined): string {
      switch (value) {
        case undefined:
          return "N/A";
        case ScoreConditionEnum.MarkedSquares:
          return "Marked Squares";
        case ScoreConditionEnum.TotalArea:
          return "Total Area";
        default:
          return "Unknown";
      }
    },
  },
  setup() {
    return {};
  },
});
</script>
<template>
  <div>
    <div class="flex flex-col gap-2">
      <div class="text-lg font-bold">Current Game Rules</div>

      <div class="">
        <div class="text-xs font-light">Win Condition</div>
        <div class="text-sm font-bold">
          {{ winConditionEnumToString(ruleset.winCondition) }}
        </div>
      </div>
      <div v-if="ruleset.scoreCondition !== undefined" class="">
        <div class="text-xs font-light">Score Condition</div>
        <div class="text-sm font-bold">
          {{ scoreConditionEnumToString(ruleset.scoreCondition) }}
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
