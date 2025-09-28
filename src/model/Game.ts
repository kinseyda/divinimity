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

export interface PlayerInfo {
  uuid: string;
  name: string;
  turnRemainder: number; // The player's turn is when (turn number % player count) == turn modulo
}

export class Player<TState extends BaseState> {
  info: PlayerInfo;

  getActionCallback: (state: TState) => Promise<Action>;

  /**
   * Creates a new Player.
   * @param info - Basic info about the player, including their name and turn
   * order.
   * @param getActionCallback - This function is called when it is this player's
   * turn to act. It should return a promise that resolves to the action the
   * player wants to take.
   */
  constructor(
    name: string,
    turnRemainder: number,
    getActionCallback: (state: TState) => Promise<Action>
  ) {
    this.info = { uuid: generateUUID(), name, turnRemainder };
    this.getActionCallback = getActionCallback;
  }

  public async getAction(state: TState): Promise<Action> {
    return this.getActionCallback(state);
  }
}

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
  player: PlayerInfo;
  action: Action;
}

export interface WinCondition<TState extends BaseState> {
  condition: (state: TState) => boolean;
}

export interface TurnResult {
  turn: Turn;
  inState: BaseState;
  outState: BaseState;
  sliceResult: SliceResult;
}

export interface SliceResult {
  boards: {
    reducedBoard: Board | null; // The left or top of the sliced board. Will be null if this part of the board was removed due to not having any marked coordinates.
    childBoard: Board | null; // The right or bottom of the sliced board. Will be null if this part of the board was removed due to not having any marked coordinates.
  };
  removedBoards: Board[]; // Will all have either zero marked coordinates, or be a single 1x1 board that is marked
}

export function sliceBoard(board: Board, slice: Slice): SliceResult | null {
  // Apply a slice on a board.
  // Returns null if the slice is invalid (out of bounds).
  // Does not return any boards that do not have a marked coordinate.
  // Marked coordinates are moved to their new positions on the sliced boards.
  // Does not modify the original board.

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
  // The base state of a Divinim game. All data about individual instances /
  // states should be in simple objects / interfaces, not classes, to ensure
  // serializability. This applies to non-abstract subclasses of BaseState as
  // well.
  boards: Record<string, Board>;
  players: PlayerInfo[];
  turnHistory: Turn[];

  constructor(players: PlayerInfo[], boards: Board[]) {
    this.boards = boards.reduce((acc, board) => {
      acc[board.uuid] = board;
      return acc;
    }, {} as Record<string, Board>);
    this.players = players;
    this.turnHistory = [];
  }

  // This method is called after each turn is played, and can be used to
  // update any state that depends on the turn history or the current boards.
  // For example, ensuring that boards are positioned consistently after a
  // slice.
  abstract postTurnUpdate(turnResult: TurnResult): void;

  get availableActions(): Action[] {
    // For each board, a slice can be made between any two tiles, or
    // equivalently between any two rows or columns.
    const actions: Action[] = [];
    for (const board of Object.values(this.boards)) {
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

// Base class for a Divinim game
export class Game<TState extends BaseState> {
  protected state: TState;
  protected players: Player<TState>[];

  constructor(initialState: TState, players: Player<TState>[]) {
    this.state = initialState;
    this.players = players;
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

    const stateCopy = Object.create(this.state.constructor.prototype) as TState;
    Object.assign(stateCopy, this.state);
    stateCopy.boards = newBoards;

    const turnResult: TurnResult = {
      turn,
      inState: this.state,
      outState: stateCopy,
      sliceResult,
    };
    stateCopy.postTurnUpdate(turnResult);

    return stateCopy;
  }

  public playTurn(turn: Turn): void {
    this.setState(this.simulateTurn(turn));
    this.state.turnHistory.push(turn);
  }

  public async playLoop(): Promise<void> {
    while (true) {
      const currentPlayer = this.currentPlayer();
      if (!currentPlayer) throw new Error("No current player found");

      const action = await this.requestPlayerAction(currentPlayer);
      if (this.isValidAction(action)) {
        this.playTurn({
          player: currentPlayer.info,
          action: action,
        });
      }
    }
  }

  public async requestPlayerAction(player: Player<TState>): Promise<Action> {
    return player.getAction(this.state);
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

  /**
   * Checks if the given action is valid.
   * @param action The action to check.
   * @returns True if the action is valid, false otherwise.
   */
  public isValidAction(action: Action): boolean {
    console.log("Validating action:", action);
    if (!this.state.boards[action.board.uuid]) {
      return false;
    }
    if (action.slice.direction === Direction.Horizontal) {
      if (
        action.slice.line < 1 ||
        action.slice.line >=
          this.state.boards[action.board.uuid].dimensions.height
      ) {
        return false;
      }
    } else if (action.slice.direction === Direction.Vertical) {
      if (
        action.slice.line < 1 ||
        action.slice.line >=
          this.state.boards[action.board.uuid].dimensions.width
      ) {
        return false;
      }
    }
    return true;
  }

  public currentTurnNumber(): number {
    return this.state.turnHistory.length;
  }

  public currentPlayer(): Player<TState> | null {
    const turnNumber = this.currentTurnNumber();
    for (const player of this.players) {
      if (turnNumber % this.players.length === player.info.turnRemainder) {
        return player;
      }
    }
    return null;
  }

  public isPlayerTurn(player: PlayerInfo): boolean {
    const playerRemainder = player.turnRemainder;
    const turnNumber = this.currentTurnNumber();
    const playerCount = this.players.length;
    return turnNumber % playerCount === playerRemainder;
  }

  /**
   * Checks if the given turn is valid. A turn is valid if it is the player's
   * turn and the action is valid.
   * @param turn The turn to check.
   * @returns True if the turn is valid, false otherwise.
   */
  public isValidTurn(turn: Turn): boolean {
    if (!this.isPlayerTurn(turn.player)) {
      return false;
    }
    if (!this.isValidAction(turn.action)) {
      return false;
    }
    return true;
  }
}

export class RandomPlayer extends Player<BaseState> {
  // A player that selects a random valid action after a delay

  private delayMs: number;

  constructor(turnRemainder: number, delayMs = 1000) {
    super("Random Player", turnRemainder, (state: BaseState) => {
      const actions = state.availableActions;
      if (actions.length === 0) {
        return Promise.reject("No available actions");
      }
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(randomAction);
        }, this.delayMs);
      });
    });
    this.delayMs = delayMs;
  }
}
