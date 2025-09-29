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
      visualPlayer: null as VisualPlayer | null,
    };
  },
  props: {},
  mounted() {
    this.newGame();
  },
  methods: {
    actionToString(action: Action): string {
      return actionToString(action);
    },
    winnerString(): string {
      if (!this.game) return "";
      const winnerInfos = this.game.winners;
      if (winnerInfos.length === 0) return "";
      if (winnerInfos.length === 1) {
        if (winnerInfos[0] === this.visualPlayer?.info) {
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
      return winnerInfos.includes(this.visualPlayer?.info!);
    },
    newGame() {
      const boards = [] as Board[];
      for (let i = 0; i < Math.floor(Math.random() * 3 + 1); i++) {
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

      const visualPlayer = new VisualPlayer("User", 0, getActionCallback);
      this.visualPlayer = visualPlayer;
      const randomPlayer = new RandomPlayer(1);

      const testGame = new Game<VisualState>(
        new VisualState(
          [visualPlayer.info, randomPlayer.info],
          boards,
          actionCallback
        ),
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

        const board = this.game!.getState().boards[hitBoard.uuid];
        if (!board) {
          throw new Error("Board not found in state");
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
      const base200Color = new paper.Color(getDaisyUIColor("--color-base-200"));
      const base300Color = new paper.Color(getDaisyUIColor("--color-base-300"));
      const baseContentColor = new paper.Color(
        getDaisyUIColor("--color-base-content")
      );
      const neutralColor = new paper.Color(getDaisyUIColor("--color-neutral"));

      const paperBoards = Object.values(this.game!.getState().paperBoards);

      const groups = [] as paper.Group[];
      const overlayGroup = new paper.Group();
      const underlayGroup = new paper.Group();
      let zoomToFit = false;
      let axisLine = false;

      if (paperBoards.length === 0) {
        // The game is over, display the winner(s)
        const winnerText = this.winnerString();
        const textItem = new paper.PointText({
          point: new paper.Point(0, 0),
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

        for (const board of paperBoards) {
          const boardGroup = board.renderToGroup(
            primaryColor,
            base200Color,
            base300Color,
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
                16
              );
              if (sliceMarker) {
                overlayGroup.addChild(sliceMarker);
              }
            }
          }
        }

        zoomToFit = !this.game!.getState().selectedBoardUUID;

        if (this.game!.getState().selectedBoardUUID) {
          // Ensure the dragged board is fully visible
          const selectedBoard =
            this.game!.getState().paperBoards[
              this.game!.getState().selectedBoardUUID!
            ];
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
        // Use the stored zoom level
        project.view.zoom = this.game!.getState().zoomLevel;
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
        underlayGroup.strokeColor = base300Color;
        underlayGroup.strokeWidth = 5;
      }

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

  <div class="fixed m-10 flex gap-4 right-0 bottom-0 flex-col items-end">
    <span class="btn btn-lg btn-ghost">Hold Shift to drag boards</span>
    <span class="btn btn-lg btn-ghost"
      >Click on grid lines to slice boards</span
    >
  </div>
  <div class="fixed m-10 flex gap-4 right-0 flex-col items-end">
    <details class="collapse collapse-arrow bg-base-100 border-base-300 border">
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
              v-for="(entry, index) in game?.getState().turnHistory"
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

  <PaperCanvasFull :redrawFunction="redrawFunc" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
