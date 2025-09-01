enum Direction {
  Horizontal,
  Vertical,
}

interface Slice {
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

interface Coordinate {
  // Coordinates start from the top-left corner (0, 0), like pixels, not like
  // regular cartesian coordinates.
  x: number;
  y: number;
}

interface Player {}

interface Board {
  // In Divinim, a board is a grid of tiles arranged in rows and columns. Some
  // coordinates are "marked" / "poisoned".
  width: number;
  height: number;
  markedCoordinates: Coordinate[];
}

interface Action {
  slice: Slice;
  board: Board;
}

interface Turn {
  player: Player;
  action: Action;
}

interface WinCondition<TState extends BaseState> {
  condition: (state: TState) => boolean;
}

interface BaseState {
  boards: Board[];
  currentPlayer: Player;
}

interface VisualState extends BaseState {
  // For displaying the boards on a 2D plane, for example, on a canvas.
  boardPositions: Coordinate[][];
}

// Base class for a Divinim game
class Game<TState extends BaseState> {
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
    // Apply the turn to the game state
    return this.state;
  }

  public playTurn(turn: Turn): void {
    this.setState(this.simulateTurn(turn));
  }
}
