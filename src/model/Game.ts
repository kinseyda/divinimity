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
  boards: {
    reducedBoard: Board | null; // The left or top of the sliced board. Will be null if this part of the board was removed due to not having any marked coordinates.
    childBoard: Board | null; // The right or bottom of the sliced board. Will be null if this part of the board was removed due to not having any marked coordinates.
  };
  removedBoards: Board[]; // Will all have either zero marked coordinates, or be a single 1x1 board that is marked
}

export interface TurnResult {
  turn: Turn;
  inState: BaseState;
  outState: BaseState;
  sliceResult: SliceResult;
}

export function sliceBoard(board: Board, slice: Slice): SliceResult | null {
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

  let reducedBoard: Board | null = null;
  let childBoard: Board | null = null;

  if (sliceDir == Direction.Horizontal) {
    reducedBoard = newBoard(
      { width: board.dimensions.width, height: sliceIndex },
      topOrLeftCoords
    );
    childBoard = newBoard(
      {
        width: board.dimensions.width,
        height: board.dimensions.height - sliceIndex,
      },
      bottomOrRightCoords
    );
  } else if (sliceDir == Direction.Vertical) {
    reducedBoard = newBoard(
      { width: sliceIndex, height: board.dimensions.height },
      topOrLeftCoords
    );
    childBoard = newBoard(
      {
        width: board.dimensions.width - sliceIndex,
        height: board.dimensions.height,
      },
      bottomOrRightCoords
    );
  }

  const removedBoards = [];
  if (
    (reducedBoard &&
      reducedBoard.dimensions.width === 1 &&
      reducedBoard.dimensions.height === 1 &&
      reducedBoard.markedCoordinates.length === 1) ||
    (reducedBoard && reducedBoard.markedCoordinates.length === 0)
  ) {
    removedBoards.push(reducedBoard);
    reducedBoard = null;
  }
  if (
    (childBoard &&
      childBoard.dimensions.width === 1 &&
      childBoard.dimensions.height === 1 &&
      childBoard.markedCoordinates.length === 1) ||
    (childBoard && childBoard.markedCoordinates.length === 0)
  ) {
    removedBoards.push(childBoard);
    childBoard = null;
  }

  return {
    boards: {
      reducedBoard,
      childBoard: childBoard,
    },
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
    const { slice, board } = turn.action;
    const targetBoard = this.state.boards[board.uuid];
    if (!targetBoard) {
      throw new Error("Target board not found in current state");
    }
    const sliceResult = sliceBoard(targetBoard, slice);
    if (!sliceResult) {
      throw new Error("Invalid slice");
    }
    const newBoards = { ...this.state.boards };
    // Remove the target board
    delete newBoards[targetBoard.uuid];
    // Add the new boards
    for (const board of [
      sliceResult.boards.reducedBoard,
      sliceResult.boards.childBoard,
    ].filter((b) => b !== null) as Board[]) {
      newBoards[board.uuid] = board;
    }
    const newState = Object.create(this.state.constructor.prototype) as TState;
    Object.assign(newState, this.state);
    newState.boards = newBoards;
    const turnResult: TurnResult = {
      turn,
      inState: this.state,
      outState: newState,
      sliceResult,
    };
    newState.postTurnUpdate(turnResult);

    return newState;
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
