<template>
  <div class="size-full">
    <DrawerContent
      :drawerId="gameSetupDrawerId"
      drawerTitle="Game Setup"
      :drawerLeft="true"
    >
      <template #fabIcon>
        <PencilRulerIcon class="size-8" />
      </template>
      <template #content>
        <DrawerContent
          :drawerId="gameInfoDrawerId"
          drawerTitle="Current Game"
          :drawerLeft="false"
          v-if="game"
        >
          <template #fabIcon>
            <InfoIcon class="size-8" />
          </template>
          <template #content>
            <GameDisplay :interactive="true" :game="game" />
          </template>
          <template #drawerContent>
            <TabGroup
              :titles="['Turns', 'Info', 'Analysis']"
              groupName="infoTabs"
              v-model="activeTabInfo"
            >
              <template v-slot:Turns>
                <div class="flex flex-col gap-4 size-full">
                  <div class="flex-grow overflow-auto relative">
                    <table
                      class="table table-pin-rows table-xs w-full max-h-full overflow-scroll absolute inset-0"
                    >
                      <thead>
                        <tr>
                          <th>Turn</th>
                          <th>Player</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(entry, index) in game?.state.turnHistory"
                          :key="index"
                        >
                          <td>{{ index + 1 }}</td>
                          <td>{{ entry.player.name }}</td>
                          <td>{{ actionToString(entry.action) }}</td>
                        </tr>
                        <tr>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div
                    class="shrink-0 collapse collapse-arrow bg-base-100 border-base-300 border"
                  >
                    <input type="checkbox" />
                    <div
                      class="collapse-title font-semibold flex flex-row items-center gap-2"
                    >
                      <CircleQuestionMarkIcon class="inline-block" />
                      <span>Help</span>
                    </div>
                    <div
                      class="collapse-content text-sm max-h-48 overflow-auto"
                    >
                      <RulesDescription :ruleset="game.ruleset" />
                    </div>
                  </div>
                </div>
              </template>
              <template v-slot:Info>
                <RulesetDisplay :ruleset="game.ruleset" />
              </template>
              <template v-slot:Analysis>
                You will be able to see analysis of the current game here.
              </template>
            </TabGroup>
          </template>
        </DrawerContent>
      </template>
      <template #drawerContent>
        <TabGroup
          :titles="['Players', 'Rules', 'Boards']"
          groupName="setupTabs"
          v-model="activeTabSetup"
          :disabled="
            otherPlayerType === PlayerTypeEnum.Network &&
            networkRole === NetworkRoleEnum.NetworkJoiner
          "
        >
          <template v-slot:Players>
            <TabGroup
              :titles="[PlayerTypeEnum.AI, PlayerTypeEnum.Network]"
              groupName="networkSelectTabs"
              v-model="otherPlayerType"
              :disabled="session !== undefined"
            >
              <template v-slot:AI>
                <div groupName="networkSelectTabs" :isActive="true">
                  <fieldset class="fieldset">
                    <legend class="fieldset-legend">AI Strategy</legend>
                    <select class="select" v-model="aiStrategy">
                      <option :value="AIStrategyEnum.Random">Random</option>
                    </select>
                  </fieldset>
                  <fieldset
                    class="fieldset"
                    v-if="aiStrategy === AIStrategyEnum.Random"
                  >
                    <legend class="fieldset-legend">Random Player Delay</legend>
                    <input
                      type="range"
                      class="range range-primary"
                      min="0"
                      max="1000"
                      step="100"
                      v-model="randomPlayerDelay"
                    />
                    <div class="flex justify-between px-2.5 mt-2 text-xs">
                      <span>0 ms</span>
                      <span>1000 ms</span>
                    </div>
                  </fieldset>
                </div>
              </template>
              <template v-slot:Network>
                <NetworkSessionSetup
                  v-model:session="session"
                  @update:ruleset="updateRuleset"
                  :ruleset="uiRuleset"
                  v-model:networkRole="networkRole"
                  @newGameWithBoards="newGameWithBoards"
                  ref="networkSessionSetup"
                />
              </template>
            </TabGroup>
          </template>
          <template v-slot:Rules>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Win Conditions</legend>
              <select class="select" v-model="winCondition">
                <option :value="WinConditionEnum.NoMovesLeft">
                  No Moves Left - Last Player Wins
                </option>
                <option :value="WinConditionEnum.NoMovesHighestScore">
                  No Moves Left - Highest Score Wins
                </option>
                <option :value="WinConditionEnum.NoMovesLowestScore">
                  No Moves Left - Lowest Score Wins
                </option>
              </select>
            </fieldset>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Scoring System</legend>
              <select class="select" v-model="scoringSystem">
                <option :value="ScoringSystemEnum.None">Unscored</option>
                <option :value="ScoringSystemEnum.MarkedSquares">
                  Marked Squares
                </option>
                <option :value="ScoringSystemEnum.TotalArea">Total Area</option>
              </select>
            </fieldset>
          </template>
          <template v-slot:Boards>
            You will be able to select board configurations (dimensions and
            markings) here.
          </template>
        </TabGroup>

        <label
          :for="gameSetupDrawerId"
          @click="newGame"
          class="btn btn-primary btn-lg fixed bottom-0 right-0 m-8"
          :class="
            otherPlayerType === PlayerTypeEnum.Network &&
            (networkRole === NetworkRoleEnum.NetworkJoiner || !sessionReady())
              ? 'btn-disabled'
              : ''
          "
        >
          New Game <PlayIcon />
        </label>
      </template>
    </DrawerContent>
  </div>
