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
import {
  Game,
  RandomPlayer,
  type Action,
  type Board,
  type PlayerInfo,
  type Slice,
} from "../model/Game";
import { getDaisyUIColor } from "../utils/StyleUtils";
import {
  pointTileQuadrant,
  randomBoard,
  tileQuadrantToSlice,
  VisualPlayer,
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
      game: null as Game<VisualState> | null,
      sliceTool: null as paper.Tool | null,
      dragTool: null as paper.Tool | null,
    };
  },
  props: {},
  methods: {
    newGame() {
      const boards = [] as Board[];
      for (let i = 0; i < 1; i++) {
        boards.push(randomBoard());
      }
      // We'll use a Promise and its resolver to "pipe" between getActionCallback
      // and actionCallback. When getActionCallback is called, it returns a
      // Promise<Action> and stores its resolver. When actionCallback is called
      // (by the slice tool), it resolves the stored Promise.

      let resolveAction: ((action: Action) => void) | null = null;

      // The actionCallback will be called inside the slice tool's onMouseDown
      // function. It shall resolve the getActionCallback promise
      const actionCallback = (slice: Slice, board: Board) => {
        if (resolveAction) {
          resolveAction({ slice, board });
          resolveAction = null;
        }
      };

      // The getActionCallback will be used when the player needs to make a
      // turn. It shall just wait for the slice tool to be used, returns a
      // promise of an action.
      const getActionCallback = (state: VisualState) => {
        return new Promise<Action>((resolve) => {
          resolveAction = resolve;
        });
      };

      const visualPlayer = new VisualPlayer("p1", 0, getActionCallback);
      const randomPlayer = new RandomPlayer(1);

      const testGame = new Game<VisualState>(
        new VisualState([], boards, actionCallback),
        [visualPlayer, randomPlayer]
      );

      const startBoardDrag = (event: paper.MouseEvent) => {
        const hitBoard = this.game!.getState().hitTestPaperBoard(event.point);
        if (!hitBoard) return;
        // Set the selected board UUID in the game state
        this.game!.getState().selectedBoardUUID = hitBoard.uuid;

        // Move the board to the mouse position
        hitBoard.position = event.point;
      };
      const dragBoard = (event: paper.MouseEvent) => {
        if (!this.game!.getState().selectedBoardUUID) return;
        const board =
          this.game!.getState().paperBoards[
            this.game!.getState().selectedBoardUUID!
          ];
        if (!board) return;

        // Move the board to the mouse position
        board.position = event.point;
      };
      const endBoardDrag = (event: paper.MouseEvent) => {
        this.game!.getState().selectedBoardUUID = null;
      };

      const dragTool = new paper.Tool();
      dragTool.onMouseDown = startBoardDrag;
      dragTool.onMouseDrag = dragBoard;
      dragTool.onMouseUp = endBoardDrag;

      const sliceTool = new paper.Tool();
      sliceTool.onMouseMove = (event: paper.MouseEvent) => {
        // If the mouse is over a board, indicate where a slice will be made if you click
        const hitBoard = this.game!.getState().hitTestPaperBoard(event.point);
        if (hitBoard) {
          const ptq = pointTileQuadrant(hitBoard, event.point);
          if (ptq) {
            const slice = tileQuadrantToSlice(ptq.tile, ptq.quadrant);
            this.game!.getState().sliceIndicator = {
              boardUUID: hitBoard.uuid,
              direction: slice.direction,
              index: slice.line,
            };
          } else {
            this.game!.getState().sliceIndicator = null;
          }
        } else {
          this.game!.getState().sliceIndicator = null;
        }
      };
      sliceTool.onMouseDown = (event: paper.MouseEvent) => {
        // If the mouse is over a board, make a slice
        const hitBoard = this.game!.getState().hitTestPaperBoard(
          event.point
        ) as PaperBoard;
        if (!hitBoard) return;

        const ptq = pointTileQuadrant(hitBoard, event.point);
        if (!ptq) return;

        const slice = tileQuadrantToSlice(ptq.tile, ptq.quadrant);
        console.log(
          `Slice made: ${JSON.stringify(slice)} on board ${hitBoard.uuid}`
        );
        const board = this.game!.getState().boards[hitBoard.uuid];
        console.log("Board data:", board);
        if (!board) {
          console.warn("Board not found in game state:", hitBoard.uuid);
          console.log(
            "Current game state boards:",
            this.game!.getState().boards
          );
          console.log(
            "Current game state paperBoards:",
            this.game!.getState().paperBoards
          );
          return;
        }
        this.game!.getState().actionCallBack(slice, board);
      };

      const switchToSlice = (event: paper.KeyEvent) => {
        if (event.key === "shift") {
          // If shift is released, stop dragging
          this.game!.getState().selectedBoardUUID = null;
          sliceTool.activate();
        }
      };
      const switchToDrag = (event: paper.KeyEvent) => {
        if (event.key === "shift") {
          // If shift is pressed, start dragging
          this.game!.getState().sliceIndicator = null;
          dragTool.activate();
        }
      };
      dragTool.onKeyUp = switchToSlice;
      dragTool.onKeyDown = switchToDrag;
      sliceTool.onKeyUp = switchToSlice;
      sliceTool.onKeyDown = switchToDrag;

      this.sliceTool = sliceTool;
      this.dragTool = dragTool;

      this.game = testGame;
      this.game.playLoop();
    },
    shuffleBoards() {
      if (!this.game) return;
      this.game.getState().shuffleBoards(paper.view.size);
    },
    redrawFunc(event: RedrawEvent, project: paper.Project, view: paper.View) {
      if (!this.game) return;

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
      const baseContentColor = new paper.Color(
        getDaisyUIColor("--color-base-content")
      );
      const neutralColor = new paper.Color(getDaisyUIColor("--color-neutral"));

      const paperBoards = Object.values(this.game!.getState().paperBoards);

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

        this.sliceTool!.activate();
      } else {
        // Update positions based on forces
        // Center point attraction
        const centerPoint = new paper.Point(0, 0);
        // Center line attraction
        //   const centerPoint = centerLine(view);

        this.game!.getState().updatePositions(event.delta, centerPoint);
      }

      const groups = [] as paper.Group[];
      const overlayGroup = new paper.Group();
      for (const board of paperBoards) {
        const boardGroup = board.renderToGroup(
          primaryColor,
          baseColor,
          baseContentColor
        );
        groups.push(boardGroup);

        // Add the slice marker if active
        if (this.game!.getState().sliceIndicator) {
          const { boardUUID, direction, index } =
            this.game!.getState().sliceIndicator!;
          const board = this.game!.getState().paperBoards[boardUUID];
          if (board) {
            const sliceMarker = this.game!.getState().renderSliceIndicator(
              boardUUID,
              direction,
              index,
              secondaryColor,
              10
            );
            if (sliceMarker) {
              overlayGroup.addChild(sliceMarker);
            }
          }
        }
      }

      if (!this.game!.getState().selectedBoardUUID) {
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
        this.game!.getState().zoomLevel = project.view.zoom;

        // Re-enable overlay group
        overlayGroup.visible = true;
      } else {
        // If a board is being dragged, don't adjust the view
        project.view.zoom = this.game!.getState().zoomLevel;
      }

      if (this.game!.getState().selectedBoardUUID) {
        // Ensure the dragged board is fully visible
        const selectedBoard =
          this.game!.getState().paperBoards[
            this.game!.getState().selectedBoardUUID!
          ];
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
  <div class="fixed m-10 flex gap-4">
    <button class="btn btn-lg btn-primary" @click="newGame">New Game</button>
    <button class="btn btn-lg btn-primary" @click="shuffleBoards">
      Shuffle boards
    </button>
  </div>
  <PaperCanvasFull :redrawFunction="redrawFunc" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
