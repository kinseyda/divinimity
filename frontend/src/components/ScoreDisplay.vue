<script lang="ts">
import { defineComponent, type PropType } from "vue";
import { BaseState } from "../model/BaseModel";

export default defineComponent({
  components: {},
  props: {
    gameState: {
      type: BaseState as PropType<BaseState>,
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
  <span class="stats bg-base-200 shadow border-2 border-primary">
    <div
      v-for="player in gameState.players"
      :key="player.uuid"
      class="stat place-items-center p-2"
    >
      <div class="stat-title -mt-2">{{ player.name }}</div>
      <div class="stat-value">
        {{ gameState.scores[player.uuid] || 0 }}
      </div>
    </div>
  </span>
</template>
<style scoped></style>
