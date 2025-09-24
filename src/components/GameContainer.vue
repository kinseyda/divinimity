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
import { Game, type Board, type Player } from "../model/Game";
import { getDaisyUIColor } from "../utils/StyleUtils";
import {
  randomBoard,
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
  const radius = 500;
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
    newGame() {
      const boards = [] as Board[];
      boards.push(randomBoard());
      boards.push(randomBoard());
      boards.push(randomBoard());
      boards.push(randomBoard());

      const testGame = new Game(
        new VisualState([], boards, (slice, boardUUID) => {
          const board = testGame.getState().boards[boardUUID];
          if (!board) return;
          testGame.playTurn({
            player: {} as Player,
            action: { board, slice },
          });
        })
      );
      this.gameState = testGame.getState();
    },
    redrawFunc(event: RedrawEvent, project: paper.Project, view: paper.View) {
      if (!this.gameState) return;

      // console.log("Redrawing with state:", state);
      const primaryColor = new paper.Color(getDaisyUIColor("--color-primary"));
      const secondaryColor = new paper.Color(
        getDaisyUIColor("--color-secondary")
      );
      const accentColor = new paper.Color(getDaisyUIColor("--color-accent"));
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
        const initialPositions = placeAroundCenter(
          paperBoards,
          new paper.Point(0, 0)
        );
        paperBoards.forEach((board, index) => {
          board.position = initialPositions[index];
        });

        this.gameState!.sliceTool.activate();
      } else {
        // Update positions based on forces
        // Center point attraction
        const centerPoint = new paper.Point(0, 0);
        // Center line attraction
        //   const centerPoint = centerLine(view);

        this.gameState.updatePositions(event.delta, centerPoint);
      }

      const groups = [] as paper.Group[];
      const overlayGroup = new paper.Group();
      for (const board of paperBoards) {
        const boardGroup = board.renderToGroup(
          errorColor,
          baseColor,
          primaryColor
        );
        groups.push(boardGroup);

        // Add the slice marker if active
        if (this.gameState.sliceIndicator) {
          const { boardUUID, direction, index } = this.gameState.sliceIndicator;
          const board = this.gameState.paperBoards[boardUUID];
          if (board) {
            const sliceMarker = this.gameState.renderSliceIndicator(
              boardUUID,
              direction,
              index,
              infoColor,
              10
            );
            if (sliceMarker) {
              overlayGroup.addChild(sliceMarker);
            }
          }
        }
      }

      if (!this.gameState!.selectedBoardUUID) {
        // If no board is being dragged, fit all boards in view

        // Disable the overlay groups, they cause issues with bounds calculation
        overlayGroup.visible = false;

        // Translate view to center
        const allBounds = project.activeLayer.bounds;
        project.view.center = allBounds.center;
        // Zoom to fit all boards with some padding
        const vScaleFactor = view.size.width / allBounds.width;
        const hScaleFactor = view.size.height / allBounds.height;
        const scaleFactor = Math.min(vScaleFactor, hScaleFactor) * 0.9; // Add some padding

        project.view.zoom *= scaleFactor;
        this.gameState!.zoomLevel = project.view.zoom;

        // Re-enable overlay group
        overlayGroup.visible = true;
      } else {
        // If a board is being dragged, don't adjust the view
        project.view.zoom = this.gameState!.zoomLevel;
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

      const underlayGroup = new paper.Group();
      // Simple axis underlay
      underlayGroup.addChild(
        new paper.Path.Line(
          new paper.Point(-10000, 0),
          new paper.Point(10000, 0)
        )
      );
      underlayGroup.addChild(
        new paper.Path.Line(
          new paper.Point(0, -10000),
          new paper.Point(0, 10000)
        )
      );
      underlayGroup.strokeColor = baseColor;
      underlayGroup.strokeWidth = 5;
      underlayGroup.sendToBack();
      overlayGroup.bringToFront();
    },
  },
};
</script>
<template>
  <button class="btn btn-lg btn-primary fixed m-10" @click="newGame">
    New Game
  </button>
  <PaperCanvasFull :redrawFunction="redrawFunc" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
