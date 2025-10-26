export enum ClientToServerSocketEvents {
  CONNECTION = "connection",
  DISCONNECT = "disconnect",
  START_SESSION = "start-session",
  JOIN_SESSION = "join-session",
  TURN = "turn",
  NEW_GAME = "new-game",
}

export enum ServerToClientSocketEvents {
  SESSION_STARTED = "session-started",
  SESSION_UPDATED = "session-updated",
}
export interface SessionInfo {
  id: string;
  lastUpdated: number;
  turns?: Turn[];
  startingBoard?: Board;
  ruleset: Ruleset;
  players: PlayerInfo[];
}

export enum WinCondition {
  NoMovesLeft,
  HighestScore,
  LowestScore,
}

export enum ScoreCondition {
  None,
  MarkedSquares,
  TotalArea,
}

export interface Ruleset {
  winCondition: WinCondition;
  scoreCondition: ScoreCondition;
}

export interface ServerMessageData {
  sessionId: string;
  session: SessionInfo;
}

export interface StartSessionData {
  playerInfo: PlayerInfo;
  ruleset: Ruleset;
}

export interface JoinSessionData {
  sessionId: string;
  playerInfo: PlayerInfo;
}

export interface TurnData {
  sessionId: string;
  turn: Turn;
}

export interface Action {
  slice: Slice;
  board: Board;
}

export interface Turn {
  player: PlayerInfo;
  action: Action;
}

export interface PlayerInfo {
  uuid: string;
  name: string;
  turnRemainder: number; // The player's turn is when (turn number % player count) == turn modulo
}

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

export interface Board {
  // In Divinim, a board is a grid of tiles arranged in rows and columns. Some
  // coordinates are "marked" / "poisoned".
  dimensions: BoardDimensions;
  markedCoordinates: TileCoordinate[];
  uuid: string;
}

export interface TileCoordinate {
  // Coordinates start from the top-left corner (0, 0), like pixels, not like
  // regular cartesian coordinates.
  x: number;
  y: number;
}

export interface BoardDimensions {
  width: number;
  height: number;
}
