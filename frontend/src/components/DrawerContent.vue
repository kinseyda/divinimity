<script lang="ts">
import { X, ChevronLeft, ChevronRight } from "lucide-vue-next";

export default {
  components: {
    XMarkIcon: X,
    ChevronLeftIcon: ChevronLeft,
    ChevronRightIcon: ChevronRight,
  },
  props: {
    drawerId: {
      type: String,
      required: true,
    },
    drawerTitle: {
      type: String,
      required: true,
    },
    drawerLeft: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: {},
  data() {
    return {};
  },
  methods: {},
  setup() {
    return {};
  },
};
</script>
<template>
  <div
    class="drawer lg:drawer-open size-full"
    :class="drawerLeft ? '' : 'drawer-end'"
  >
    <input :id="drawerId" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content size-full">
      <!-- Content beside the drawer goes here -->
      <div class="size-full">
        <label
          :for="drawerId"
          class="fab lg:hidden btn btn-lg btn-primary btn-circle drawer-button bottom-0 m-4 z-1"
          :class="{ 'left-0': drawerLeft, 'right-0': !drawerLeft }"
        >
          <slot name="fabIcon" />
        </label>
        <div class="size-full relative">
          <slot name="content" />
        </div>
      </div>
    </div>
    <div class="drawer-side size-full">
      <!-- using size-full here because the daisyUi drawer-side class sets the
      height to 100vh -->
      <label :for="drawerId" class="drawer-overlay"></label>
      <div
        class="bg-base-200 z-50 w-xs p-4 gap-4 h-full flex flex-col"
        :class="{ 'left-0': drawerLeft, 'right-0': !drawerLeft }"
      >
        <!-- Drawers on the right don't work without setting them to fixed positioning -->
        <span
          :class="{ 'flex-row-reverse': !drawerLeft }"
          class="flex justify-between items-center lg:flex-row"
        >
          <h2 class="text-2xl font-bold">{{ drawerTitle }}</h2>
          <label
            class="btn btn-ghost btn-square lg:hidden *:size-full"
            :for="drawerId"
          >
            <ChevronLeftIcon v-if="drawerLeft" />
            <ChevronRightIcon v-else />
          </label>
        </span>
        <div class="size-full">
          <slot name="drawerContent" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
