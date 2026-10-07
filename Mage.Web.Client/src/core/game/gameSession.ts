import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Api } from '../../protocol/generated/api';
import type { GameClientMessage, GameEndView, GameView } from '../../protocol/generated/views';
import type { EventBus } from '../rpc/EventBus';
import type { ServerEvent } from '../rpc/RpcClient';
import { deriveInteraction, type Command, type Interaction } from './interaction';
import { PROMPT_EVENTS, parsePrompt, promptGameView, stripMarkup, type Prompt, type PromptEventName } from './prompt';
import { structuralShare } from './structuralShare';

export type GameSessionMode = 'play' | 'watch' | 'replay';

export interface GameNotice {
  id: number;
  kind: 'inform' | 'personal' | 'error';
  text: string;
  at: number;
}

export interface GameSessionState {
  gameId: string;
  /** the player we control (null when watching) */
  playerId: string | null;
  mode: GameSessionMode;
  view: GameView | null;
  prompt: Prompt | null;
  interaction: Interaction;
  /** an answer was sent and the server has not asked anything new yet */
  awaitingServer: boolean;
  /** latest status line from the server ("Waiting for Bob", "Bob casts ...") */
  status: string | null;
  notices: GameNotice[];
  /** final message when the game ends */
  gameOver: string | null;
  endInfo: GameEndView | null;
}

const MAX_NOTICES = 50;
/**
 * After an answer, the last prompt stays on screen this long while the server works. The next prompt usually
 * arrives sooner and replaces it directly, so highlights and buttons don't blink off and on between decisions.
 */
const PROMPT_HOLD_MS = 350;

/**
 * Client side of one game: applies server events for that game and sends the player's answers.
 * State lives in a vanilla zustand store so React and tests can both read it.
 */
