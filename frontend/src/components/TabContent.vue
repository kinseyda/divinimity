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
    class="tab border-b-2 border-base-100 rounded-b-none"
    :aria-label="tabName"
    :checked="isActive"
  />
  <div class="tab-content">
    <slot />
  </div>
</template>

<style scoped></style>
