import {
  Direction,
  type Action,
  type Board,
  type BoardDimensions,
  type PlayerInfo,
  type Slice,
  type TileCoordinate,
  type Turn,
  WinCondition as WinConditionEnum,
  ScoreCondition as ScoreConditionEnum,
  type SliceResult,
} from "../../../shared";

export function tileCoordinateToString(coord: TileCoordinate): string {
  return `(${coord.x}, ${coord.y})`;
}
export class Player<TState extends BaseState> {
  info: PlayerInfo;

  getActionCallback: (state: TState) => Promise<[Action, Board[] | undefined]>;

  /**
   * Creates a new Player.
   * @param info - Basic info about the player, including their name and turn
   * order.
   * @param getActionCallback - This function is called when it is this player's
   * turn to act. It should return a promise that resolves to the action the
   * player wants to take. It can also optionally return an array of new boards
   * that will be compared to the ones this action creates, and if any of the
   * boards are identical, then the provided board will be used instead (i.e.
   * retaining the provided UUID)
   */
  constructor(
    name: string,
    turnRemainder: number,
    getActionCallback: (state: TState) => Promise<[Action, Board[] | undefined]>
  ) {
    this.info = { uuid: generateUUID(), name, turnRemainder };
    this.getActionCallback = getActionCallback;
  }

  public async getAction(
    state: TState
  ): Promise<[Action, Board[] | undefined]> {
    return this.getActionCallback(state);
  }
}

/**
 * A simple hash function for boards, used for comparing boards.
 * @param board
 */
export function boardHash(board: Board): string {
  const dimensionHash = `${board.dimensions.width}:${board.dimensions.height}`;
  // Boards can have many marked coordinates and we don't want hashes getting
  // extremely long, so we will treat the board as a grid and create a binary
  // representation of the marked coordinates, which we can then store as a
  // simple integer.

  let markedHash = 0;
  for (const coord of board.markedCoordinates) {
    const index = coord.y * board.dimensions.width + coord.x;
    markedHash |= 1 << index;
  }
  const markedHashString = intToAlphaNumeric(markedHash);

  return `${dimensionHash}-${markedHashString}`;
}

/**
 * NOT CRYPTOGRAPHICALLY SECURE
 *
 * Generates a simple small UUID-like string for identifying boards and players.
 * Collision resistance is not super important, as this is just for identifying
 * objects in memory, not for security. However, it should be reasonably
 * unlikely to collide. The trade off is made for human readability and ease of
 * use.
 * @returns A random string of alphanumeric characters.
 */
function generateUUID(): string {
  const len = 6;
  const base62chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // Base 62
  return generateRandomString(len, base62chars);
}
function intToAlphaNumeric(num: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const base = chars.length;
  let result = "";
  while (num > 0) {
    result = chars.charAt(num % base) + result;
    num = Math.floor(num / base);
  }
  return result;
}

