<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { BaseState } from "../model/BaseModel";

export default defineComponent({
  components: {},
  props: {
    gameState: {
      type: Object as PropType<BaseState>,
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
  <span>Current Game Rules:</span>
  <ul>
    <li>
      Win condition: {{ gameState.winConditions[0].name }}
      <ul>
        <li>
          {{ gameState.winConditions[0].description }}
        </li>
      </ul>
    </li>
    <li v-if="gameState.scoreConditions.length > 0">
      Scoring: {{ gameState.scoreConditions[0].name }}
      <ul>
        <li>
          {{ gameState.scoreConditions[0].description }}
        </li>
      </ul>
    </li>
    <li v-else>Scoring: None</li>
  </ul>
  <span class="divider" />
  <span>Slice boards by clicking and dragging</span>
  <span>Last player to take a turn wins</span>
  <span>
    Rearrange boards by holding
    <kbd class="kbd kbd-xs">Shift</kbd> or using the on-screen toggle button,
    then clicking and dragging boards
  </span>
</template>
<style scoped></style>
