<script lang="ts">
import { ClipboardIcon } from "lucide-vue-next";
import { io, type Socket } from "socket.io-client";
import { defineComponent } from "vue";
import {
  ClientToClientMessageType,
  ClientToServerMessageType,
  ServerToClientMessageType,
  type Board,
  type ClientToServerMessage,
  type JoinSessionData,
  type NewGameData,
  type NewGameMessage,
  type Ruleset,
  type ServerToClientMessage,
  type ServerToClientMessageData,
  type SessionInfo,
  type StartSessionData,
  type TurnData,
  type TurnMessage,
} from "../../../shared";
import { type TurnResult } from "../model/BaseModel";
import { NetworkRole } from "./GameSetupStore";

const websocketUrl = import.meta.env.PUBLIC_WEBSOCKET_URL;

if (!websocketUrl) {
  throw new Error("PUBLIC_WEBSOCKET_URL is not set");
}

const websocketPath = import.meta.env.PUBLIC_WEBSOCKET_PATH;

if (!websocketPath) {
  throw new Error("PUBLIC_WEBSOCKET_PATH is not set");
}
export default defineComponent({
  name: "NetworkSessionSetup",
  components: {
    ClipboardIcon,
  },
  props: {
    session: {
      type: Object as () => SessionInfo,
      required: false,
    },
    ruleset: {
      type: Object as () => Ruleset,
      required: true,
    },
    networkRole: {
      type: String as () => NetworkRole,
      required: true,
    },
  },
  emits: [
    "update:session",
    "update:ruleset",
    "update:networkRole",
    "newGameWithBoards",
  ],
  data() {
    return {
      NetworkRoleEnum: NetworkRole,
      networkRoleInput: this.networkRole,
      socket: undefined as Socket | undefined,
      sessionIdInput: "" as string,
    };
  },
  methods: {
    changeNetworkRole(role: string) {
      this.$emit("update:networkRole", role as NetworkRole);
    },
    newSession() {
      const socket = io(websocketUrl, {
        path: websocketPath,
        transports: ["websocket"],
      });
      socket.on("connect", () => {
        this.socket = socket;
        // Send start session request
        const startSessionData: StartSessionData = {
          playerInfo: {
            uuid: "player-" + Math.random().toString(36).substring(2, 15),
            name: "Host Player",
            turnRemainder: 0,
          },
          ruleset: this.ruleset!,
        };
        const startSessionMessage: ClientToServerMessage = {
          type: ClientToServerMessageType.StartSession,
          data: startSessionData,
        };
        socket.emit(
          ClientToServerMessageType.StartSession,
          startSessionMessage
        ); // Request server start a session
      });
      socket.on("disconnect", () => {
        console.error("Disconnected from multiplayer server");
        this.socket = undefined;
      });
      socket.on(
        ServerToClientMessageType.StartSuccess,
        (msg: ServerToClientMessage) => {
          // Respond to the session started below
          this.$emit(
            "update:session",
            (msg.data as ServerToClientMessageData).session
          );
        }
      );
      socket.on(
        ServerToClientMessageType.StartFailure,
        (msg: ServerToClientMessage) => {
          console.error("Session failed:", msg);
        }
      );
      socket.on(
        ServerToClientMessageType.SessionUpdated,
        (msg: ServerToClientMessage) => {
          this.$emit(
            "update:session",
            (msg.data as ServerToClientMessageData).session
          );
        }
      );
      this.attachNewGameListener();
    },
    leaveSession() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = undefined;
      }
      this.$emit("update:session", undefined);
    },
    joinSession(sessionId: string) {
      if (this.socket) {
        this.socket.close();
        this.socket = undefined;
      }

      const socket = io(websocketUrl, {
        path: websocketPath,
        transports: ["websocket"],
      });
      this.socket = socket;

      socket.on("connect", () => {
        this.socket = socket;
        // Send join session request
        const joinSessionData: JoinSessionData = {
          sessionId: sessionId,
          playerInfo: {
            uuid: "player-" + Math.random().toString(36).substring(2, 15),
            name: "Joining Player",
            turnRemainder: 1,
          },
        };
        const joinSessionMessage: ClientToServerMessage = {
          type: ClientToServerMessageType.JoinSession,
          data: joinSessionData,
        };
        socket.emit(ClientToServerMessageType.JoinSession, joinSessionMessage); // Request server to join a session
      });
      socket.on("disconnect", () => {
        this.socket = undefined;
      });
      socket.on(
        ServerToClientMessageType.JoinSuccess,
        (msg: ServerToClientMessage) => {
          this.$emit(
            "update:session",
            (msg.data as ServerToClientMessageData).session
          );
        }
      );
      this.attachNewGameListener();
    },
    attachNewGameListener() {
      if (!this.socket) return;
      this.socket.on(
        ClientToClientMessageType.NewGame,
        (msg: NewGameMessage) => {
          const { boards, ruleset } = msg.data;
          this.$emit("update:ruleset", ruleset);
          this.$emit("newGameWithBoards", boards);
        }
      );
    },
    attachNetworkActionHandler(turnCallback: (action: TurnData) => void) {
      if (!this.socket) return;
      this.socket.on(ClientToClientMessageType.Turn, (msg: TurnMessage) => {
        turnCallback(msg.data);
      });
    },
    detachNetworkActionHandler() {
      if (!this.socket) return;
      this.socket.off(ClientToClientMessageType.Turn);
    },
    writeSessionIDToClipboard() {
      if (this.session) {
        navigator.clipboard.writeText(this.session.id).then(
          () => {},
          (err) => {
            console.error("Could not copy session ID: ", err);
          }
        );
      }
    },
    sendNewGameMessage(boards: Board[]) {
      if (this.sessionReady) {
        const newGameMessageData: NewGameData = {
          ruleset: this.ruleset!,
          boards: boards,
        };
        const newGameMessage: NewGameMessage = {
          type: ClientToClientMessageType.NewGame,
          data: newGameMessageData,
          sessionId: this.session!.id,
        };
        this.socket?.emit(ClientToClientMessageType.NewGame, newGameMessage);
      }
    },
    sendTurnMessage(turnResult: TurnResult) {
      if (this.sessionReady) {
        const turnMessageData: TurnData = {
          turn: turnResult.turn,
          sliceResult: turnResult.sliceResult,
        };
        const turnMessage: TurnMessage = {
          type: ClientToClientMessageType.Turn,
          data: turnMessageData,
          sessionId: this.session!.id,
        };
        this.socket?.emit(ClientToClientMessageType.Turn, turnMessage);
      }
    },
  },
  setup() {
    return {};
  },
  computed: {
    sessionReady(): boolean {
      // A session is ready if we have a session with two players
      return this.session !== undefined && this.session.players.length >= 2;
    },
  },
});
</script>
<template>
  <fieldset class="fieldset">
    <select
      class="select"
      v-model="networkRoleInput"
      @change="changeNetworkRole(networkRoleInput)"
      :disabled="session !== undefined"
    >
      <option :value="NetworkRoleEnum.NetworkInitiator">Host a new game</option>
      <option :value="NetworkRoleEnum.NetworkJoiner">Join a game</option>
    </select>
  </fieldset>
  <fieldset
    class="fieldset"
    v-if="networkRole === NetworkRoleEnum.NetworkJoiner"
  >
    <label class="label">
      <span class="label-text">Session ID</span>
    </label>
    <input
      type="text"
      placeholder="Enter Session ID"
      class="input input-bordered w-full"
      v-model="sessionIdInput"
      :disabled="session !== undefined"
    />
    <button
      class="btn btn-success btn-sm mt-2"
      :disabled="session !== undefined || !sessionIdInput"
      @click="joinSession(sessionIdInput!)"
    >
      Join Session
    </button>
  </fieldset>
  <fieldset
    class="fieldset"
    v-if="networkRole === NetworkRoleEnum.NetworkInitiator"
  >
    <legend class="fieldset-legend">Create a New Session:</legend>
    <button
      class="btn btn-success btn-sm mt-2"
      @click="newSession"
      :disabled="session !== undefined"
    >
      New Session
    </button>
    <legend class="fieldset-legend">Your Session ID:</legend>
    <label class="input input-bordered w-full">
      <input
        type="text"
        :value="session ? session!.id : ''"
        class="font-mono"
        readonly
      />
      <ClipboardIcon
        class="size-4 ml-2 cursor-pointer"
        :title="sessionReady ? 'Copy Session ID to clipboard' : ''"
        @click="writeSessionIDToClipboard()"
      />
    </label>
  </fieldset>
  <fieldset
    class="fieldset"
    v-if="
      (networkRole === NetworkRoleEnum.NetworkInitiator ||
        networkRole === NetworkRoleEnum.NetworkJoiner) &&
      session
    "
  >
    <legend class="fieldset-legend">Connected Players:</legend>
    <ul class="list-disc list-inside">
      <li v-for="player in session ? session.players : []" :key="player.uuid">
        Player {{ player.turnRemainder + 1 }}: {{ player.name }} ({{
          player.uuid
        }})
      </li>
    </ul>
    <button
      class="btn btn-error btn-sm mt-2 w-fit place-self-end"
      :class="{ disabled: !session }"
      @click="leaveSession()"
    >
      Leave Session
    </button>
  </fieldset>
</template>
<style scoped></style>
