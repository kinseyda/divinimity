<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type {
  BaseState,
  ScoreCondition,
  WinCondition,
} from "../model/BaseModel";

export default defineComponent({
  components: {},
  props: {
    winConditions: {
      type: Array as PropType<WinCondition<BaseState>[]>,
      required: true,
    },
    scoreConditions: {
      type: Array as PropType<ScoreCondition[]>,
      required: true,
    },
  },
  data() {
    return {};
  },
  emits: {},
  methods: {},
  setup() {
    return {};
  },
});
</script>
<template>
  <span class="font-bold text-lg">Current Game Rules:</span>
  <ul>
    <li>
      Win condition: {{ winConditions[0].name }}
      <ul>
        <li>
          {{ winConditions[0].description }}
        </li>
      </ul>
    </li>
    <li v-if="scoreConditions.length > 0">
      Scoring: {{ scoreConditions[0].name }}
      <ul>
        <li>
          {{ scoreConditions[0].description }}
        </li>
      </ul>
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
</template>
<style scoped></style>
