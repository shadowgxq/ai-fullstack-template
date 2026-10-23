import { getAuthSession, onSessionChange, type AuthSession } from '../../shared/api/auth-token';
import { abortError, ApiError, errorMessage } from '../../shared/api/errors';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { PendingCreate } from '../wardrobe/draft';
import type { Garment } from '../wardrobe/api';
import {
  recommendationApi,
  type Recommendation,
  type RecommendationCreate,
  type Selection,
} from './api';

export interface OutfitState {
  view: Recommendation | null;
  submitted: RecommendationCreate | null;
  selectedIds: string[];
  garments: Garment[];
  selection: Selection | null;
  checking: boolean;
  selectionError: string | null;
  creating: boolean;
  uncertain: boolean;
  cancelling: boolean;
  refreshing: boolean;
  error: string | null;
}
const initialState = (): OutfitState => ({
  view: null,
  submitted: null,
  selectedIds: [],
  garments: [],
  selection: null,
  checking: false,
  selectionError: null,
  creating: false,
  uncertain: false,
  cancelling: false,
  refreshing: false,
  error: null,
});
export function generating(view: Recommendation | null): boolean {
  return view?.status === 'dispatch_pending' || view?.status === 'generating';
}
export function canConfirm(state: OutfitState): boolean {
  return (
    state.view?.status === 'ready' &&
    Boolean(state.selection) &&
    !state.checking &&
    !state.cancelling &&
    !state.creating
  );
}

