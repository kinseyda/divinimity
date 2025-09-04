<script lang="ts">
import PaperCanvasFull from "./PaperCanvasFull.vue";

import paper from "paper";
import type { RedrawEvent } from "../utils/PaperUtils";
import { getDaisyUIColor } from "../utils/StyleUtils";
import { Game, newBoard, VisualState, type Board } from "../model/Game";

const tileSize = { width: 100, height: 100 }; // Pixel size of each tile

function drawBoard(board: Board): paper.Path[] {
  const paths: paper.Path[] = [];
  for (let x = 0; x < board.dimensions.width; x++) {
    for (let y = 0; y < board.dimensions.height; y++) {
      const isMarked = board.markedCoordinates.some(
        (coord) => coord.x === x && coord.y === y
      );
      const rect = new paper.Path.Rectangle({
        point: [x * tileSize.width, y * tileSize.height],
        size: [tileSize.width, tileSize.height],
        fillColor: isMarked ? new paper.Color("red") : new paper.Color("white"),
        strokeColor: new paper.Color("black"),
        strokeWidth: 2,
      });
      paths.push(rect);
    }
  }
  return paths;
}

export default {
  components: {
    PaperCanvasFull,
  },
  data() {
    return {};
  },
  props: {},
  methods: {
    redrawWithTestState() {
      const testBoard = newBoard({ width: 10, height: 5 }, [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]);
      const testGame = new Game(new VisualState([], [testBoard]));
      return this.redrawFunc(testGame.getState());
    },
    redrawFunc(
      state: VisualState
    ): (event: RedrawEvent, project: paper.Project, view: paper.View) => void {
      return (event: RedrawEvent, project: paper.Project, view: paper.View) => {
        const primaryColor = new paper.Color(
          getDaisyUIColor("--color-primary")
        );
        const secondaryColor = new paper.Color(
          getDaisyUIColor("--color-secondary")
        );

        const boards = state.boards;
        const positions = state.boardPositions;

        const paths = [] as paper.Path[];

        for (const [index, board] of boards.entries()) {
          // Example: Draw a rectangle for each board at its position
          // You may need to adjust properties based on your board structure
          const position = positions[index];

          const boardPaths = drawBoard(board);
          boardPaths.forEach((path) => {
            path.position.x += position.x;
            path.position.y += position.y;
          });

          paths.push(...boardPaths);
        }

        // Redraw the active layer
        project.activeLayer.removeChildren();
        project.activeLayer.addChildren(paths);
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
  <PaperCanvasFull :redrawFunction="redrawWithTestState()" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