</template>
<script lang="ts">
import { useVModel } from "@nanostores/vue";
import {
  CircleQuestionMarkIcon,
  ClipboardIcon,
  InfoIcon,
  PencilRulerIcon,
  PlayIcon,
} from "lucide-vue-next";
import { defineComponent } from "vue";
import {
  ScoreConditionEnum,
  WinConditionEnum,
  type Action,
  type Board,
  type Ruleset,
  type SessionInfo,
  type Slice,
  type TurnData,
} from "../../../shared";
import {
  actionToString,
  BaseState,
  Game,
  Player,
  randomBoard,
  RandomPlayer,
  type TurnResult,
} from "../model/BaseModel";
import { VisualPlayer, VisualState } from "../model/VisualModel";
import DrawerContent from "./DrawerContent.vue";
import GameDisplay from "./GameDisplay.vue";
import {
  gameSetupStore,
  AIStrategy as UIAIStrategyEnum,
  NetworkRole as UINetworkRoleEnum,
  PlayerType as UIPlayerTypeEnum,
  ScoringSystem as UIScoringSystemEnum,
  WinCondition as UIWinConditionEnum,
} from "./GameSetupStore";
import NetworkSessionSetup from "./NetworkSessionSetup.vue";
import RulesDescription from "./RulesDescription.vue";
import TabGroup from "./TabGroup.vue";
import TurnIndicator from "./TurnIndicator.vue";
import { uiStore } from "./UIStore";
import RulesetDisplay from "./RulesetDisplay.vue";

const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;

if (!backendUrl) {
  throw new Error("PUBLIC_BACKEND_URL is not set");
}

const publicUrl = import.meta.env.PUBLIC_URL;

if (!publicUrl) {
  throw new Error("PUBLIC_URL is not set");
}

const gameInfoDrawerId = "game-info-drawer";
const gameSetupDrawerId = "game-setup-drawer";

/**
 * A player that gets its actions from a network source.
 */
class NetworkPlayer extends Player<BaseState> {
  constructor(
    name: string,
    turnRemainder: number,
    getActionCallback: (
      state: BaseState
    ) => Promise<[Action, Board[] | undefined]>
  ) {
    super(name, turnRemainder, getActionCallback);
  }
}

