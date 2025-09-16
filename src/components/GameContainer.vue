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
import { Game, newBoard, VisualState, type Board } from "../model/Game";
import type { RedrawEvent } from "../utils/PaperUtils";
import { getDaisyUIColor } from "../utils/StyleUtils";

const tileSize = { width: 100, height: 100 }; // Pixel size of each tile
const repulsionStrength = 50000;
const attractionStrength = 1000;
const timeScale = 1; // Adjust this to speed up or slow down the pseudo-physics simulation
const boardPadding = 20; // Minimum distance between boards

/**
 * Finds the minimum distance between two rectangles.
 * @param rectA
 * @param rectB
 */
function rectangleDistance(
  rectA: paper.Rectangle,
  rectB: paper.Rectangle,
  padding = boardPadding
): number {
  // If they overlap, the distance is zero
  if (rectA.intersects(rectB, padding)) return 0;

  const dx = Math.max(
    0,
    rectA.left > rectB.right
      ? rectA.left - rectB.right
      : rectB.left > rectA.right
      ? rectB.left - rectA.right
      : 0
  );
  const dy = Math.max(
    0,
    rectA.top > rectB.bottom
      ? rectA.top - rectB.bottom
      : rectB.top > rectA.bottom
      ? rectB.top - rectA.bottom
      : 0
  );

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the minimum translation vector to separate two overlapping rectangles.
 * If the rectangles do not overlap, returns a zero vector.
 */
function minimumTranslationVector(
  rectA: paper.Rectangle,
  rectB: paper.Rectangle,
  padding = boardPadding
): paper.Point {
  if (!rectA.intersects(rectB, padding)) {
    return new paper.Point(0, 0);
  }

  const overlapX =
    rectA.width / 2 +
    rectB.width / 2 -
    Math.abs(rectA.center.x - rectB.center.x) +
    padding;
  const overlapY =
    rectA.height / 2 +
    rectB.height / 2 -
    Math.abs(rectA.center.y - rectB.center.y) +
    padding;

  if (overlapX < overlapY) {
    return new paper.Point(
      rectA.center.x < rectB.center.x ? -overlapX : overlapX,
      0
    );
  } else {
    return new paper.Point(
      0,
      rectA.center.y < rectB.center.y ? -overlapY : overlapY
    );
  }
}

function drawBoard(board: Board, position: paper.Point): paper.Group {
  const group = new paper.Group();
  const rows = board.dimensions.height;
  const cols = board.dimensions.width;
  const boardWidth = cols * tileSize.width;
  const boardHeight = rows * tileSize.height;
  const boardRect = new paper.Rectangle(
    position.subtract(new paper.Point(boardWidth / 2, boardHeight / 2)),
    new paper.Size(boardWidth, boardHeight)
  );
  const boardPath = new paper.Path.Rectangle(boardRect);
  boardPath.fillColor = new paper.Color("white");
  boardPath.strokeColor = new paper.Color("black");
  boardPath.strokeWidth = 2;
  group.addChild(boardPath);
  // Draw grid lines
  for (let r = 1; r < rows; r++) {
    const y = boardRect.top + r * tileSize.height;
    const line = new paper.Path.Line(
      new paper.Point(boardRect.left, y),
      new paper.Point(boardRect.right, y)
    );
    line.strokeColor = new paper.Color("black");
    line.strokeWidth = 1;
    group.addChild(line);
  }

  for (let c = 1; c < cols; c++) {
    const x = boardRect.left + c * tileSize.width;
    const line = new paper.Path.Line(
      new paper.Point(x, boardRect.top),
      new paper.Point(x, boardRect.bottom)
    );
    line.strokeColor = new paper.Color("black");
    line.strokeWidth = 1;
    group.addChild(line);
  }

  // Draw marked tiles
  for (const tile of board.markedCoordinates) {
    const tileRect = new paper.Rectangle(
      boardRect.topLeft.add(
        new paper.Point(tile.x * tileSize.width, tile.y * tileSize.height)
      ),
      new paper.Size(tileSize.width, tileSize.height)
    );
    const tilePath = new paper.Path.Rectangle(tileRect);
    tilePath.fillColor = new paper.Color("red");
    tilePath.strokeColor = new paper.Color("black");
    tilePath.strokeWidth = 1;
    group.addChild(tilePath);
  }

  return group;

  // Temp testing: Draw a circle at the position, with a label for the position
  // and board UUID
  //   const group = new paper.Group();

  //   const circle = new paper.Path.Circle({
  //     center: position,
  //     radius: 30,
  //     fillColor: new paper.Color("lightblue"),
  //     strokeColor: new paper.Color("black"),
  //     strokeWidth: 2,
  //   });
  //   group.addChild(circle);

  //   const text = new paper.PointText({
  //     point: position.add(new paper.Point(0, 5)),
  //     content: `(${position.x},${position.y})`,
  //     fillColor: new paper.Color("black"),
  //     fontSize: 12,
  //     justification: "center",
  //   });
  //   text.position = position.add(new paper.Point(0, 40));
  //   group.addChild(text);

  //   return group;
}

function boundingRect(
  boards: Record<string, Board>,
  visualState: VisualState,
  uuid: string
): paper.Rectangle {
  const pos = new paper.Point(
    visualState.boardPositions[uuid].x,
    visualState.boardPositions[uuid].y
  );
  const rect = new paper.Rectangle(
    pos.subtract(
      new paper.Point(
        (boards[uuid].dimensions.width * tileSize.width) / 2,
        (boards[uuid].dimensions.height * tileSize.height) / 2
      )
    ),
    new paper.Size(
      boards[uuid].dimensions.width * tileSize.width,
      boards[uuid].dimensions.height * tileSize.height
    )
  );
  return rect;
}

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

/**
 * Update the positions of boards based on repulsion and attraction forces.
 * Values are modified in-place.
 * @param boards
 * @param visualState
 * @param frameTime - Time elapsed since last frame in milliseconds
 * @param attractionPath - A path that boards are attracted to (e.g., a center
 * line or point)
 */
function updatePositions(
  boards: Board[],
  visualState: VisualState,
  frameTime: number,
  attractionPath: paper.Path | paper.Point
): void {
  const positions = visualState.boardPositions;

  // Calculate repulsion forces between boards
  // Points here are vectors relative to the board's current position
  const forces: Record<string, paper.Point> = {};
  for (const board of boards) {
    forces[board.uuid] = new paper.Point(0, 0);
  }

  for (const board of boards) {
    const rectA = boundingRect(visualState.boards, visualState, board.uuid);

    for (const otherBoard of boards) {
      if (otherBoard.uuid === board.uuid) continue;
      const rectB = boundingRect(
        visualState.boards,
        visualState,
        otherBoard.uuid
      );

      const distance = rectangleDistance(rectA, rectB);
      const centerPointDistance = rectA.center.getDistance(rectB.center);
      const direction = rectA.center.subtract(rectB.center).normalize();
      const forceMagnitude =
        repulsionStrength / (centerPointDistance * centerPointDistance); // Inverse square law
      let force = direction.multiply(forceMagnitude);
      if (distance === 0) {
        // If overlapping, apply mtv to separate them
        const mtv = minimumTranslationVector(rectA, rectB);
        force = mtv.multiply(repulsionStrength);
      }
      forces[board.uuid] = forces[board.uuid].add(force);
    }
  }

  // Calculate attraction forces towards the attraction path or point
  for (const board of boards) {
    const pos = new paper.Point(
      positions[board.uuid].x,
      positions[board.uuid].y
    );
    let closestPoint: paper.Point;
    if (attractionPath instanceof paper.Path) {
      closestPoint = attractionPath.getNearestPoint(pos) || pos;
    } else {
      closestPoint = attractionPath;
    }
    const delta = closestPoint.subtract(pos);
    const forceMagnitude = attractionStrength * delta.length;
    const force = delta.normalize().multiply(forceMagnitude);
    forces[board.uuid] = forces[board.uuid].add(force);
  }

  // Update positions based on calculated forces
  for (const board of boards) {
    const force = forces[board.uuid];
    const pos = new paper.Point(
      positions[board.uuid].x,
      positions[board.uuid].y
    );
    const velocity = force.multiply(frameTime / 1000); // Scale by frame time
    const newPos = pos.add(velocity);

    positions[board.uuid] = { x: newPos.x, y: newPos.y };
  }
}

function placeAroundCenter(
  boards: Board[],
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
    redrawFunc(
      state: VisualState
    ): (event: RedrawEvent, project: paper.Project, view: paper.View) => void {
      return (event: RedrawEvent, project: paper.Project, view: paper.View) => {
        // console.log("Redrawing with state:", state);
        const primaryColor = new paper.Color(
          getDaisyUIColor("--color-primary")
        );
        const secondaryColor = new paper.Color(
          getDaisyUIColor("--color-secondary")
        );

        const boards = Object.values(state.boards);
        const positions = state.boardPositions;

        if (
          Object.values(positions).every((pos) => pos.x === -1 && pos.y === -1)
        ) {
          // Initial placement around center if all positions are uninitialized
          const center = view.center;
          const initialPositions = placeAroundCenter(boards, center);
          boards.forEach((board, index) => {
            positions[board.uuid] = {
              x: initialPositions[index].x,
              y: initialPositions[index].y,
            };
          });
        } else {
          // Update positions based on forces
          // Center point attraction
          const centerPoint = view.center;
          // Center line attraction
          //   const centerPoint = centerLine(view);

          updatePositions(boards, state, event.delta * timeScale, centerPoint);
        }

        const groups = [] as paper.Group[];
        for (const board of boards) {
          const pos = new paper.Point(
            positions[board.uuid].x,
            positions[board.uuid].y
          );
          const boardGroup = drawBoard(board, pos);
          groups.push(boardGroup);
        }

        project.activeLayer.fitBounds(view.bounds.scale(0.75), false);
        project.activeLayer.removeChildren();
        project.activeLayer.addChildren(groups);
      };
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
  <PaperCanvasFull :redrawFunction="redrawFunc(gameState!)" />
</template>
<style scoped>
canvas[resize] {
  width: 100%;
  height: 100%;
}
</style>
