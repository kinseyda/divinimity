<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  components: {},
  props: {
    styleType: { type: String, required: false, default: "border" },
    styleSize: { type: String, required: false, default: "xl" },
  },
  emits: {},
  data() {
    return {};
  },
  methods: {},
  setup() {
    return {};
  },
});
</script>
<template>
  <div
    :class="`tabs tabs-${styleType} tabs-${styleSize} **:shadow-none size-full flex flex-row *:grow *:text-${styleSize}`"
  >
    <slot />
  </div>
</template>

<style scoped></style>
