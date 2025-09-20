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
import { VisualState, type PaperBoard, type RedrawEvent } from "./PaperUtils";

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
  visualState: VisualState,
  frameTime: number,
  attractionPath: paper.Path | paper.Point
): void {
  const boards = Object.values(visualState.paperBoards);
  // Calculate repulsion forces between boards
  // Points here are vectors relative to the board's current position
  const forces: Record<string, paper.Point> = {};
  for (const board of boards) {
    forces[board.uuid] = new paper.Point(0, 0);
  }

  for (const board of boards) {
    const rectA = visualState.boundingRect(board.uuid);

    for (const otherBoard of boards) {
      if (otherBoard.uuid === board.uuid) continue;
      const rectB = visualState.boundingRect(otherBoard.uuid);

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
      visualState.paperBoards[board.uuid].position.x,
      visualState.paperBoards[board.uuid].position.y
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
      visualState.paperBoards[board.uuid].position.x,
      visualState.paperBoards[board.uuid].position.y
    );
    const velocity = force.multiply(frameTime / 1000); // Scale by frame time
    const newPos = pos.add(velocity);

    visualState.paperBoards[board.uuid].position = newPos;
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
    redrawFunc(event: RedrawEvent, project: paper.Project, view: paper.View) {
      // console.log("Redrawing with state:", state);
      const primaryColor = new paper.Color(getDaisyUIColor("--color-primary"));
      const secondaryColor = new paper.Color(
        getDaisyUIColor("--color-secondary")
      );
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
      } else {
        // Update positions based on forces
        // Center point attraction
        const centerPoint = view.center;
        // Center line attraction
        //   const centerPoint = centerLine(view);

        updatePositions(this.gameState!, event.delta * timeScale, centerPoint);
      }

      const groups = [] as paper.Group[];
      for (const board of paperBoards) {
        const boardGroup = board.draw();
        groups.push(boardGroup);
      }

      project.activeLayer.fitBounds(view.bounds.scale(0.75), false);
      project.activeLayer.removeChildren();
      project.activeLayer.addChildren(groups);
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
