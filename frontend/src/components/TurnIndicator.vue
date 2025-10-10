<script lang="ts">
import { defineComponent, type PropType } from "vue";

export enum PlayerState {
  GameNotStarted,
  WaitingForOpponent,
  YourTurn,
  YouWin,
  YouLose,
  YouDraw,
}

export default defineComponent({
  components: {},
  props: {
    playerState: {
      type: Number as PropType<PlayerState>,
      required: true,
    },
  },
  data() {
    return { PlayerState };
  },
  emits: {},
  methods: {},
  setup() {
    return {};
  },
});
</script>
<template>
  <div
    :class="
      playerState === PlayerState.YourTurn
        ? 'alert-info'
        : playerState === PlayerState.YouWin
        ? 'alert-success'
        : playerState === PlayerState.YouLose
        ? 'alert-error'
        : 'alert-warning'
    "
    class="alert shadow-xl"
  >
    <div class="flex flex-col">
      <div v-if="playerState === PlayerState.GameNotStarted">
        Game not started
      </div>
      <div v-else-if="playerState === PlayerState.WaitingForOpponent">
        <span class="loading loading-spinner loading-xs"></span> Waiting for
        opponent...
      </div>
      <div v-else-if="playerState === PlayerState.YourTurn">Your turn</div>
      <div v-else-if="playerState === PlayerState.YouWin">You win</div>
      <div v-else-if="playerState === PlayerState.YouLose">You lose</div>
      <div v-else-if="playerState === PlayerState.YouDraw">It's a draw</div>
    </div>
  </div>
</template>

<style scoped></style>
