import { Group } from "paper/dist/paper-core";
import {
  BaseState,
  Direction,
  type Action,
  type Board,
  type Player,
  type TileCoordinate,
  type TurnResult,
} from "../model/Game";

import paper from "paper";
export type RedrawEvent = paper.Event & {
  // These are the fields that paper.js uses as "options" when passing the event
  // to the  view.onFrame handler. This type is just to make that explicit.
  // http://paperjs.org/reference/view/#onframe
  count: number; // Frame count
  time: number; // Time since the start of the animation in seconds
  delta: number; // Time since the last frame in seconds
};

export type TileData = {
  boardUUID: string;
  x: number;
  y: number;
};

export interface BoardData {
  // Data object for each board. When using hit testing, the item returned
  // will have this data object attached to it.
  boardUUID: string;
}

/**
 * Finds the minimum distance between two rectangles.
 * @param rectA
 * @param rectB
 */
function rectangleDistance(
  rectA: paper.Rectangle,
  rectB: paper.Rectangle,
  padding: number
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
  padding: number
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

export class PaperBoard {
  // PaperBoard should be a lightweight bridge between the Board data model
  // and its visual representation in Paper.js. It should handle drawing the
  // board, updating it, and providing interaction capabilities.

  static baseTileSize = { width: 100, height: 100 }; // Pixel size of each tile
  static tilePadding = 5; // Padding between tiles

  /**
   *
   * @param dimensions - width and height in tiles
   * @param markedTiles - coordinates of marked tiles (0-indexed, top-left is (0, 0))
   * @param position - center position of the board
   * */
  constructor(
    public uuid: string,
    public dimensions: { width: number; height: number },
    public markedTiles: TileCoordinate[],
    public position: paper.Point
  ) {}

  public get bounds(): paper.Rectangle {
    const boardWidth = this.dimensions.width * PaperBoard.baseTileSize.width;
    const boardHeight = this.dimensions.height * PaperBoard.baseTileSize.height;
    return new paper.Rectangle(
      this.position.subtract(new paper.Point(boardWidth / 2, boardHeight / 2)),
      new paper.Size(boardWidth, boardHeight)
    );
  }

  public renderToGroup(
    colorMarked: paper.Color,
    colorUnmarked: paper.Color,
    colorGrid: paper.Color
  ): paper.Group {
    const group = new paper.Group();
    group.data = { boardUUID: this.uuid } as BoardData;

    // Draw bar backing
    const rows = this.dimensions.height;
    const cols = this.dimensions.width;
    const boardWidth = cols * PaperBoard.baseTileSize.width;
    const boardHeight = rows * PaperBoard.baseTileSize.height;
    const boardRect = new paper.Rectangle(
      this.position.subtract(new paper.Point(boardWidth / 2, boardHeight / 2)),
      new paper.Size(boardWidth, boardHeight)
    );
    const boardPath = new paper.Path.Rectangle(boardRect);
    boardPath.fillColor = colorUnmarked;
    boardPath.strokeColor = colorGrid;
    boardPath.strokeWidth = 2;
    group.addChild(boardPath);
    // Draw grid lines
    for (let r = 1; r < rows; r++) {
      const y = boardRect.top + r * PaperBoard.baseTileSize.height;
      const line = new paper.Path.Line(
        new paper.Point(boardRect.left, y),
        new paper.Point(boardRect.right, y)
      );
      line.strokeColor = colorGrid;
      line.strokeWidth = 1;
      group.addChild(line);
    }

    for (let c = 1; c < cols; c++) {
      const x = boardRect.left + c * PaperBoard.baseTileSize.width;
      const line = new paper.Path.Line(
        new paper.Point(x, boardRect.top),
        new paper.Point(x, boardRect.bottom)
      );
      line.strokeColor = colorGrid;
      line.strokeWidth = 1;
      group.addChild(line);
    }

    // Draw marked tiles
    for (const tile of this.markedTiles) {
      const tileRect = new paper.Rectangle(
        boardRect.topLeft.add(
          new paper.Point(
            tile.x * PaperBoard.baseTileSize.width,
            tile.y * PaperBoard.baseTileSize.height
          )
        ),
        new paper.Size(
          PaperBoard.baseTileSize.width,
          PaperBoard.baseTileSize.height
        )
      );
      const tilePath = new paper.Path.Rectangle(tileRect);
      tilePath.fillColor = colorMarked;
      tilePath.strokeColor = colorGrid;
      tilePath.strokeWidth = 1;
      group.addChild(tilePath);
    }

    return group;
  }
}

/**
 * Quadrants within a tile, split diagonally through the center. i.e square with
 * an "X" through it.
 */
export enum Quadrant {
  Top,
  Right,
  Bottom,
  Left,
}
/**
 * Given a point and a board, determine which quadrant of which tile the point
 * is in. Divides the board into an equal grid of tiles, ignoring any visual
 * clutter that might be on top of it.
 * @param board
 * @param point
 * @returns The tile coordinate and quadrant, or null if the point is outside
 * the board
 */
function pointTileQuadrant(
  board: PaperBoard,
  point: paper.Point
): { tile: TileCoordinate; quadrant: Quadrant } | null {
  const boardRect = board.bounds;
  // First, check if the point is within the board bounds
  if (!(boardRect.topLeft.x <= point.x && point.x <= boardRect.bottomRight.x)) {
    return null;
  }
  if (!(boardRect.topLeft.y <= point.y && point.y <= boardRect.bottomRight.y)) {
    return null;
  }

  const boardLocalPoint = point.subtract(boardRect.topLeft);
  // Determine which tile the point is in
  // (0,0) is top-left tile
  // (width-1,height-1) is bottom-right tile
  const tileX = Math.floor(boardLocalPoint.x / PaperBoard.baseTileSize.width);
  const tileY = Math.floor(boardLocalPoint.y / PaperBoard.baseTileSize.height);

  // Get the local point within the tile, from (0,0) at top-left to (tileWidth, tileHeight) at bottom-right
  const tileLocalPoint = new paper.Point(
    boardLocalPoint.x - tileX * PaperBoard.baseTileSize.width,
    boardLocalPoint.y - tileY * PaperBoard.baseTileSize.height
  );

  // Determine the quadrant by comparing the point to the diagonals
  const tileWidth = PaperBoard.baseTileSize.width;
  const tileHeight = PaperBoard.baseTileSize.height;

  const centerX = tileWidth / 2;
  const centerY = tileHeight / 2;
  const slope = centerY / centerX;

  const bottomOrLeft = tileLocalPoint.y > slope * tileLocalPoint.x;
  const topOrLeft = tileLocalPoint.y > -slope * tileLocalPoint.x + tileHeight;

  if (bottomOrLeft && topOrLeft) {
    return { tile: { x: tileX, y: tileY }, quadrant: Quadrant.Bottom };
  } else if (bottomOrLeft && !topOrLeft) {
    return { tile: { x: tileX, y: tileY }, quadrant: Quadrant.Left };
  } else if (!bottomOrLeft && topOrLeft) {
    return { tile: { x: tileX, y: tileY }, quadrant: Quadrant.Right };
  } else {
    return { tile: { x: tileX, y: tileY }, quadrant: Quadrant.Top };
  }

  return null;
}

export class VisualState extends BaseState {
  paperBoards: Record<string, PaperBoard> = {}; // PaperBoard instances indexed by board UUIDs
  selectedBoardUUID: string | null = null; // UUID of the currently selected board, if any
  sliceIndicator: null | {
    boardUUID: string;
    direction: Direction;
    index: number;
  } = null; // Current slice being drawn, if any
  mousePosition: paper.Point;
  zoomLevel = 1; // Current zoom level of the view

  static repulsionStrength = 50000;
  static attractionStrength = 1000;
  static timeScale = 1; // Adjust this to speed up or slow down the pseudo-physics simulation
  static boardPadding = 50; // Minimum distance between boards

  static markColor = new paper.Color("red");
  static unmarkColor = new paper.Color("white");
  static gridLineColor = new paper.Color("black");

  dragTool: paper.Tool;
  sliceTool: paper.Tool;

  /**
   * Create a new VisualState instance.
   * @param players
   * @param boards
   */
  constructor(players: Player[], boards: Board[]) {
    super(players, boards);
    // Board positions are initialized at -1,-1 for all boards here since we
    // don't know the canvas dimensions. They will be updated later to be
    // placed around the center of the canvas, but before the first render.
    for (const board of boards) {
      this.paperBoards[board.uuid] = new PaperBoard(
        board.uuid,
        board.dimensions,
        board.markedCoordinates,
        new paper.Point(-1, -1)
      );
    }
    this.mousePosition = new paper.Point(0, 0);

    const startBoardDrag = (event: paper.MouseEvent) => {
      const hitBoard = this.hitTestPaperBoard(event.point);
      if (!hitBoard) return;
      // Set the selected board UUID in the game state
      this.selectedBoardUUID = hitBoard.uuid;

      // Move the board to the mouse position
      hitBoard.position = event.point;
      this.mousePosition = event.point;
    };
    const dragBoard = (event: paper.MouseEvent) => {
      if (!this.selectedBoardUUID) return;
      const board = this.paperBoards[this.selectedBoardUUID];
      if (!board) return;

      // Move the board to the mouse position
      board.position = event.point;
      this.mousePosition = event.point;
    };
    const endBoardDrag = (event: paper.MouseEvent) => {
      this.selectedBoardUUID = null;
      this.mousePosition = new paper.Point(0, 0);
    };

    this.dragTool = new paper.Tool();
    this.dragTool.onMouseDown = startBoardDrag;
    this.dragTool.onMouseDrag = dragBoard;
    this.dragTool.onMouseUp = endBoardDrag;

    this.sliceTool = new paper.Tool();
    this.sliceTool.onMouseMove = (event: paper.MouseEvent) => {
      // If the mouse is over a board, indicate where a slice will be made if you click
      const hitBoard = this.hitTestPaperBoard(event.point);
      if (hitBoard) {
        const statePoint = event.point;
        const ptq = pointTileQuadrant(hitBoard, statePoint);
        if (ptq) {
          const { tile, quadrant } = ptq;
          let direction: Direction;
          let index: number;
          if (quadrant === Quadrant.Top || quadrant === Quadrant.Bottom) {
            direction = Direction.Horizontal;
            index = tile.y + (quadrant === Quadrant.Bottom ? 1 : 0);
          } else {
            direction = Direction.Vertical;
            index = tile.x + (quadrant === Quadrant.Right ? 1 : 0);
          }
          this.sliceIndicator = {
            boardUUID: hitBoard.uuid,
            direction,
            index,
          };
        } else {
          this.sliceIndicator = null;
        }
      } else {
        this.sliceIndicator = null;
      }
    };

    const switchToSlice = (event: paper.KeyEvent) => {
      if (event.key === "shift") {
        // If shift is released, stop dragging
        this.selectedBoardUUID = null;
        this.sliceTool.activate();
      }
    };
    const switchToDrag = (event: paper.KeyEvent) => {
      if (event.key === "shift") {
        // If shift is pressed, start dragging
        this.sliceIndicator = null;
        this.dragTool.activate();
      }
    };
    this.dragTool.onKeyUp = switchToSlice;
    this.dragTool.onKeyDown = switchToDrag;
    this.sliceTool.onKeyUp = switchToSlice;
    this.sliceTool.onKeyDown = switchToDrag;
  }

  public renderSliceIndicator(
    boardUUID: string,
    direction: Direction,
    index: number,
    color: paper.Color,
    strokeWidth: number,
    overDrawPadding = 20
  ): paper.Path | null {
    const board = this.paperBoards[boardUUID];
    if (!board) return null;
    const rows = board.dimensions.height;
    const cols = board.dimensions.width;
    const boardWidth = cols * PaperBoard.baseTileSize.width;
    const boardHeight = rows * PaperBoard.baseTileSize.height;
    const boardRect = new paper.Rectangle(
      board.position.subtract(new paper.Point(boardWidth / 2, boardHeight / 2)),
      new paper.Size(boardWidth, boardHeight)
    );

    let line: paper.Path;
    if (direction === Direction.Horizontal) {
      if (index < 0 || index > rows) return null; // Out of bounds
      const y = boardRect.top + index * PaperBoard.baseTileSize.height;
      line = new paper.Path.Line(
        new paper.Point(boardRect.left - overDrawPadding, y),
        new paper.Point(boardRect.right + overDrawPadding, y)
      );
    } else {
      if (index < 0 || index > cols) return null; // Out of bounds
      const x = boardRect.left + index * PaperBoard.baseTileSize.width;
      line = new paper.Path.Line(
        new paper.Point(x, boardRect.top - overDrawPadding),
        new paper.Point(x, boardRect.bottom + overDrawPadding)
      );
    }
    line.strokeColor = color;
    line.strokeWidth = strokeWidth;
    return line;
  }

  /**
   *
   * @param point
   * @returns
   */
  hitTestPaperBoard(point: paper.Point): PaperBoard | null {
    const statePoint = point;
    for (const board of Object.values(this.paperBoards)) {
      // Check if the point is within the board bounds
      // Might be more efficient to use paper's built-in hitTest, but its
      // difficult to convert between points when zoomed/panned
      if (board.bounds.contains(statePoint)) {
        return board;
      }
    }
    return null;
  }

  postTurnUpdate(turnResult: TurnResult): void {
    // Update the visual representation of the boards based on the turn result.
    // The new bars will need to be placed where the old one was
    //   TODO
  }

  /**
   * Get the bounding box for a given board in the visual state.
   * @param visualState
   * @param uuid
   */
  boundingRect(uuid: string): paper.Rectangle {
    return this.paperBoards[uuid].bounds;
  }

  /**
   * Update the positions of boards based on repulsion and attraction forces.
   * Values are modified in-place. The currently selected board (if any) is not
   * moved by the simulation.
   * @param boards
   * @param visualState
   * @param frameTime - Time elapsed since last frame in milliseconds
   * @param attractionPath - A path that boards are attracted to (e.g., a center
   * line or point)
   */
  updatePositions(
    frameTime: number,
    attractionPath: paper.Path | paper.Point
  ): void {
    const boards = Object.values(this.paperBoards);
    const forces: Record<string, paper.Point> = {};
    for (const board of boards) {
      forces[board.uuid] = new paper.Point(0, 0);
    }

    // Calculate repulsion forces between boards
    for (const board of boards) {
      if (this.selectedBoardUUID === board.uuid) continue;
      const rectA = this.boundingRect(board.uuid);

      for (const otherBoard of boards) {
        if (otherBoard.uuid === board.uuid) continue;
        // if (this.selectedBoardUUID === otherBoard.uuid) continue; // Collisions with the selected board are ignored
        const rectB = this.boundingRect(otherBoard.uuid);

        const distance = rectangleDistance(
          rectA,
          rectB,
          VisualState.boardPadding
        );
        const centerPointDistance = rectA.center.getDistance(rectB.center);
        const direction = rectA.center.subtract(rectB.center).normalize();
        const forceMagnitude =
          VisualState.repulsionStrength /
          (centerPointDistance * centerPointDistance); // Inverse square law
        let force = direction.multiply(forceMagnitude);
        if (distance === 0) {
          // If overlapping, apply mtv to separate them
          const mtv = minimumTranslationVector(
            rectA,
            rectB,
            VisualState.boardPadding
          );
          force = mtv.multiply(VisualState.repulsionStrength);
        }
        forces[board.uuid] = forces[board.uuid].add(force);
      }
    }

    // Calculate attraction forces towards the attraction path or point
    for (const board of boards) {
      if (this.selectedBoardUUID === board.uuid) continue;
      const pos = new paper.Point(
        this.paperBoards[board.uuid].position.x,
        this.paperBoards[board.uuid].position.y
      );
      let closestPoint: paper.Point;
      if (attractionPath instanceof paper.Path) {
        closestPoint = attractionPath.getNearestPoint(pos) || pos;
      } else {
        closestPoint = attractionPath;
      }
      const delta = closestPoint.subtract(pos);
      const forceMagnitude = VisualState.attractionStrength * delta.length;
      const force = delta.normalize().multiply(forceMagnitude);
      forces[board.uuid] = forces[board.uuid].add(force);
    }

    // Update positions based on calculated forces
    for (const board of boards) {
      const force = forces[board.uuid];
      const pos = new paper.Point(
        this.paperBoards[board.uuid].position.x,
        this.paperBoards[board.uuid].position.y
      );
      const velocity = force.multiply(frameTime / 1000); // Scale by frame time
      const newPos = pos.add(velocity);

      this.paperBoards[board.uuid].position = newPos;
    }
  }
}
