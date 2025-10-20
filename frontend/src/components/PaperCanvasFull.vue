<template>
  <div ref="paperCanvasContainer" class="size-full relative">
    <canvas ref="paperCanvas" resize class="absolute inset-0" />
  </div>
</template>

<script lang="ts">
import paper from "paper";
import type { RedrawEvent } from "../model/VisualModel";
import { defineComponent } from "vue";

export default defineComponent({
  data() {
    return {};
  },
  props: {
    redrawFunction: {
      type: Function, // Expects type (event: RedrawEvent, project: paper.Project, view: paper.View) => void
      required: true,
    },
  },
  methods: {
    updateDrawing(
      event: RedrawEvent,
      project: paper.Project,
      view: paper.View
    ) {
      // Clear the canvas
      paper.project.clear();
      // Call the redraw function passed as a prop
      this.redrawFunction(event, project, view);
    },
  },
  mounted() {
    paper.setup(this.$refs.paperCanvas as HTMLCanvasElement);

    paper.view.onFrame = (event: RedrawEvent) => {
      // Call the redraw function with the event, project, and view
      this.updateDrawing(event, paper.project, paper.view);
    };

    window.addEventListener("resize", () => {
      paper.view.viewSize = new paper.Size(
        (this.$refs.paperCanvas as HTMLCanvasElement).clientWidth,
        (this.$refs.paperCanvas as HTMLCanvasElement).clientHeight
      );
      paper.view.update();
    });
  },
});
</script>

<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