function generateRandomString(len: number, chars: string): string {
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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

export function actionToString(action: Action): string {
  const dir = action.slice.direction === Direction.Horizontal ? "H" : "V";
  return `${dir}${action.slice.line} / ${boardHash(action.board)} {${
    action.board.uuid
  }}`;
}

export interface Rule {
  name: string;
  description: string;
  condition: Function;
}

interface WinCondition<TState extends BaseState> extends Rule {
  // A win condition determines if the game is over, and if it is, who the
  // winner is (or winners, in case of multiple, such as a tie).
  condition: (state: TState) => PlayerInfo[] | null; // Returns the info of the winning player, or null if no winner yet
}

const NoMovesWinCondition: WinCondition<BaseState> = {
  condition: (state: BaseState): PlayerInfo[] | null => {
    // If a player has no valid moves, they lose.
    const availableActions = state.availableActions;
    if (availableActions.length === 0) {
      return [state.previousPlayer];
    }
    return null;
  },
  name: "No Moves Left",
  description:
    "The game ends when a player has no valid moves available. The other player wins.",
};

const NoMovesHighestScoreWinCondition: WinCondition<BaseState> = {
  condition: (state: BaseState): PlayerInfo[] | null => {
    // If a player has no valid moves, the game ends and the player with the
    // highest score wins. If multiple players have the highest score, they all
    // win (tie).
    const availableActions = state.availableActions;

    if (availableActions.length === 0) {
      let highestScore = -Infinity;
      for (const player of state.players) {
        const playerScore = state.scores[player.uuid] || 0;
        if (playerScore > highestScore) {
          highestScore = playerScore;
        }
      }
      const winners: PlayerInfo[] = [];
      for (const player of state.players) {
        const playerScore = state.scores[player.uuid] || 0;
        if (playerScore === highestScore) {
          winners.push(player);
        }
      }
      return winners;
    }
    return null;
  },
  name: "No Moves Highest Score",
  description:
    "The game ends when a player has no valid moves available. The player with the highest score wins.",
};

const NoMovesLowestScoreWinCondition: WinCondition<BaseState> = {
  condition: (state: BaseState): PlayerInfo[] | null => {
    // If a player has no valid moves, the game ends and the player with the
    // lowest score wins. If multiple players have the lowest score, they all
    // win (tie).
    const availableActions = state.availableActions;
    if (availableActions.length === 0) {
      let lowestScore = Infinity;
      const winners: PlayerInfo[] = [];
      for (const player of state.players) {
        const playerScore = state.scores[player.uuid] || 0;
        if (playerScore < lowestScore) {
          lowestScore = playerScore;
          winners.length = 0; // Clear previous winners
          winners.push(player);
        } else if (playerScore === lowestScore) {
          winners.push(player);
        }
      }
      return winners;
    }
    return null;
  },
  name: "No Moves Lowest Score",
  description:
    "The game ends when a player has no valid moves available. The player with the lowest score wins.",
};

interface ScoreCondition extends Rule {
  // A score condition determines if a slice results in points being awarded to
  // a player, and if so, how many points.
  condition: (turnResult: TurnResult) => Map<string, number> | undefined; // Returns a map of PlayerInfo.uuid to score change, or undefined if no score change
}

const MarkedSquaresScoreCondition: ScoreCondition = {
  condition: (turnResult: TurnResult): Map<string, number> | undefined => {
    // Awards points to the player for each marked square removed from the board
    const scoreChanges = new Map<string, number>();
    const playerUuid = turnResult.turn.player.uuid;
    let points = 0;
    for (const removedBoard of turnResult.sliceResult.removedBoards) {
      points += removedBoard.markedCoordinates.length;
    }
    if (points > 0) {
      scoreChanges.set(playerUuid, points);
      return scoreChanges;
    }
    return undefined;
  },
  name: "Marked Squares",
  description:
    "Points are awarded for each marked square removed from the board.",
};

const TotalAreaScoreCondition: ScoreCondition = {
  condition: (turnResult: TurnResult): Map<string, number> | undefined => {
    // Awards points to the player for the total area of the removed boards
    const scoreChanges = new Map<string, number>();
    const playerUuid = turnResult.turn.player.uuid;
    let totalArea = 0;
    for (const removedBoard of turnResult.sliceResult.removedBoards) {
      totalArea +=
        removedBoard.dimensions.width * removedBoard.dimensions.height;
    }
    if (totalArea > 0) {
      scoreChanges.set(playerUuid, totalArea);
      return scoreChanges;
    }
    return undefined;
  },
  name: "Total Area",
  description: "Points are awarded for the total area of the removed boards.",
};

export interface TurnResult {
  turn: Turn;
  inState: BaseState;
  outState: BaseState;
  sliceResult: SliceResult;
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

  boards: Record<string, Board>; // Keyed by Board.uuid
  players: PlayerInfo[]; // Players should be sorted by their turnRemainder, should equal index
  scores: Record<string, number> = {}; // Keyed by PlayerInfo.uuid
  turnHistory: Turn[];
  postTurnUpdaters: ((turnResult: TurnResult) => void)[];

  constructor(
    players: PlayerInfo[],
    boards: Board[],
    postTurnUpdaters?: ((turnResult: TurnResult) => void)[]
  ) {
    this.boards = boards.reduce((acc, board) => {
      acc[board.uuid] = board;
      return acc;
    }, {} as Record<string, Board>);
    this.players = players;
    this.players.sort((a, b) => a.turnRemainder - b.turnRemainder);
    this.turnHistory = [];
    this.scores = {};
    for (const player of players) {
      this.scores[player.uuid] = 0;
    }
    this.postTurnUpdaters = postTurnUpdaters || [];
  }

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

  get currentTurnNumber(): number {
    return this.turnHistory.length;
  }

  get currentPlayer(): PlayerInfo {
    return this.players[this.currentTurnNumber % this.players.length];
  }

  get previousPlayer(): PlayerInfo {
    return this.players[
      (this.currentTurnNumber - 1 + this.players.length) % this.players.length
    ];
  }
}

// Base class for a Divinim game
export class Game<TState extends BaseState> {
  state: TState;
  players: Player<TState>[];
  // Players should be sorted by their turnRemainder
  winConditions: WinCondition<BaseState>[];
  scoreConditions: ScoreCondition[];

  constructor(
    initialState: TState,
    players: Player<TState>[],
    winConditions: WinConditionEnum[],
    scoreConditions: ScoreConditionEnum[]
  ) {
    this.state = initialState;
    this.players = players;
    this.players.sort((a, b) => a.info.turnRemainder - b.info.turnRemainder);
    this.winConditions = winConditions.map((wc) => {
      switch (wc) {
        case WinConditionEnum.NoMovesLeft:
          return NoMovesWinCondition;
        case WinConditionEnum.HighestScore:
          return NoMovesHighestScoreWinCondition;
        case WinConditionEnum.LowestScore:
          return NoMovesLowestScoreWinCondition;
      }
    });
    this.scoreConditions = scoreConditions.map((sc) => {
      switch (sc) {
        case ScoreConditionEnum.MarkedSquares:
          return MarkedSquaresScoreCondition;
        case ScoreConditionEnum.TotalArea:
          return TotalAreaScoreCondition;
      }
    });
  }

  get availableActions(): Action[] {
    // For each board, a slice can be made between any two tiles, or
    // equivalently between any two rows or columns.
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
  public get winners(): PlayerInfo[] {
    // Returns the info of the winning players, or an empty array if no winner
    // yet
    const winners: PlayerInfo[] = [];
    for (const winCondition of this.winConditions) {
      const result = winCondition.condition(this.state);
      if (result) {
        winners.push(...result);
      }
    }
    return winners;
  }

  public simulateTurn(turn: Turn, requestedNewBoards?: Board[]): TState {
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

    const scoreChanges: Record<string, number> = {};
    for (const scoreCondition of this.scoreConditions) {
      const result = scoreCondition.condition(turnResult);
      if (result) {
        for (const [playerUuid, scoreChange] of result.entries()) {
          if (!scoreChanges[playerUuid]) {
            scoreChanges[playerUuid] = 0;
          }
          scoreChanges[playerUuid] += scoreChange;
        }
      }
    }

    for (const [playerUuid, scoreChange] of Object.entries(scoreChanges)) {
      stateCopy.scores[playerUuid] += scoreChange;
    }

    // If the player provided new boards that match the child or reduced board,
    // use it instead to retain of those to retain the UUID (and any other
    // properties)

    if (requestedNewBoards) {
      for (const requestedBoard of requestedNewBoards) {
        if (
          turnResult.sliceResult.boards.childBoard &&
          boardHash(turnResult.sliceResult.boards.childBoard) ===
            boardHash(requestedBoard)
        ) {
          stateCopy.boards[requestedBoard.uuid] = requestedBoard;
          delete stateCopy.boards[
            turnResult.sliceResult.boards.childBoard.uuid
          ];
          turnResult.sliceResult.boards.childBoard = requestedBoard;
        } else if (
          turnResult.sliceResult.boards.reducedBoard &&
          boardHash(turnResult.sliceResult.boards.reducedBoard) ===
            boardHash(requestedBoard)
        ) {
          stateCopy.boards[requestedBoard.uuid] = requestedBoard;
          delete stateCopy.boards[
            turnResult.sliceResult.boards.reducedBoard.uuid
          ];
          turnResult.sliceResult.boards.reducedBoard = requestedBoard;
        }
      }
    }

    stateCopy.postTurnUpdaters.forEach((updater) => {
      updater(turnResult);
    });

    return stateCopy;
  }

  public playTurn(turn: Turn, requestedNewBoards?: Board[]): void {
    const newState = this.simulateTurn(turn, requestedNewBoards);

    this.state = newState;
    this.state.turnHistory.push(turn);
    console.log(
      `Board UUIDs after turn ${this.state.turnHistory.length}:`,
      Object.keys(this.state.boards)
    );
  }

  public async playLoop(): Promise<void> {
    console.log(`starting board UUIDs:`, Object.keys(this.state.boards));
    while (true) {
      const currentPlayer = this.currentPlayer();
      if (!currentPlayer) throw new Error("No current player found");

      const [action, requestedNewBoards] = await this.requestPlayerAction(
        currentPlayer
      );
      if (this.isValidAction(action)) {
        this.playTurn(
          {
            player: currentPlayer.info,
            action: action,
          },
          requestedNewBoards
        );
      }

      if (this.winners.length > 0) {
        break;
      }
    }
  }

  public async requestPlayerAction(
    player: Player<TState>
  ): Promise<[Action, Board[] | undefined]> {
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
    return this.state.currentTurnNumber;
  }

  public currentPlayer(): Player<TState> | null {
    const pInfo = this.state.currentPlayer;
    return this.players[pInfo.turnRemainder] || null;
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

  constructor(
    turnRemainder: number,
    name: string = "Random CPU",
    delayMs = 1000
  ) {
    super(name, turnRemainder, (state: BaseState) => {
      const actions = state.availableActions;
      if (actions.length === 0) {
        return Promise.reject("No available actions");
      }
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve([randomAction, undefined]);
        }, this.delayMs);
      });
    });
    this.delayMs = delayMs;
  }
}
