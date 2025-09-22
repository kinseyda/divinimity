<script lang="ts">
// General visual behaviour: Boards are placed in a circle around the center at
// first. Boards repel each other. Boards are attracted to the center of the
// canvas (might need to make this a center-line if the canvas is very wide).
// Boards cannot be moved by user interaction. Splitting a board creates a new
// board *where expected*. This means that if a m x n board is sliced vertically
// at x, the first tile of the new board should be first positioned at x+1,
// visually identical to before the slice until the repulsion force acts on it.

import PaperCanvasFull from "./PaperCanvasFull.vue";

import paper from "paper";
import { Game, newBoard } from "../model/Game";
import { getDaisyUIColor } from "../utils/StyleUtils";
import {
  VisualState,
  type BoardData,
  type PaperBoard,
  type RedrawEvent,
} from "./PaperUtils";

function centerLine(view: paper.View): paper.Path.Line {
  const width = view.size.width;
  const height = view.size.height;

  if (height > width) {
    const verticalPad = width / 2;
    return new paper.Path.Line({
      from: new paper.Point(view.center.x, verticalPad),
      to: new paper.Point(view.center.x, height - verticalPad),
    });
  } else {
    const horizontalPad = height / 2;
    return new paper.Path.Line({
      from: new paper.Point(horizontalPad, view.center.y),
      to: new paper.Point(width - horizontalPad, view.center.y),
    });
  }
}

function placeAroundCenter(
  boards: PaperBoard[],
  center: paper.Point
): paper.Point[] {
  const positions: paper.Point[] = [];
  const angleStep = (2 * Math.PI) / boards.length;
  const radius = 300;
  // offset randomly to avoid exact horizontal/vertical alignment, makes for faster stabilization
  const offset = Math.random() * Math.PI * 2;
  for (let i = 0; i < boards.length; i++) {
    const angle = i * angleStep + offset;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    positions.push(new paper.Point(x, y));
  }

  return positions;
}

export default {
  components: {
    PaperCanvasFull,
  },
  data() {
    return {
      gameState: null as VisualState | null,
    };
  },
  props: {},
  methods: {
    onMouseDown(event: paper.MouseEvent) {
      this.startBoardDrag(event);
    },
    startBoardDrag(event: paper.MouseEvent) {
      // Identify if a board was clicked
      const hitBoard = paper.project.hitTest(event.point, {
        fill: true,
        tolerance: 5,
      });
      if (hitBoard) {
        // The group is not hit, its children are. So get the parent
        const boardGroup = hitBoard.item.parent as paper.Group;
        const boardData = boardGroup.data as BoardData | undefined;
        if (!boardData) return;
        const uuid = boardData.boardUUID;
        const board = this.gameState?.paperBoards[uuid];
        if (!board) return;

        // Set the selected board UUID in the game state
        this.gameState!.selectedBoardUUID = uuid;

        // Move the board to the mouse position
        board.position = event.point;
      }
    },
    onMouseDrag(event: paper.MouseEvent) {
      if (!this.gameState!.selectedBoardUUID) return;
      const board =
        this.gameState!.paperBoards[this.gameState!.selectedBoardUUID];
      if (!board) return;

      // Move the board to the mouse position
      board.position = event.point;
    },
    onMouseUp(event: paper.MouseEvent) {
      this.gameState!.selectedBoardUUID = null;
    },
    redrawFunc(event: RedrawEvent, project: paper.Project, view: paper.View) {
      // console.log("Redrawing with state:", state);
      const primaryColor = new paper.Color(getDaisyUIColor("--color-primary"));
      const secondaryColor = new paper.Color(
        getDaisyUIColor("--color-secondary")
      );
      const warningColor = new paper.Color(getDaisyUIColor("--color-warning"));
      const successColor = new paper.Color(getDaisyUIColor("--color-success"));
      const errorColor = new paper.Color(getDaisyUIColor("--color-error"));
      const infoColor = new paper.Color(getDaisyUIColor("--color-info"));
      const baseColor = new paper.Color(getDaisyUIColor("--color-base-300"));

      const paperBoards = Object.values(this.gameState!.paperBoards);

      if (
        paperBoards.every(
          (board) => board.position.x === -1 && board.position.y === -1
        )
      ) {
        // Initial placement around center if all positions are uninitialized
        const center = view.center;
        const initialPositions = placeAroundCenter(paperBoards, center);
        paperBoards.forEach((board, index) => {
          board.position = initialPositions[index];
        });

        const t = new paper.Tool();
        t.onMouseDown = this.onMouseDown;
        t.onMouseDrag = this.onMouseDrag;
        t.onMouseUp = this.onMouseUp;
        t.activate();
      } else {
        // Update positions based on forces
        // Center point attraction
        const centerPoint = view.center;
        // Center line attraction
        //   const centerPoint = centerLine(view);

        this.gameState.updatePositions(event.delta, centerPoint);
      }

      const groups = [] as paper.Group[];
      for (const board of paperBoards) {
        const boardGroup = board.draw(errorColor, baseColor, primaryColor);
        groups.push(boardGroup);
      }
      project.activeLayer.addChildren(groups);
      if (!this.gameState!.selectedBoardUUID) {
        // If no board is being dragged, fit all boards in view
        // Translate to center
        const allBounds = project.activeLayer.bounds;
        const centerOffset = view.center.subtract(allBounds.center);
        project.activeLayer.translate(centerOffset);

        // Scale
        const vScaleFactor = view.size.width / allBounds.width;
        const hScaleFactor = view.size.height / allBounds.height;
        const scaleFactor = Math.min(vScaleFactor, hScaleFactor) * 0.9; // Add some padding
        view.zoom *= scaleFactor;
        this.gameState!.zoomLevel = view.zoom;
      } else {
        // If a board is being dragged, ensure the zoom level remains constant
        view.zoom = this.gameState!.zoomLevel;
      }

      if (this.gameState!.selectedBoardUUID) {
        // Ensure the dragged board is fully visible
        const selectedBoard =
          this.gameState!.paperBoards[this.gameState!.selectedBoardUUID];
        if (selectedBoard) {
          groups
            .find((g) => (g.data as BoardData).boardUUID === selectedBoard.uuid)
            ?.bringToFront();
        }
      }
    },
  },
  setup() {
    const testBoard1 = newBoard({ width: 5, height: 3 }, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    const testBoard2 = newBoard({ width: 3, height: 5 }, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);

    const testBoard3 = newBoard({ width: 7, height: 3 }, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    const testBoard4 = newBoard({ width: 2, height: 4 }, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    const testGame = new Game(
      new VisualState([], [testBoard1, testBoard2, testBoard3, testBoard4])
    );

    return {
      gameState: testGame.getState(),
    };
  },
};
</script>
<template>
  <PaperCanvasFull :redrawFunction="redrawFunc" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