export class GameSession {
  readonly store: StoreApi<GameSessionState>;
  private readonly unsubscribers: (() => void)[] = [];
  private noticeId = 0;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: Api,
    bus: EventBus,
    init: { gameId: string; playerId: string | null; mode: GameSessionMode },
  ) {
    this.store = createStore<GameSessionState>(() => ({
      gameId: init.gameId,
      playerId: init.playerId,
      mode: init.mode,
      view: null,
      prompt: null,
      interaction: deriveInteraction(null, null),
      awaitingServer: false,
      status: null,
      notices: [],
      gameOver: null,
      endInfo: null,
    }));

    const forThisGame = <T>(handler: (data: T, event: ServerEvent) => void) =>
      (data: T, event: ServerEvent) => {
        if (event.objectId === null || event.objectId === init.gameId) handler(data, event);
      };

    this.unsubscribers.push(
      bus.on('GAME_INIT', forThisGame<GameView>((view) => this.applyView(view))),
      bus.on('GAME_UPDATE', forThisGame<GameView>((view) => this.applyView(view))),
      bus.on('REPLAY_INIT', forThisGame<GameView>((view) => this.applyView(view))),
      bus.on('REPLAY_UPDATE', forThisGame<GameView>((view) => this.applyView(view))),
      bus.on('GAME_UPDATE_AND_INFORM', forThisGame<GameClientMessage>((message) => {
        this.applyView(message?.gameView);
        const text = stripMarkup(message?.message);
        if (text) this.store.setState({ status: text });
      })),
      bus.on('GAME_INFORM_PERSONAL', forThisGame<GameClientMessage>((message) => {
        this.applyView(message?.gameView);
        this.addNotice('personal', stripMarkup(message?.message));
      })),
      bus.on('GAME_ERROR', forThisGame<string>((message) => this.addNotice('error', stripMarkup(message)))),
      bus.on('GAME_OVER', forThisGame<GameClientMessage>((message) => {
        this.applyView(message?.gameView);
        this.store.setState({ gameOver: stripMarkup(message?.message) || 'Game over', prompt: null, awaitingServer: false });
        this.refreshInteraction();
      })),
      bus.on('END_GAME_INFO', forThisGame<GameEndView>((info) => this.store.setState({ endInfo: info }))),
      bus.on('REPLAY_DONE', forThisGame<string>((message) => {
        this.store.setState({ gameOver: stripMarkup(message) || 'Replay finished' });
      })),
    );

    for (const method of PROMPT_EVENTS) {
      this.unsubscribers.push(bus.on(method, forThisGame((data) => this.applyPrompt(method, data))));
    }
  }

  getState(): GameSessionState {
    return this.store.getState();
  }

  private clearHold(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  dispose(): void {
    this.clearHold();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  /** Send an answer for the current prompt (or a player action, which needs no prompt). */
  async respond(command: Command): Promise<void> {
    const { gameId, playerId } = this.store.getState();
    if (command.type !== 'action') {
      // the server will ask again (or move on); until then clicks are ignored, and the answered prompt fades out
      // only if nothing new arrives soon
      this.store.setState({ awaitingServer: true });
      this.clearHold();
      this.holdTimer = setTimeout(() => {
        this.holdTimer = null;
        if (!this.store.getState().awaitingServer) return;
        this.store.setState({ prompt: null });
        this.refreshInteraction();
      }, PROMPT_HOLD_MS);
    }
    try {
      switch (command.type) {
        case 'uuid':
          await this.api.sendPlayerUUID(gameId, command.id);
          break;
        case 'boolean':
          await this.api.sendPlayerBoolean(gameId, command.value);
          break;
        case 'string':
          await this.api.sendPlayerString(gameId, command.value);
          break;
        case 'integer':
          await this.api.sendPlayerInteger(gameId, command.value);
          break;
        case 'manaType':
          if (!playerId) throw new Error('Only players can pay mana');
          await this.api.sendPlayerManaType(gameId, playerId, command.manaType);
          break;
        case 'action':
          await this.api.sendPlayerAction(command.action, gameId, command.data ?? null);
          break;
      }
    } catch (error) {
      this.store.setState({ awaitingServer: false });
      this.addNotice('error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /** Click on a card, permanent, player or stack object; returns false when the object is not clickable now. */
  click(objectId: string): boolean {
    const command = this.store.getState().interaction.clickable.get(objectId);
    if (!command || this.store.getState().awaitingServer) return false;
    void this.respond(command).catch(() => undefined);
    return true;
  }

  private applyView(incoming: GameView | null | undefined, fromPrompt = false): void {
    if (!incoming || typeof incoming !== 'object') return;
    const { view: previous, prompt, awaitingServer } = this.store.getState();
    // The server only lists playable objects in views built while this player holds priority. An update sent
    // mid-decision (after a draw, a trigger...) can arrive without them; it must not wipe what the open prompt
    // offers, or highlights vanish and auto-pass would think there is nothing to do.
    const hasPlayables = (candidate: GameView | null | undefined) => Object.keys(candidate?.canPlayObjects?.objects ?? {}).length > 0;
    // (a prompt's own view is built with priority, so it is always taken as is)
    const view = !fromPrompt && prompt && !awaitingServer && hasPlayables(previous) && !hasPlayables(incoming)
      ? { ...incoming, canPlayObjects: previous!.canPlayObjects }
      : incoming;
    const next = previous ? structuralShare(previous, view) : view;
    if (next === previous) return;
    const playerId = this.store.getState().playerId ?? (this.store.getState().mode === 'play' ? view.myPlayerId ?? null : null);
    this.store.setState({ view: next, playerId });
    this.refreshInteraction();
  }

  private applyPrompt(method: PromptEventName, data: unknown): void {
    this.applyView(promptGameView(method, data), true);
    if (this.store.getState().mode !== 'play') return;
    const prompt = parsePrompt(method, data as never);
    this.clearHold();
    this.store.setState({ prompt, awaitingServer: false });
    this.refreshInteraction();
  }

  private refreshInteraction(): void {
    const { view, prompt, interaction } = this.store.getState();
    const next = deriveInteraction(view, prompt);
    if (next !== interaction) this.store.setState({ interaction: next });
  }

  private addNotice(kind: GameNotice['kind'], text: string): void {
    if (!text) return;
    const notice: GameNotice = { id: ++this.noticeId, kind, text, at: Date.now() };
    this.store.setState((state) => ({ notices: [...state.notices, notice].slice(-MAX_NOTICES) }));
  }
}
