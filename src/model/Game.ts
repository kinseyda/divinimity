export enum Direction {
  Horizontal,
  Vertical,
}

export interface Slice {
  // A slice is a single cut along a grid line, between two rows or two columns
  // of tiles. It is defined by its direction (horizontal or vertical) and the
  // line it cuts through (either a row or a column). The line number is an
  // index, either the x or y from the coordinate you slice at. Therefore, the
  // slice is between line and line - 1. So, a valid slice must have a line
  // number greater than one (otherwise you would be slicing the border of the
  // board).
  direction: Direction;
  line: number;
}

export interface TileCoordinate {
  // Coordinates start from the top-left corner (0, 0), like pixels, not like
  // regular cartesian coordinates.
  x: number;
  y: number;
}

export interface Player {}

export interface BoardDimensions {
  width: number;
  height: number;
}

export interface Board {
  // In Divinim, a board is a grid of tiles arranged in rows and columns. Some
  // coordinates are "marked" / "poisoned".
  dimensions: BoardDimensions;
  markedCoordinates: TileCoordinate[];
  uuid: string;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export function newBoard(
  dimensions: BoardDimensions,
  markedCoordinates: TileCoordinate[]
): Board {
  return {
    dimensions,
    markedCoordinates,
    uuid: generateUUID(),
  };
}

export interface Action {
  slice: Slice;
  board: Board;
}

export interface Turn {
  player: Player;
  action: Action;
}

export interface WinCondition<TState extends BaseState> {
  condition: (state: TState) => boolean;
}

export interface SliceResult {
  boards: Board[];
  removedBoards: Board[]; // Will all have either zero marked coordinates, or be a single 1x1 board that is marked
}

export interface TurnResult {
  turn: Turn;
  inState: BaseState;
  outState: BaseState;
  sliceResult: SliceResult;
}

export function slice(board: Board, slice: Slice): SliceResult | null {
  // Apply a slice on a board.
  // Returns null if the slice is invalid (out of bounds).
  // Does not return any boards that do not have a marked coordinate.
  // Marked coordinates are moved to their new positions on the sliced boards.

  const sliceDir = slice.direction;
  const sliceIndex = slice.line;

  if (
    sliceIndex < 1 ||
    sliceIndex >=
      (sliceDir == Direction.Horizontal
        ? board.dimensions.height
        : board.dimensions.width)
  ) {
    return null;
  }

  const topOrLeftCoords = [];
  const bottomOrRightCoords = [];
  for (const coord of board.markedCoordinates) {
    if (sliceDir == Direction.Horizontal && coord.y < sliceIndex) {
      topOrLeftCoords.push(coord);
    } else if (sliceDir == Direction.Vertical && coord.x < sliceIndex) {
      topOrLeftCoords.push(coord);
    } else if (sliceDir == Direction.Horizontal && coord.y >= sliceIndex) {
      // Modify the coord to be relative to the new board
      bottomOrRightCoords.push({
        x: coord.x,
        y: coord.y - sliceIndex,
      });
    } else if (sliceDir == Direction.Vertical && coord.x >= sliceIndex) {
      // Modify the coord to be relative to the new board
      bottomOrRightCoords.push({
        x: coord.x - sliceIndex,
        y: coord.y,
      });
    }
  }

  let boards = [
    newBoard(
      {
        width: board.dimensions.width,
        height: sliceIndex,
      },
      topOrLeftCoords
    ),
    newBoard(
      {
        width: board.dimensions.width,
        height: board.dimensions.height - sliceIndex,
      },
      bottomOrRightCoords
    ),
  ];

  const removedBoards = boards.filter(
    (b) =>
      b.markedCoordinates.length === 0 ||
      (b.dimensions.width === 1 &&
        b.dimensions.height === 1 &&
        b.markedCoordinates.length === 1)
  );
  boards = boards.filter((b) => !removedBoards.includes(b));

  return {
    boards,
    removedBoards,
  };
}

export abstract class BaseState {
  boards: Record<string, Board>; // Boards indexed by their UUIDs. This is to make it easier to update them, and to ensure that the orders are consistent across states, even when visualized and with boards being removed.
  currentPlayer: Player;

  constructor(players: Player[], boards: Board[]) {
    this.boards = boards.reduce((acc, board) => {
      acc[board.uuid] = board;
      return acc;
    }, {} as Record<string, Board>);
    this.currentPlayer = players[0];
  }

  abstract postTurnUpdate(turnResult: TurnResult): void;
}

// Base class for a Divinim game
export class Game<TState extends BaseState> {
  protected state: TState;

  constructor(initialState: TState) {
    this.state = initialState;
  }

  public getState(): TState {
    return this.state;
  }

  public setState(newState: TState): void {
    this.state = newState;
  }

  public simulateTurn(turn: Turn): TState {
    return this.state;
  }

  public playTurn(turn: Turn): void {
    this.setState(this.simulateTurn(turn));
  }

  public getAvailableActions(): Action[] {
    // For each board, a slice can be made between any two tiles.
    const actions: Action[] = [];
    for (const board of Object.values(this.state.boards)) {
      for (let x = 1; x < board.dimensions.width; x++) {
        actions.push({
          slice: { direction: Direction.Vertical, line: x },
          board: board,
        });
      }
      for (let y = 1; y < board.dimensions.height; y++) {
        actions.push({
          slice: { direction: Direction.Horizontal, line: y },
          board: board,
        });
      }
    }
    return actions;
  }
}
