<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { ScoreCondition, WinCondition } from "../../../shared";

export default defineComponent({
  components: {},
  props: {
    winConditions: {
      type: Array as PropType<WinCondition[]>,
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
  <div class="flex flex-col gap-1">
    <span class="font-bold text-lg">Current Game Rules:</span>
    <ul class="list-disc list-inside">
      <li>
        Win condition: {{ winConditions[0] }}
        <ul>
          <li>
            {{ winConditions[0] }}
          </li>
        </ul>
      </li>
      <li v-if="scoreConditions.length > 0">
        Scoring: {{ scoreConditions[0] }}
        <ul>
          <li>
            {{ scoreConditions[0] }}
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
  </div>
</template>
<style scoped></style>
