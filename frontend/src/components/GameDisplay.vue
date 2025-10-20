<script lang="ts">
// General visual behaviour: Boards are placed in a circle around the center at
// first. Boards repel each other. Boards are attracted to the center of the
// canvas (might need to make this a center-line if the canvas is very wide).
// Boards cannot be moved by user interaction. Splitting a board creates a new
// board *where expected*. This means that if a m x n board is sliced vertically
// at x, the first tile of the new board should be first positioned at x+1,
// visually identical to before the slice until the repulsion force acts on it.

import PaperCanvasFull from "./PaperCanvasFull.vue";

import { MoveIcon } from "lucide-vue-next";
import paper from "paper";
import { defineComponent } from "vue";
import { Direction, Game } from "../model/BaseModel";
import { getDaisyUIColors } from "../model/StyleUtils";
import {
  PaperBoard,
  pointTileQuadrant,
  tileQuadrantToSlice,
  VisualPlayer,
  VisualState,
  type BoardData,
  type RedrawEvent,
} from "../model/VisualModel";
import TurnIndicator, { PlayerState } from "./TurnIndicator.vue";
import ScoreDisplay from "./ScoreDisplay.vue";

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

enum ToolType {
  Slice,
  Drag,
}

export default defineComponent({
  components: {
    PaperCanvasFull,
    TurnIndicator,
    ScoreDisplay,
    MoveIcon,
  },
  data() {
    return {
      sliceTool: null as paper.Tool | null,
      dragTool: null as paper.Tool | null,
      curTool: ToolType.Slice as ToolType,
      ToolType,
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
    newDragTool() {
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

      return dragTool;
    },
    newHoverSliceTool() {
      // Slice by clicking directly on a grid line. Hovering will show a
      // preview of the slice.
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
      return sliceTool;
    },
    newDragSliceTool() {
      // Click and drag to create a straight line across the screen. The first
      // board it passes through is sliced, along the closest grid line to the
      // line.
      // VisualState has a lineIndicator attribute for this.

      const sliceDragTool = new paper.Tool();

      sliceDragTool.onMouseDown = (event: paper.MouseEvent) => {
        this.game.state.lineIndicator = {
          start: event.point,
          end: event.point,
        };
      };

      sliceDragTool.onMouseDrag = (event: paper.MouseEvent) => {
        if (!this.game.state.lineIndicator) return;
        this.game.state.lineIndicator.end = event.point;

        // If the line passes through a board, highlight the closest grid line
        // to the line by setting sliceIndicator

        const line = new paper.Path.Line(
          this.game.state.lineIndicator.start,
          this.game.state.lineIndicator.end
        );
        const hitBoard = this.game.state.hitTestLinePaperBoard(line);
        if (!hitBoard) {
          this.game.state.sliceIndicator = null;
          return;
        }

        // Is the line more horizontal or vertical?
        const isHorizontal =
          Math.abs(
            this.game.state.lineIndicator.end.x -
              this.game.state.lineIndicator.start.x
          ) >=
          Math.abs(
            this.game.state.lineIndicator.end.y -
              this.game.state.lineIndicator.start.y
          );

        const { height: tileHeight, width: tileWidth } =
          PaperBoard.baseTileSize; // in pixels
        const { height, width } = hitBoard.dimensions; // in tiles

        if (isHorizontal && height < 2) {
          // Cannot slice horizontally if there is only one row
          this.game.state.sliceIndicator = null;
          return;
        }
        if (!isHorizontal && width < 2) {
          // Cannot slice vertically if there is only one column
          this.game.state.sliceIndicator = null;
          return;
        }

        // Want to find the beginning and end of the line segment that is
        // inside the board bounds
        const p1Contained = this.game.state.lineIndicator.start.isInside(
          hitBoard.bounds
        );
        const p2Contained = this.game.state.lineIndicator.end.isInside(
          hitBoard.bounds
        );
        let p1 = this.game.state.lineIndicator.start;
        let p2 = this.game.state.lineIndicator.end;
        if (!p1Contained && !p2Contained) {
          // Neither point is contained, so we need to find the intersections
          const intersections = line.getIntersections(
            new paper.Path.Rectangle(hitBoard.bounds)
          );
          if (intersections.length < 2) {
            this.game.state.sliceIndicator = null;
            return;
          }
          p1 = intersections[0].point;
          p2 = intersections[1].point;
        } else if (!p1Contained) {
          // Only p1 is outside, find intersection for p1
          const intersections = line.getIntersections(
            new paper.Path.Rectangle(hitBoard.bounds)
          );
          if (intersections.length < 1) {
            this.game.state.sliceIndicator = null;
            return;
          }
          p1 = intersections[0].point;
        } else if (!p2Contained) {
          // Only p2 is outside, find intersection for p2
          const intersections = line.getIntersections(
            new paper.Path.Rectangle(hitBoard.bounds)
          );
          if (intersections.length < 1) {
            this.game.state.sliceIndicator = null;
            return;
          }
          p2 = intersections[0].point;
        }

        if (isHorizontal) {
          // Find the average y of p1 and p2
          const avgY = (p1.y + p2.y) / 2;
          // Find the closest horizontal grid line to avgY
          const localY =
            avgY - (hitBoard.position.y - (height * tileHeight) / 2); // in pixels
          let index = Math.round(localY / tileHeight); // in tiles

          this.game.state.sliceIndicator = {
            boardUUID: hitBoard.uuid,
            direction: Direction.Horizontal,
            index,
          };
        } else {
          // Find the average x of p1 and p2
          const avgX = (p1.x + p2.x) / 2;
          // Find the closest vertical grid line to avgX
          const { height: tileHeight, width: tileWidth } =
            PaperBoard.baseTileSize; // in pixels
          const { height, width } = hitBoard.dimensions; // in tiles
          const localX = avgX - (hitBoard.position.x - (width * tileWidth) / 2); // in pixels
          let index = Math.round(localX / tileWidth); // in tiles

          this.game.state.sliceIndicator = {
            boardUUID: hitBoard.uuid,
            direction: Direction.Vertical,
            index,
          };
        }
      };
      sliceDragTool.onMouseUp = (event: paper.MouseEvent) => {
        if (!this.game.state.lineIndicator) return;
        if (!this.game.state.sliceIndicator) {
          this.game.state.lineIndicator = null;
          return;
        }

        const { boardUUID, direction, index } = this.game.state.sliceIndicator;
        const board = this.game.state.boards[boardUUID];
        if (!board) {
          throw new Error("Board not found in state");
        }
        const slice = { direction, line: index };
        this.game.state.actionCallBack(slice, board);
        this.game.state.lineIndicator = null;
        this.game.state.sliceIndicator = null;
      };

      return sliceDragTool;
    },
    switchToSliceTool() {
      if (this.sliceTool) {
        this.game.state.selectedBoardUUID = null;
        this.curTool = ToolType.Slice;
        this.sliceTool.activate();
      }
    },
    switchToDragTool() {
      if (this.dragTool) {
        this.game.state.sliceIndicator = null;
        this.game.state.lineIndicator = null;
        this.curTool = ToolType.Drag;
        this.dragTool.activate();
      }
    },
    toggleTool() {
      if (this.curTool === ToolType.Drag) {
        this.switchToSliceTool();
      } else {
        this.switchToDragTool();
      }
    },
    setUpInteractiveTools() {
      if (this.interactive) {
        const dragTool = this.newDragTool();
        const sliceTool = this.newDragSliceTool();

        const switchToSlice = (event: paper.KeyEvent) => {
          if (event.key === "shift") {
            // If shift is released, stop dragging
            this.switchToSliceTool();
          }
        };
        const switchToDrag = (event: paper.KeyEvent) => {
          if (event.key === "shift") {
            // If shift is pressed, start dragging
            this.switchToDragTool();
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
    getVisualPlayer(): VisualPlayer | null {
      if (!this.game) return null;
      const players = this.game.players.filter(
        (p) => p instanceof VisualPlayer
      ) as VisualPlayer[];
      if (players.length === 0) return null;
      return players[0];
    },
    isWinnerVisualPlayer(): boolean {
      if (!this.game) return false;
      const winnerInfos = this.game.winners;
      if (winnerInfos.length !== 1) return false;
      const visualPlayer = this.getVisualPlayer();
      if (!visualPlayer) return false;
      return winnerInfos[0] === visualPlayer.info;
    },
    shuffleBoards() {
      if (!this.game) return;
      this.game.state.shuffleBoards(paper.view.size);
    },
    getPlayerState(): PlayerState {
      if (!this.game) return PlayerState.GameNotStarted;
      if (this.game.winners.length > 0) {
        if (this.isWinnerVisualPlayer()) {
          return PlayerState.YouWin;
        } else if (
          this.game.winners.some((p) => p === this.getVisualPlayer()?.info)
        ) {
          return PlayerState.YouDraw;
        } else {
          return PlayerState.YouLose;
        }
      }
      if (this.game.currentPlayer() === this.getVisualPlayer()) {
        return PlayerState.YourTurn;
      } else {
        return PlayerState.WaitingForOpponent;
      }
    },
    redrawFunc(event: RedrawEvent, project: paper.Project, view: paper.View) {
      if (!this.game) return;

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
      let showCenters = false;

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
          //   const centerPoint = view.center;
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
          //   Add the line indicator if active
          if (this.game.state.lineIndicator) {
            const line = new paper.Path.Line(
              this.game.state.lineIndicator.start,
              this.game.state.lineIndicator.end
            );
            line.strokeColor = new paper.Color(infoColor);
            line.strokeWidth = 5;

            const dashArray = [20, 10];
            line.dashArray = dashArray;

            overlayGroup.addChild(line);
          }
          // If a board is being dragged, add an outline indicator
          if (
            this.game.state.selectedBoardUUID &&
            this.game.state.selectedBoardUUID === board.uuid
          ) {
            const outline = this.game.state.renderOutlineIndicator(
              board.uuid,
              new paper.Color(infoColor),
              10,
              [20, 10]
            );
            if (outline) {
              overlayGroup.addChild(outline);
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
        const panSpeed = 1;
        const zoomSpeed = 1;
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
        const scaleFactor = Math.min(vScaleFactor, hScaleFactor) * 0.8; // Add some padding

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
      if (showCenters) {
        // Show center points of screen (the attraction points) and the center
        // of the project bounds, for debugging the panning/zooming behaviour
        const centerPoint = new paper.Path.Circle({
          center: project.view.center,
          radius: 10,
        });
        centerPoint.fillColor = new paper.Color(infoColor);
        overlayGroup.addChild(centerPoint);

        const projectCenter = new paper.Path.Circle({
          center: project.activeLayer.bounds.center,
          radius: 10,
        });
        projectCenter.fillColor = new paper.Color(infoColor);
        overlayGroup.addChild(projectCenter);
      }

      underlayGroup.sendToBack();
      overlayGroup.bringToFront();
    },
  },
});
</script>
<template>
  <PaperCanvasFull :redrawFunction="redrawFunc" />
  <div v-if="interactive" class="absolute right-4 top-4">
    <span
      class="btn btn-lg btn-circle"
      :class="{
        'btn-active border-4 border-info': curTool === ToolType.Drag,
        'border-2 border-primary': curTool === ToolType.Slice,
      }"
      @click="toggleTool"
    >
      <MoveIcon class="size-6" />
    </span>
  </div>
  <TurnIndicator
    v-if="interactive"
    class="alert absolute left-1/2 -translate-x-1/2 top-4 pointer-events-none"
    :playerState="getPlayerState()"
  />
  <ScoreDisplay
    v-if="interactive && game.state.scoreConditions.length > 0"
    class="alert absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-none"
    :gameState="game.state"
  />
</template>
<style scoped></style>
