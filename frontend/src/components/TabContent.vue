<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  components: {},
  props: {
    groupName: { type: String, required: true },
    tabName: { type: String, required: false, default: "Tab" },
    isActive: { type: Boolean, required: false, default: false },
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
  <input
    type="radio"
    :name="groupName"
    class="tab"
    :aria-label="tabName"
    :checked="isActive"
  />
  <div class="tab-content">
    <div class="divider p-2 -m-2" />
    <slot />
  </div>
</template>

<style scoped></style>
