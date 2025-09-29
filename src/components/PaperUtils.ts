import {
  BaseState,
  Direction,
  newBoard,
  NoMovesWinCondition,
  Player,
  type Action,
  type Board,
  type PlayerInfo,
  type Slice,
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

/**
 * Generates a random board configuration.
 * @param minDimension Minimum width/height of the board
 * @param maxDimension Maximum width/height of the board
 * @param minMarks Minimum number of marked tiles
 * @param maxMarks Maximum number of marked tiles
 * @returns A randomly generated board
 */
export function randomBoard(
  minDimension = 2,
  maxDimension = 10,
  minMarks = 1,
  maxMarks = 10
): Board {
  const width =
    Math.floor(Math.random() * (maxDimension - minDimension + 1)) +
    minDimension;
  const height =
    Math.floor(Math.random() * (maxDimension - minDimension + 1)) +
    minDimension;
  const numMarks =
    Math.floor(Math.random() * (maxMarks - minMarks + 1)) + minMarks;
  const markedCoordinates: TileCoordinate[] = [];
  const occupied = new Set<string>();
  while (
    markedCoordinates.length < numMarks &&
    occupied.size < width * height
  ) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const key = `${x},${y}`;
    if (!occupied.has(key)) {
      occupied.add(key);
      markedCoordinates.push({ x, y });
    }
  }

  return newBoard({ width, height }, markedCoordinates);
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
    colorGrid: paper.Color,
    colorOutline: paper.Color
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
      line.strokeWidth = 8;
      group.addChild(line);
    }

    for (let c = 1; c < cols; c++) {
      const x = boardRect.left + c * PaperBoard.baseTileSize.width;
      const line = new paper.Path.Line(
        new paper.Point(x, boardRect.top),
        new paper.Point(x, boardRect.bottom)
      );
      line.strokeColor = colorGrid;
      line.strokeWidth = 8;
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
      tilePath.strokeWidth = 8;

      group.addChild(tilePath);
    }

    // Mask to round corners
    const mask = new paper.Path.Rectangle(boardRect, new paper.Size(25, 25));
    mask.strokeColor = colorOutline;
    mask.strokeWidth = 16;
    group.addChild(mask); // Used for showing the border on top of everything
    group.insertChild(0, mask.clone()); // Used for the clipping mask
    group.clipped = true;
    return group;
  }
}

/**
 * Converts a tile coordinate and quadrant into a slice representation.
 * @param tile The tile coordinate
 * @param quadrant The quadrant within the tile
 * @returns The corresponding slice representation
 */
