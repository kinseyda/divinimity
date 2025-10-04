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
  actionToString,
  Game,
  RandomPlayer,
  type Action,
  type Board,
  type Slice,
} from "../model/BaseModel";
import {
  pointTileQuadrant,
  randomBoard,
  tileQuadrantToSlice,
  VisualPlayer,
  VisualState,
  type BoardData,
  type PaperBoard,
  type RedrawEvent,
} from "../model/VisualModel";
import { getDaisyUIColors } from "../model/StyleUtils";

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
  const radius = 1;
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
      sliceTool: null as paper.Tool | null,
      dragTool: null as paper.Tool | null,
    };
  },
  props: {
    game: {
      type: Object as () => Game<VisualState>,
      required: true,
    },
    interactive: {
      type: Boolean,
      default: false,
    },
  },
  mounted() {
    if (!this.interactive) {
      const emptyTool = new paper.Tool();
      emptyTool.activate();
      this.sliceTool = emptyTool;
      this.dragTool = emptyTool;
    } else {
      this.setUpInteractiveTools();
    }
  },
  methods: {
    setUpInteractiveTools() {
      if (this.interactive) {
        const startBoardDrag = (event: paper.MouseEvent) => {
          const hitBoard = this.game.state.hitTestPaperBoard(event.point);
          if (!hitBoard) return;
          // Set the selected board UUID in the game state
          this.game.state.selectedBoardUUID = hitBoard.uuid;

          // Move the board to the mouse position
          hitBoard.position = event.point;
        };
        const dragBoard = (event: paper.MouseEvent) => {
          if (!this.game.state.selectedBoardUUID) return;
          const board =
            this.game.state.paperBoards[this.game.state.selectedBoardUUID!];
          if (!board) return;

          // Move the board to the mouse position
          board.position = event.point;
        };
        const endBoardDrag = (event: paper.MouseEvent) => {
          this.game.state.selectedBoardUUID = null;
        };

        const dragTool = new paper.Tool();
        dragTool.onMouseDown = startBoardDrag;
        dragTool.onMouseDrag = dragBoard;
        dragTool.onMouseUp = endBoardDrag;

        const sliceTool = new paper.Tool();
        sliceTool.onMouseMove = (event: paper.MouseEvent) => {
          // If the mouse is over a board, indicate where a slice will be made if you click
          const hitBoard = this.game.state.hitTestPaperBoard(event.point);
          if (hitBoard) {
            const ptq = pointTileQuadrant(hitBoard, event.point);
            if (ptq) {
              const slice = tileQuadrantToSlice(ptq.tile, ptq.quadrant);
              this.game.state.sliceIndicator = {
                boardUUID: hitBoard.uuid,
                direction: slice.direction,
                index: slice.line,
              };
            } else {
              this.game.state.sliceIndicator = null;
            }
          } else {
            this.game.state.sliceIndicator = null;
          }
        };
        sliceTool.onMouseDown = (event: paper.MouseEvent) => {
          // If the mouse is over a board, make a slice
          const hitBoard = this.game.state.hitTestPaperBoard(
            event.point
          ) as PaperBoard;
          if (!hitBoard) return;

          const ptq = pointTileQuadrant(hitBoard, event.point);
          if (!ptq) return;

          const slice = tileQuadrantToSlice(ptq.tile, ptq.quadrant);

          const board = this.game.state.boards[hitBoard.uuid];
          if (!board) {
            throw new Error("Board not found in state");
          }
          this.game.state.actionCallBack(slice, board);
        };

        const switchToSlice = (event: paper.KeyEvent) => {
          if (event.key === "shift") {
            // If shift is released, stop dragging
            this.game.state.selectedBoardUUID = null;
            sliceTool.activate();
          }
        };
        const switchToDrag = (event: paper.KeyEvent) => {
          if (event.key === "shift") {
            // If shift is pressed, start dragging
            this.game.state.sliceIndicator = null;
            dragTool.activate();
          }
        };
        dragTool.onKeyUp = switchToSlice;
        dragTool.onKeyDown = switchToDrag;
        sliceTool.onKeyUp = switchToSlice;
        sliceTool.onKeyDown = switchToDrag;

        this.sliceTool = sliceTool;
        this.dragTool = dragTool;
      } else {
        const emptyTool = new paper.Tool();
        emptyTool.activate();
        this.sliceTool = emptyTool;
        this.dragTool = emptyTool;
      }
    },
    actionToString(action: Action): string {
      return actionToString(action);
    },
    getVisualPlayer(): VisualPlayer | null {
      if (!this.game) return null;
      const players = this.game.players.filter(
        (p) => p instanceof VisualPlayer
      ) as VisualPlayer[];
      if (players.length === 0) return null;
      return players[0];
    },
    winnerString(): string {
      if (!this.game) return "";
      const winnerInfos = this.game.winners;
      if (winnerInfos.length === 0) return "";
      if (winnerInfos.length === 1) {
        if (winnerInfos[0] === this.getVisualPlayer()?.info) {
          return `You win!`;
        }
        return `Winner: ${winnerInfos[0].name}`;
      }
      return `Winners: ${winnerInfos.map((p) => p.name).join(", ")}`;
    },
    isWinnerVisualPlayer(): boolean {
      if (!this.game) return false;
      const winnerInfos = this.game.winners;
      if (winnerInfos.length === 0) return false;
      return winnerInfos.includes(this.getVisualPlayer()?.info!);
    },
    shuffleBoards() {
      if (!this.game) return;
      this.game.state.shuffleBoards(paper.view.size);
    },
    redrawFunc(event: RedrawEvent, project: paper.Project, view: paper.View) {
      if (!this.game) return;

      // console.log("Redrawing with state:", state);
      const {
        primary: primaryColor,
        secondary: secondaryColor,
        success: successColor,
        error: errorColor,
        info: infoColor,
        base200: base200Color,
        base300: base300Color,
        baseContent: baseContentColor,
        neutral: neutralColor,
      } = getDaisyUIColors();

      const paperBoards = Object.values(this.game.state.paperBoards);

      const groups = [] as paper.Group[];
      const overlayGroup = new paper.Group();
      const underlayGroup = new paper.Group();
      let zoomToFit = false;
      let axisLine = false;

      if (paperBoards.length === 0) {
        // The game is over, display the winner(s)
        const winnerText = this.winnerString();
        const textItem = new paper.PointText({
          point: new paper.Point(view.center.x, view.center.y + 30),
          justification: "center",
          content: winnerText,
          fillColor: this.isWinnerVisualPlayer() ? successColor : primaryColor,
          fontFamily: "Arial",
          fontWeight: "bold",
          fontSize: 100,
        });
        textItem.bringToFront();
        groups.push(new paper.Group([textItem]));
        zoomToFit = true;
        axisLine = false;
      } else {
        if (
          paperBoards.every(
            (board) => board.position.x === -1 && board.position.y === -1
          )
        ) {
          // Initial placement around center if all positions are uninitialized
          view.center = new paper.Point(0, 0);
          const initialPositions = placeAroundCenter(
            paperBoards,
            new paper.Point(0, 0)
          );
          paperBoards.forEach((board, index) => {
            board.position = initialPositions[index];
          });
          if (this.interactive) {
            this.sliceTool!.activate();
          }
        } else {
          // Update positions based on forces
          // Center point attraction
          const centerPoint = new paper.Point(0, 0);
          // Center line attraction
          //   const centerPoint = centerLine(view);

          this.game.state.updatePositions(event.delta, centerPoint);
        }

        for (const board of paperBoards) {
          const boardGroup = board.renderToGroup(
            new paper.Color(primaryColor),
            new paper.Color(base200Color),
            new paper.Color(base300Color),
            new paper.Color(baseContentColor)
          );
          groups.push(boardGroup);

          // Add the slice marker if active
          if (this.game.state.sliceIndicator) {
            const { boardUUID, direction, index } =
              this.game.state.sliceIndicator!;
            const board = this.game.state.paperBoards[boardUUID];
            if (board) {
              const sliceMarker = this.game.state.renderSliceIndicator(
                boardUUID,
                direction,
                index,
                new paper.Color(secondaryColor),
                16
              );
              if (sliceMarker) {
                overlayGroup.addChild(sliceMarker);
              }
            }
          }
        }

        zoomToFit = !this.game.state.selectedBoardUUID;

        if (this.game.state.selectedBoardUUID) {
          // Ensure the dragged board is fully visible
          const selectedBoard =
            this.game.state.paperBoards[this.game.state.selectedBoardUUID!];
          if (selectedBoard) {
            groups
              .find(
                (g) => (g.data as BoardData).boardUUID === selectedBoard.uuid
              )
              ?.bringToFront();
          }
        }
      }

      if (zoomToFit) {
        // Disable the overlay groups, they cause issues with bounds calculation
        overlayGroup.visible = false;

        // Zooming and panning should be smooth, so we only move part of the way
        // to the target zoom level per second
        const panSpeed = 3;
        const zoomSpeed = 3;
        const timeDelta = event.delta; // Time since last frame in seconds

        // Translate view to center
        const allBounds = project.activeLayer.bounds;
        const targetCenter = allBounds.center;
        const currentCenter = project.view.center;
        project.view.center = currentCenter.add(
          targetCenter.subtract(currentCenter).multiply(panSpeed * timeDelta)
        );
        // Zoom to fit all boards with some padding

        const vScaleFactor = view.size.width / allBounds.width;
        const hScaleFactor = view.size.height / allBounds.height;
        const scaleFactor = Math.min(vScaleFactor, hScaleFactor) * 0.9; // Add some padding

        const targetZoom = project.view.zoom * scaleFactor;
        const diff = targetZoom - project.view.zoom;
        const newZoom = project.view.zoom + diff * (zoomSpeed * timeDelta);

        project.view.zoom = newZoom;
        this.game.state.zoomLevel = newZoom;

        // Re-enable overlay group
        overlayGroup.visible = true;
      } else {
        // Use the stored zoom level
        project.view.zoom = this.game.state.zoomLevel;
      }
      if (axisLine) {
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
        underlayGroup.strokeColor = new paper.Color(base300Color);
        underlayGroup.strokeWidth = 5;
      }

      underlayGroup.sendToBack();
      overlayGroup.bringToFront();
    },
  },
};
</script>
<template>
  <div v-if="interactive">
    <div
      class="fixed m-4 flex gap-4 right-0 bottom-0 flex-col items-end -z-50 *:text-xs"
    >
      <span>Hold Shift to drag boards</span>
      <span>Click on grid lines to slice boards</span>
      <span>Last player to take a turn wins</span>
    </div>
    <div class="fixed m-4 flex gap-4 right-0 flex-col items-end z-1">
      <details
        class="collapse collapse-arrow bg-base-100 border-base-300 border"
      >
        <summary class="collapse-title font-semibold">
          <span v-if="!game?.winners.length"
            >{{ game?.currentPlayer()?.info.name }}'s Turn</span
          >
          <span v-else>Game Over</span>
        </summary>
        <div class="collapse-content max-h-96 overflow-y-auto">
          <table class="table table-xs w-3xs bg-base-200">
            <thead>
              <tr>
                <th>Turn</th>
                <th>Player</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, index) in game?.state.turnHistory"
                :key="index"
              >
                <td>{{ index + 1 }}</td>
                <td>{{ entry.player.name }}</td>
                <td>{{ actionToString(entry.action) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  </div>

  <PaperCanvasFull :redrawFunction="redrawFunc" class="absolute inset-0" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
