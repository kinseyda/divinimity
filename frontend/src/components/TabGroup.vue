<script lang="ts">
import { defineComponent, Fragment } from "vue";

export default defineComponent({
  components: {},
  props: {
    titles: {
      type: Array as () => string[],
      required: false,
      default: () => [],
    },
    groupName: { type: String, required: true },
    modelValue: { type: String, required: true },
    disabled: { type: Boolean, required: false, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      activeTab: 0,
    };
  },
  methods: {
    changeTab(index: number) {
      this.activeTab = index;
      this.$emit("update:modelValue", this.titles[index]);
    },
  },
  setup() {
    return {};
  },
});
</script>
<template>
  <div class="tabs tabs-border size-full">
    <template v-for="(tabName, index) in titles" :key="index">
      <input
        type="radio"
        :name="groupName"
        class="tab border-b-2 border-base-100 rounded-b-none grow"
        :aria-label="tabName"
        :checked="index === activeTab"
        @change="changeTab(index)"
        :disabled="disabled"
      />
      <div class="tab-content">
        <slot :name="tabName" />
      </div>
    </template>
  </div>
</template>

<style scoped></style>
