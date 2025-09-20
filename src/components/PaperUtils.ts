import {
  BaseState,
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

interface BoardData {
  // Data object for each board. When using hit testing, the item returned
  // will have this data object attached to it.
  boardUUID: string;
}

export class PaperBoard {
  // PaperBoard should be a lightweight bridge between the Board data model
  // and its visual representation in Paper.js. It should handle drawing the
  // board, updating it, and providing interaction capabilities.

  static tileSize = { width: 100, height: 100 }; // Pixel size of each tile
  static tilePadding = 5; // Padding between tiles

  /**
   *
   * @param dimensions - width and height in tiles
   * @param markedTiles - coordinates of marked tiles (0-indexed, top-left is (0, 0))
   * @param position - center position of the board in the Paper.js view
   */
  constructor(
    public uuid: string,
    public dimensions: { width: number; height: number },
    public markedTiles: TileCoordinate[],
    public position: paper.Point
  ) {}

  public get bounds(): paper.Rectangle {
    const boardWidth = this.dimensions.width * PaperBoard.tileSize.width;
    const boardHeight = this.dimensions.height * PaperBoard.tileSize.height;
    return new paper.Rectangle(
      this.position.subtract(new paper.Point(boardWidth / 2, boardHeight / 2)),
      new paper.Size(boardWidth, boardHeight)
    );
  }

  public draw(): paper.Group {
    const group = new paper.Group();
    group.data = { boardUUID: this.uuid } as BoardData;

    // Draw bar backing
    const rows = this.dimensions.height;
    const cols = this.dimensions.width;
    const boardWidth = cols * PaperBoard.tileSize.width;
    const boardHeight = rows * PaperBoard.tileSize.height;
    const boardRect = new paper.Rectangle(
      this.position.subtract(new paper.Point(boardWidth / 2, boardHeight / 2)),
      new paper.Size(boardWidth, boardHeight)
    );
    const boardPath = new paper.Path.Rectangle(boardRect);
    boardPath.fillColor = new paper.Color("white");
    boardPath.strokeColor = new paper.Color("black");
    boardPath.strokeWidth = 2;
    group.addChild(boardPath);
    // Draw grid lines
    for (let r = 1; r < rows; r++) {
      const y = boardRect.top + r * PaperBoard.tileSize.height;
      const line = new paper.Path.Line(
        new paper.Point(boardRect.left, y),
        new paper.Point(boardRect.right, y)
      );
      line.strokeColor = new paper.Color("black");
      line.strokeWidth = 1;
      group.addChild(line);
    }

    for (let c = 1; c < cols; c++) {
      const x = boardRect.left + c * PaperBoard.tileSize.width;
      const line = new paper.Path.Line(
        new paper.Point(x, boardRect.top),
        new paper.Point(x, boardRect.bottom)
      );
      line.strokeColor = new paper.Color("black");
      line.strokeWidth = 1;
      group.addChild(line);
    }

    // Draw marked tiles
    for (const tile of this.markedTiles) {
      const tileRect = new paper.Rectangle(
        boardRect.topLeft.add(
          new paper.Point(
            tile.x * PaperBoard.tileSize.width,
            tile.y * PaperBoard.tileSize.height
          )
        ),
        new paper.Size(PaperBoard.tileSize.width, PaperBoard.tileSize.height)
      );
      const tilePath = new paper.Path.Rectangle(tileRect);
      tilePath.fillColor = new paper.Color("red");
      tilePath.strokeColor = new paper.Color("black");
      tilePath.strokeWidth = 1;
      group.addChild(tilePath);
    }

    return group;
  }
}

export class VisualState extends BaseState {
  paperBoards: Record<string, PaperBoard> = {}; // PaperBoard instances indexed by board UUIDs

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
}
