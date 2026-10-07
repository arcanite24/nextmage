import { create } from 'zustand';
import type { CardView } from '../../protocol/generated/views';

/** Local, per-match UI state: what is hovered, held or open. Game state lives in the GameSession. */
interface MatchUiState {
  /** card shown large next to the pointer */
  zoom: { card: CardView; x: number; y: number; sleeve?: string } | null;
  /** pointer position in stage coordinates (for the targeting arrow) */
  pointer: { x: number; y: number } | null;
  /** source of the current targeting arrow, in stage coordinates */
  arrowFrom: { x: number; y: number } | null;
  /** a hand card being dragged toward the battlefield */
  dragging: string | null;
  /** zone viewer (graveyard, exile...) */
  viewer: { title: string; cards: CardView[] } | null;
  logOpen: boolean;
  /** card opened in the detail view (right click); the id keeps it live as the game changes */
  detail: { id: string; card: CardView } | null;
  setZoom(zoom: MatchUiState['zoom']): void;
  setPointer(pointer: MatchUiState['pointer']): void;
  setArrowFrom(point: MatchUiState['arrowFrom']): void;
  setDragging(id: string | null): void;
  openViewer(viewer: MatchUiState['viewer']): void;
  toggleLog(open?: boolean): void;
  openDetail(detail: MatchUiState['detail']): void;
}

export const useMatchUi = create<MatchUiState>((set) => ({
  zoom: null,
  pointer: null,
  arrowFrom: null,
  dragging: null,
  viewer: null,
  logOpen: false,
  detail: null,
  setZoom: (zoom) => set({ zoom }),
  setPointer: (pointer) => set({ pointer }),
  setArrowFrom: (arrowFrom) => set({ arrowFrom }),
  setDragging: (dragging) => set({ dragging }),
  openViewer: (viewer) => set({ viewer }),
  toggleLog: (open) => set((state) => ({ logOpen: open ?? !state.logOpen })),
  // the zoomed copy would sit on top of the detail view
  openDetail: (detail) => set({ detail, zoom: null }),
}));