export function tileQuadrantToSlice(
  tile: TileCoordinate,
  quadrant: Quadrant
): Slice {
  let direction: Direction;
  let index: number;
  if (quadrant === Quadrant.Top || quadrant === Quadrant.Bottom) {
    direction = Direction.Horizontal;
    index = tile.y + (quadrant === Quadrant.Bottom ? 1 : 0);
  } else {
    direction = Direction.Vertical;
    index = tile.x + (quadrant === Quadrant.Right ? 1 : 0);
  }
  return { direction, line: index };
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
 * is in. Divides the board into an equal grid of tiles based on bounds,
 * ignoring any visual clutter that might be on top of it.
 * @param board
 * @param point
 * @returns The tile coordinate and quadrant, or null if the point is outside
 * the board
 */
export function pointTileQuadrant(
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
  zoomLevel = 1; // Current zoom level of the view

  static repulsionStrength = 5000;
  static attractionStrength = 100;
  static timeScale = 1;
  static boardPadding = 50;

  static markColor = new paper.Color("red");
  static unmarkColor = new paper.Color("white");
  static gridLineColor = new paper.Color("black");

  // Callback to be called after the user makes a slice action.
  actionCallBack: (slice: Slice, board: Board) => void;

  /**
   * Create a new VisualState instance.
   * @param players
   * @param boards
   */
  constructor(
    players: PlayerInfo[],
    boards: Board[],
    actionCallback: (slice: Slice, board: Board) => void
  ) {
    super(players, boards, [NoMovesWinCondition]);
    this.actionCallBack = actionCallback;
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
  }

  public renderSliceIndicator(
    boardUUID: string,
    direction: Direction,
    index: number,
    color: paper.Color,
    strokeWidth: number,
    overDrawPadding = 20
  ): paper.Group | null {
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

    let group = new paper.Group();
    if (direction === Direction.Horizontal) {
      if (index < 0 || index > rows) return null; // Out of bounds
      const y = boardRect.top + index * PaperBoard.baseTileSize.height;
      const line = new paper.Path.Line(
        new paper.Point(boardRect.left - overDrawPadding, y),
        new paper.Point(boardRect.right + overDrawPadding, y)
      );
      line.strokeColor = color;
      line.strokeWidth = strokeWidth;
      // Add circles to the ends to make the line rounded
      const startCircle = new paper.Path.Circle(
        new paper.Point(boardRect.left - overDrawPadding, y),
        strokeWidth / 2
      );
      const endCircle = new paper.Path.Circle(
        new paper.Point(boardRect.right + overDrawPadding, y),
        strokeWidth / 2
      );
      startCircle.fillColor = color;
      endCircle.fillColor = color;

      group.addChild(line);
      group.addChild(startCircle);
      group.addChild(endCircle);
    } else {
      if (index < 0 || index > cols) return null; // Out of bounds

      const x = boardRect.left + index * PaperBoard.baseTileSize.width;
      const line = new paper.Path.Line(
        new paper.Point(x, boardRect.top - overDrawPadding),
        new paper.Point(x, boardRect.bottom + overDrawPadding)
      );
      line.strokeColor = color;
      line.strokeWidth = strokeWidth;
      // Add circles to the ends to make the line rounded
      const startCircle = new paper.Path.Circle(
        new paper.Point(x, boardRect.top - overDrawPadding),
        strokeWidth / 2
      );
      const endCircle = new paper.Path.Circle(
        new paper.Point(x, boardRect.bottom + overDrawPadding),
        strokeWidth / 2
      );
      startCircle.fillColor = color;
      endCircle.fillColor = color;

      group.addChild(line);
      group.addChild(startCircle);
      group.addChild(endCircle);
    }
    return group;
  }

  /**
   * Randomly position boards within the canvas. They may overlap. Centered around origin.
   */
  shuffleBoards(canvasSize: paper.Size): void {
    const edgePadding = 50; // Padding from the edge of the canvas
    const boards = Object.values(this.paperBoards);
    for (const board of boards) {
      const boardWidth = board.dimensions.width * PaperBoard.baseTileSize.width;
      const boardHeight =
        board.dimensions.height * PaperBoard.baseTileSize.height;
      const x =
        Math.random() * (canvasSize.width - 2 * edgePadding - boardWidth) +
        edgePadding +
        boardWidth / 2;
      const y =
        Math.random() * (canvasSize.height - 2 * edgePadding - boardHeight) +
        edgePadding +
        boardHeight / 2;
      board.position = new paper.Point(
        x - canvasSize.width / 2,
        y - canvasSize.height / 2
      );
    }
  }

  /**
   *
   * @param point
   * @returns
   */
  hitTestPaperBoard(point: paper.Point): PaperBoard | null {
    for (const board of Object.values(this.paperBoards)) {
      // Check if the point is within the board bounds
      // Might be more efficient to use paper's built-in hitTest, but its
      // difficult to convert between points when zoomed/panned
      if (board.bounds.contains(point)) {
        return board;
      }
    }
    return null;
  }

  postTurnUpdate(turnResult: TurnResult): void {
    // Update the visual representation of the boards based on the turn result.
    // The new bars will need to be placed where the old one was

    // First determine which paper board to replace
    const oldBoard = this.paperBoards[turnResult.turn.action.board.uuid];
    if (!oldBoard) {
      throw new Error(
        "Old board not found in visual state during postTurnUpdate"
      );
    }
    const oldPosition = oldBoard.position;
    const oldTopLeft = oldBoard.bounds.topLeft;

    // Remove the old board
    delete this.paperBoards[oldBoard.uuid];

    // Add the new boards at the same position as the old one. The starting
    // positions should be based upon the centers of the new boards, so that
    // their tiles are exactly where they were before the slice. So, on a
    // vertical slice, one board will be positioned to the left of the old
    // board's center, and the other to the right.
    const newBoards = turnResult.sliceResult.boards;
    if (newBoards.reducedBoard === null && newBoards.childBoard === null) {
      // No new boards were created, nothing to do
      // This can happen if the old board was 2x1 and both tiles were marked
      return;
    }
    const oldBoardWidth = oldBoard.dimensions.width;
    const oldBoardHeight = oldBoard.dimensions.height;

    const reducedBoard = newBoards.reducedBoard;
    const childBoard = newBoards.childBoard;

    if (turnResult.turn.action.slice.direction === Direction.Vertical) {
      // Vertical slice, so new boards are side by side
      if (reducedBoard) {
        this.paperBoards[reducedBoard.uuid] = new PaperBoard(
          reducedBoard.uuid,
          reducedBoard.dimensions,
          reducedBoard.markedCoordinates,
          oldPosition.add(
            new paper.Point(
              -(
                (oldBoardWidth - reducedBoard.dimensions.width) *
                PaperBoard.baseTileSize.width
              ) / 2,
              0
            )
          )
        );
      }
      if (childBoard) {
        this.paperBoards[childBoard.uuid] = new PaperBoard(
          childBoard.uuid,
          childBoard.dimensions,
          childBoard.markedCoordinates,
          oldPosition.add(
            new paper.Point(
              ((oldBoardWidth - childBoard.dimensions.width) *
                PaperBoard.baseTileSize.width) /
                2,
              0
            )
          )
        );
      }
    } else {
      // Horizontal slice, so new boards are stacked vertically
      if (reducedBoard) {
        this.paperBoards[reducedBoard.uuid] = new PaperBoard(
          reducedBoard.uuid,
          reducedBoard.dimensions,
          reducedBoard.markedCoordinates,
          oldPosition.add(
            new paper.Point(
              0,
              -(
                (oldBoardHeight - reducedBoard.dimensions.height) *
                PaperBoard.baseTileSize.height
              ) / 2
            )
          )
        );
      }
      if (childBoard) {
        this.paperBoards[childBoard.uuid] = new PaperBoard(
          childBoard.uuid,
          childBoard.dimensions,
          childBoard.markedCoordinates,
          oldPosition.add(
            new paper.Point(
              0,
              ((oldBoardHeight - childBoard.dimensions.height) *
                PaperBoard.baseTileSize.height) /
                2
            )
          )
        );
      }
    }
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
      const velocity = force
        .multiply(frameTime / 1000)
        .multiply(VisualState.timeScale);
      const newPos = pos.add(velocity);

      this.paperBoards[board.uuid].position = newPos;
    }
  }
}

/**
 * A player that gets its actions from user interaction with a Paper.js canvas.
 * When asked for an action, this player will wait for the user to click on a
 * board and select a slice.
 */
export class VisualPlayer extends Player<VisualState> {
  constructor(
    name: string,
    turnRemainder: number,
    getActionCallback: (state: VisualState) => Promise<Action>
  ) {
    super(name, turnRemainder, getActionCallback);
  }
}