export default defineComponent({
  components: {
    PencilRulerIcon,
    InfoIcon,
    PlayIcon,
    ClipboardIcon,
    CircleQuestionMarkIcon,
    GameDisplay,
    DrawerContent,
    TabGroup,
    TurnIndicator,
    RulesDescription,
    NetworkSessionSetup,
    RulesetDisplay,
  },
  emits: {},
  data() {
    return {
      PlayerTypeEnum: UIPlayerTypeEnum,
      WinConditionEnum: UIWinConditionEnum,
      ScoringSystemEnum: UIScoringSystemEnum,
      AIStrategyEnum: UIAIStrategyEnum,
      NetworkRoleEnum: UINetworkRoleEnum,
      game: undefined as Game<VisualState> | undefined,
      gameInfoDrawerId,
      gameSetupDrawerId,
      session: undefined as SessionInfo | undefined,
      networkRuleset: undefined as Ruleset | undefined,
    };
  },
  setup() {
    const otherPlayerType = useVModel(gameSetupStore, "otherPlayerType");
    const aiStrategy = useVModel(gameSetupStore, "aiStrategy");
    const networkRole = useVModel(gameSetupStore, "networkRole");
    const randomPlayerDelay = useVModel(gameSetupStore, "randomPlayerDelay");
    const winCondition = useVModel(gameSetupStore, "winCondition");
    const scoringSystem = useVModel(gameSetupStore, "scoringSystem");
    const activeTabInfo = useVModel(uiStore, "infoTab");
    const activeTabSetup = useVModel(uiStore, "setupTab");
    return {
      otherPlayerType,
      aiStrategy,
      networkRole,
      randomPlayerDelay,
      winCondition,
      scoringSystem,
      activeTabInfo,
      activeTabSetup,
    };
  },
  mounted() {
    this.newGame();
  },
  computed: {
    uiRuleset(): Ruleset {
      let scoreCondition: ScoreConditionEnum | undefined = undefined;
      switch (this.scoringSystem) {
        case UIScoringSystemEnum.MarkedSquares:
          scoreCondition = ScoreConditionEnum.MarkedSquares;
          break;
        case UIScoringSystemEnum.TotalArea:
          scoreCondition = ScoreConditionEnum.TotalArea;
          break;
        case UIScoringSystemEnum.None:
          scoreCondition = undefined;
          break;
        default:
          throw new Error(`Unknown scoring system: '${this.scoringSystem}'`);
      }

      let winCondition: WinConditionEnum;
      switch (this.winCondition) {
        case UIWinConditionEnum.NoMovesLeft:
          winCondition = WinConditionEnum.NoMovesLeft;
          break;
        case UIWinConditionEnum.NoMovesHighestScore:
          winCondition = WinConditionEnum.HighestScore;
          break;
        case UIWinConditionEnum.NoMovesLowestScore:
          winCondition = WinConditionEnum.LowestScore;
          break;
        default:
          throw new Error(`Unknown win condition: '${this.winCondition}'`);
      }
      return {
        winCondition: winCondition,
        scoreCondition: scoreCondition,
      };
    },
  },
  methods: {
    sessionReady(): boolean {
      // Use sessionReady from NetworkSessionSetup component
      return this.$refs.networkSessionSetup
        ? (this.$refs.networkSessionSetup as typeof NetworkSessionSetup)
            .sessionReady
        : false;
    },
    updateRuleset(newRuleset: Ruleset) {
      this.networkRuleset = newRuleset;
    },
    getVisualPlayer(): VisualPlayer | null {
      if (!this.game) return null;
      const players = this.game.players.filter(
        (p) => p instanceof VisualPlayer
      ) as VisualPlayer[];
      if (players.length === 0) return null;
      return players[0];
    },
    isWinnerVisualPlayer(): boolean {
      if (!this.game) return false;
      const winnerInfos = this.game.winners;
      if (winnerInfos.length === 0) return false;
      return winnerInfos.includes(this.getVisualPlayer()?.info!);
    },
    actionToString(action: Action): string {
      return actionToString(action);
    },
    newGameWithBoards(boards: Board[]) {
      if (
        this.otherPlayerType === this.PlayerTypeEnum.Network &&
        !this.sessionReady()
      ) {
        console.error("Cannot start network game: session not ready");
        return;
      }
      let otherPlayer;

      switch (this.otherPlayerType) {
        case UIPlayerTypeEnum.AI:
          otherPlayer = new RandomPlayer(
            1,
            "Random CPU",
            this.randomPlayerDelay
          );
          break;
        case UIPlayerTypeEnum.Network:
          // Similar pattern to the VisualPlayer's getActionCallback below,
          // but for the NetworkPlayer instead. When the NetworkPlayer needs
          // to make a turn, it will attach a temporary listener to the socket
          // to wait for the turn message from the other player. When the
          // message is received, it will call the actionCallback to resolve
          // the turn.

          const getNetworkActionCallback = (state: BaseState) => {
            return new Promise<[Action, Board[] | undefined]>((resolve) => {
              (
                this.$refs.networkSessionSetup as typeof NetworkSessionSetup
              ).attachNetworkActionHandler((turnData: TurnData) => {
                (
                  this.$refs.networkSessionSetup as typeof NetworkSessionSetup
                ).detachNetworkActionHandler();
                const boards = Object.values(
                  turnData.sliceResult.boards
                ).filter((b) => b !== null) as Board[];

                resolve([turnData.turn.action, boards]);
              });
            });
          };

          otherPlayer = new NetworkPlayer(
            "Network Player",
            this.networkRole === UINetworkRoleEnum.NetworkInitiator ? 1 : 0,
            getNetworkActionCallback
          );
          break;
        default:
          throw new Error(`Unknown player type: '${this.otherPlayerType}'`);
      }

      // We'll use a Promise and its resolver to "pipe" between
      // getActionCallback and actionCallback. When getActionCallback is called,
      // it returns a Promise<[Action, Board | undefined]> and stores its
      // resolver. When actionCallback is called (by the slice tool), it
      // resolves the stored Promise.

      let resolveAction: ((value: [Action, undefined]) => void) | null = null;

      // The actionCallback will be called inside the slice tool's onMouseDown /
      // onMouseUp functions. It shall resolve the getActionCallback promise
      const actionCallback = (slice: Slice, board: Board) => {
        if (resolveAction) {
          resolveAction([{ slice, board }, undefined]);
          resolveAction = null;
        }
      };

      // The getActionCallback will be used when the player needs to make a
      // turn. It shall just wait for the slice tool to be used, returns a
      // promise of an action.
      const getActionCallback = (state: VisualState) => {
        return new Promise<[Action, undefined]>((resolve) => {
          resolveAction = resolve;
        });
      };

      const visualPlayer = new VisualPlayer(
        "User",
        otherPlayer.info.turnRemainder === 0 ? 1 : 0,
        getActionCallback
      );

      let ruleset: Ruleset;
      if (this.networkRuleset) {
        ruleset = this.networkRuleset;
      } else {
        ruleset = this.uiRuleset;
      }

      this.game = new Game<VisualState>(
        new VisualState(
          [visualPlayer.info, otherPlayer.info],
          boards,
          actionCallback,
          [
            (turnResult: TurnResult) => {
              // Post turn updater to emit the slice and turn result to the
              // other player.
              (
                this.$refs.networkSessionSetup as typeof NetworkSessionSetup
              ).sendTurnMessage(turnResult);
            },
          ]
        ),
        [visualPlayer, otherPlayer],
        ruleset
      );

      this.game.playLoop();
      if (this.otherPlayerType === this.PlayerTypeEnum.Network) {
        // Send new game message to other player
        (
          this.$refs.networkSessionSetup as typeof NetworkSessionSetup
        ).sendNewGameMessage(boards);
      }
    },
    newGame() {
      const boards = [] as Board[];
      const maxBoards = 1;
      for (let i = 0; i < Math.floor(Math.random() * maxBoards + 1); i++) {
        boards.push(randomBoard());
      }

      this.newGameWithBoards(boards);
    },
  },
});
</script>

<style scoped></style>
