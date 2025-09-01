<script lang="ts">
import PaperCanvas from "./PaperCanvas.vue";

import { useStore } from "@nanostores/vue";
import paper from "paper";
import type { RedrawEvent } from "../utils/PaperUtils";
import { getDaisyUIColor } from "../utils/StyleUtils";

interface State {}

export default {
  components: {
    PaperCanvas,
  },
  data() {
    return {};
  },
  props: {},
  methods: {
    redrawFunc(
      state: State
    ): (event: RedrawEvent, project: paper.Project, view: paper.View) => void {
      return (event: RedrawEvent, project: paper.Project, view: paper.View) => {
        // Clear the canvas
        project.activeLayer.removeChildren();

        const primaryColor = new paper.Color(
          getDaisyUIColor("--color-primary")
        );
        const secondaryColor = new paper.Color(
          getDaisyUIColor("--color-secondary")
        );

        project.activeLayer.addChildren([
          new paper.Path.Circle({
            center: view.center,
            radius: 1000,
            fillColor: primaryColor,
          }),
        ]);
      };
    },
  },
  setup() {
    // const $backgroundOptions = useStore(backgroundOptions);
    return {
      //   backgroundOptions: $backgroundOptions,
    };
  },
};
</script>
<template>
  <PaperCanvas class="w-full h-full" :redrawFunction="redrawFunc({})" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
