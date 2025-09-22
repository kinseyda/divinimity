<script lang="ts">
import { useStore } from "@nanostores/vue";
import { debugStore } from "./DebugStore";
import { XMarkIcon } from "@heroicons/vue/24/outline";

export default {
  components: {
    XMarkIcon,
  },
  props: {
    astroInfo: {
      type: Object as () => Record<string, any>,
      required: true,
    },
  },
  emits: {},
  data() {
    return {};
  },
  methods: {
    closeDebugInfo() {
      debugStore.set({ debugMode: false });
    },
  },
  setup() {
    const $debugOptions = useStore(debugStore);
    return {
      debugOptions: $debugOptions,
    };
  },
};
</script>
<template>
  <div data-allow-mismatch="children">
    <div
      v-if="debugOptions.debugMode"
      class="fixed bottom-0 right-0 m-4 p-2 bg-base-200 bg-opacity-75 rounded-lg text-sm z-50"
    >
      <div
        class="absolute btn btn-ghost btn-xs btn-square top-2 right-2"
        @click="closeDebugInfo"
      >
        <XMarkIcon class="h-6 w-6" />
      </div>
      <div>Debug Mode is ON</div>
      <div>
        <table class="table-auto">
          <tbody>
            <tr v-for="(value, key) in astroInfo" :key="key">
              <td class="pr-2 font-bold">{{ key }}</td>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