/** 同会话跨页保留创建身份和选择；离页只停查询，切号才丢弃整个拥有者。 */
export class OutfitSession {
  private state = initialState();
  private listeners = new Set<() => void>();
  private lifetime = new AbortController();
  private readController: AbortController | null = null;
  private selectionController: AbortController | null = null;
  private pending = new PendingCreate<RecommendationCreate>();
  private visible = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readSequence = 0;
  private selectionSequence = 0;
  constructor(
    readonly session: AuthSession,
    private readonly client = recommendationApi,
  ) {}
  snapshot = (): OutfitState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private active(): boolean {
    return !this.lifetime.signal.aborted && getAuthSession() === this.session;
  }
  private update(patch: Partial<OutfitState>) {
    if (!this.active()) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private stopRead() {
    clearTimeout(this.timer);
    this.readSequence += 1;
    this.readController?.abort();
    this.readController = null;
    this.update({ refreshing: false });
  }
  private schedule() {
    clearTimeout(this.timer);
    if (
      this.visible &&
      this.active() &&
      generating(this.state.view) &&
      !this.state.cancelling &&
      !this.state.error
    )
      this.timer = setTimeout(() => {
        void this.refresh();
      }, 2000);
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) this.stopRead();
    else if (this.state.view && !this.state.creating && !this.state.cancelling) void this.refresh();
  }
  refreshIfVisible() {
    if (this.visible) void this.refresh();
  }
  close() {
    this.stopRead();
    this.lifetime.abort();
    this.selectionController?.abort();
    this.listeners.clear();
    this.state = initialState();
  }
  private receive(view: Recommendation) {
    const wasReady =
      this.state.view?.request_id === view.request_id && this.state.view.status === 'ready';
    if (view.status !== 'ready') {
      this.selectionSequence += 1;
      this.selectionController?.abort();
      this.update({ view, selection: null, checking: false });
    } else if (!wasReady && view.result) {
      this.update({
        view,
        selectedIds: [...view.result.selected_ids],
        garments: view.result.garments,
        selection: view.result,
        checking: false,
        selectionError: null,
      });
    } else this.update({ view });
  }
  async generate(payload: RecommendationCreate): Promise<void> {
    if (
      !this.active() ||
      this.state.creating ||
      this.state.cancelling ||
      generating(this.state.view)
    )
      return;
    const frozen = this.state.uncertain ? this.state.submitted! : payload;
    this.stopRead();
    this.selectionSequence += 1;
    this.selectionController?.abort();
    const operation = this.pending.begin(frozen);
    this.update({ ...initialState(), submitted: operation.payload, creating: true });
    try {
      const view = await this.client.create(operation.payload, operation.key, this.lifetime.signal);
      if (!this.active()) return;
      if (view.scene !== operation.payload.scene)
        throw new ApiError('推荐场景与请求不匹配', 'invalid-response');
      this.pending.complete();
      this.receive(view);
    } catch (error) {
      if (this.active()) {
        this.pending.failed(error);
        this.update({ uncertain: this.pending.uncertain, error: errorMessage(error) });
      }
    } finally {
      this.update({ creating: false });
      this.schedule();
    }
  }
  async refresh(): Promise<void> {
    const view = this.state.view;
    if (
      !this.active() ||
      !view ||
      this.state.refreshing ||
      this.state.creating ||
      this.state.cancelling
    )
      return;
    const sequence = ++this.readSequence;
    const controller = new AbortController();
    this.readController = controller;
    this.update({ refreshing: true, error: null });
    try {
      const next = await this.client.read(view.request_id, controller.signal);
      if (this.active() && sequence === this.readSequence) {
        queryClient.setQueryData(
          sessionQueryKey(this.session, 'recommendations', view.request_id),
          next,
        );
        this.receive(next);
      }
    } catch (error) {
      if (this.active() && sequence === this.readSequence)
        this.update({ error: errorMessage(error) });
    } finally {
      if (this.active() && sequence === this.readSequence) {
        this.update({ refreshing: false });
        this.schedule();
      }
    }
  }
  async cancel(): Promise<void> {
    const view = this.state.view;
    if (!this.active() || !view || !generating(view) || this.state.cancelling) return;
    this.stopRead();
    this.update({ cancelling: true, error: null });
    try {
      const next = await this.client.cancel(view.request_id, this.lifetime.signal);
      if (this.active()) this.receive(next);
    } catch (error) {
      this.update({ error: errorMessage(error) });
    } finally {
      this.update({ cancelling: false });
      this.schedule();
    }
  }
  async replace(targetId: string, garment: Garment): Promise<void> {
    const index = this.state.selectedIds.indexOf(targetId);
    if (
      !this.active() ||
      this.state.view?.status !== 'ready' ||
      index < 0 ||
      garment.status !== 'wearable' ||
      this.state.selectedIds.some((id, i) => i !== index && id === garment.id)
    )
      return;
    const selected = [...this.state.selectedIds];
    selected[index] = garment.id;
    const garments = [...this.state.garments];
    garments[index] = garment;
    this.update({ selectedIds: selected, garments, selection: null, selectionError: null });
    await this.validate();
  }
  async validate(): Promise<Selection | null> {
    const view = this.state.view;
    if (
      !this.active() ||
      view?.status !== 'ready' ||
      !this.state.selectedIds.length ||
      this.state.cancelling
    )
      return null;
    this.selectionController?.abort();
    const controller = new AbortController();
    this.selectionController = controller;
    const sequence = ++this.selectionSequence;
    const selected = [...this.state.selectedIds];
    this.update({ checking: true, selection: null, selectionError: null });
    try {
      const selection = await this.client.validate(view.request_id, selected, controller.signal);
      if (
        !this.active() ||
        sequence !== this.selectionSequence ||
        this.state.view?.status !== 'ready'
      )
        return null;
      this.update({ selection, checking: false, garments: selection.garments });
      return selection;
    } catch (error) {
      if (this.active() && sequence === this.selectionSequence)
        this.update({ checking: false, selectionError: errorMessage(error) });
      return null;
    }
  }
  assertCurrent() {
    if (!this.active()) throw abortError();
  }
}
let current: OutfitSession | null = null;
onSessionChange(() => {
  current?.close();
  current = null;
});
export function outfitSession(session: AuthSession): OutfitSession {
  if (!current || current.session !== session) {
    current?.close();
    current = new OutfitSession(session);
  }
  return current;
}
