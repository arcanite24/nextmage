import { useQuery } from '@tanstack/react-query';
import type { CareerPackResult, CareerProfile, CareerState } from '../../protocol/generated/views';
import type { DeckCardLists } from '../../core/decks/types';
import { api } from '../connection';
import { toWire } from '../decks/deckModel';
import { queryClient } from '../queries';
import { useEvents } from '../stores/events';
import { usePlay } from '../stores/play';
import { useSession } from '../stores/session';
import { warmCards } from '../ui/imageCache';
import { saveCareerDeck, fetchStarterDeck } from './careerDeck';

/** Career data from the server, cached per screen visit; every change goes through the server and back. */
const KEY = {
  state: ['career', 'state'],
  opponents: ['career', 'opponents'],
  collection: ['career', 'collection'],
  shop: ['career', 'shop'],
  starters: ['career', 'starters'],
} as const;

function useSignedIn(): boolean {
  return useSession((state) => state.phase === 'signedIn');
}

export function useCareerState() {
  const signedIn = useSignedIn();
  return useQuery({ queryKey: KEY.state, queryFn: () => api.careerState(), enabled: signedIn, staleTime: 0 });
}

export function useCareerOpponents(enabled: boolean) {
  return useQuery({ queryKey: KEY.opponents, queryFn: () => api.careerOpponents(), enabled: useSignedIn() && enabled, staleTime: 0 });
}

export function useCareerCollection(enabled: boolean) {
  return useQuery({ queryKey: KEY.collection, queryFn: () => api.careerCollection(), enabled: useSignedIn() && enabled, staleTime: 30_000 });
}

export function useCareerShop(enabled: boolean) {
  return useQuery({ queryKey: KEY.shop, queryFn: () => api.careerShop(), enabled: useSignedIn() && enabled, staleTime: Infinity });
}

export function useCareerStarters(enabled: boolean) {
  return useQuery({ queryKey: KEY.starters, queryFn: () => api.careerStarters(), enabled: useSignedIn() && enabled, staleTime: Infinity });
}

/** A changed profile shows everywhere at once. */
function setProfile(profile: CareerProfile | undefined) {
  if (!profile) return;
  queryClient.setQueryData<CareerState>(KEY.state, (state) => ({ ...(state ?? { enabled: true }), profile }));
}

/** Open a Career with a starter; its deck becomes the Career deck on this browser. */
export async function startCareer(starterId: string, starterName: string): Promise<void> {
  const profile = await api.careerStart(starterId);
  const user = useSession.getState().userName;
  const deck = await fetchStarterDeck(starterId, starterName).catch(() => null);
  if (deck) saveCareerDeck(user, deck);
  setProfile(profile);
  void queryClient.invalidateQueries({ queryKey: ['career'] });
}

export async function buyPack(setCode: string): Promise<CareerPackResult> {
  const result = await api.careerBuyPack(setCode);
  // the pictures start downloading while the pack is still face down
  warmCards((result.cards ?? []).map((card) => ({ name: card.name ?? '', setCode: card.setCode, cardNumber: card.cardNumber })));
  setProfile(result.profile);
  void queryClient.invalidateQueries({ queryKey: KEY.collection });
  return result;
}

export async function craftCard(setCode: string, cardNumber: string): Promise<void> {
  setProfile(await api.careerCraft(setCode, cardNumber));
  await queryClient.invalidateQueries({ queryKey: KEY.collection });
}

export async function exportCareer(): Promise<string> {
  return api.careerExport();
}

export async function importCareer(data: string): Promise<void> {
  setProfile(await api.careerImport(data.trim()));
  void queryClient.invalidateQueries({ queryKey: ['career'] });
}

/**
 * Start a Career match: the server sets the table up and starts it; the game opens like any other (the signed-in shell
 * follows the server into it), and leaving it comes back to Career.
 */
export async function playCareer(opponentId: string, deck: DeckCardLists): Promise<void> {
  useEvents.setState({ currentTournamentId: null });
  usePlay.setState({ phase: 'waitingForGame', error: null, deckId: null, returnPath: '/career' });
  warmCards([...deck.cards, ...deck.sideboard].map((card) => ({ name: card.cardName, setCode: card.setCode ?? undefined, cardNumber: card.cardNumber ?? undefined })));
  try {
    const match = await api.careerPlay(opponentId, toWire(deck));
    usePlay.setState({ tableId: match.tableId ?? null });
  } catch (error) {
    usePlay.setState({ phase: 'idle', tableId: null });
    throw error;
  }
}

/** After a Career match the payout and the open tiers have changed. */
export function refreshCareer(): void {
  void queryClient.invalidateQueries({ queryKey: ['career'] });
}
