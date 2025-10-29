// Clients communicate essentially peer to peer, with the server acting as a
// simple mirror once a session is established.

export enum ClientToServerMessageType {
  StartSession = "start-session",
  JoinSession = "join-session",
}
export enum ServerToClientMessageType {
  JoinSuccess = "session-joined",
  JoinFailure = "session-join-failure",
  StartSuccess = "session-started",
  StartFailure = "session-start-failure",
  SessionUpdated = "session-updated",
  // May add more if the server does validation for turns for example.
}
export enum ClientToClientMessageType {
  // These messages are sent between clients via the server not literally peer to
  // peer.
  Turn = "turn",
  NewGame = "new-game",
}

export interface ServerToClientMessage {
  type: ServerToClientMessageType;
  data: ServerToClientMessageData | string; // string for error messages
}

export interface ClientToServerMessage {
  type: ClientToServerMessageType;
  data: StartSessionData | JoinSessionData;
}

export interface StartSessionMessage extends ClientToServerMessage {
  type: ClientToServerMessageType.StartSession;
  data: StartSessionData;
}

export interface JoinSessionMessage extends ClientToServerMessage {
  type: ClientToServerMessageType.JoinSession;
  data: JoinSessionData;
}

export interface ClientToClientMessage {
  type: ClientToClientMessageType;
  sessionId: string;
  data: TurnData | NewGameData;
}

export interface TurnMessage extends ClientToClientMessage {
  type: ClientToClientMessageType.Turn;
  data: TurnData;
}

export interface NewGameMessage extends ClientToClientMessage {
  type: ClientToClientMessageType.NewGame;
  data: NewGameData;
}

export interface NewGameData {
	ruleset: Ruleset;
	boards: Board[];
}

export interface SessionInfo {
  id: string;
  lastUpdated: number;
  players: PlayerInfo[];
}

export enum WinCondition {
  NoMovesLeft,
  HighestScore,
  LowestScore,
}

export enum ScoreCondition {
  MarkedSquares,
  TotalArea,
}

export interface Ruleset {
  winCondition: WinCondition;
  scoreCondition?: ScoreCondition;
}

export interface ServerToClientMessageData {
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
