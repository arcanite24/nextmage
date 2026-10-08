/** A deck as the client keeps and edits it (the wire form is DeckCardLists in protocol/generated/views). */

export interface DeckCardInfo {
  cardName: string;
  setCode?: string | null;
  cardNumber?: string | null;
  amount: number;
}

export interface DeckCardLayout {
  // Layout information for deck editor
  [key: string]: unknown;
}

export interface DeckCoverCard {
  setCode: string;
  cardNumber: string;
  name?: string;
}

export interface DeckCardLists {
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  format?: string; // e.g. "Constructed - Standard", syncs with deckType
  cards: DeckCardInfo[];
  sideboard: DeckCardInfo[];
  cardLayout?: DeckCardLayout;
  sideboardLayout?: DeckCardLayout;
  coverCard?: DeckCoverCard;
  colors?: {
    white: boolean;
    blue: boolean;
    black: boolean;
    red: boolean;
    green: boolean;
  };
  createdAt?: number;
  updatedAt?: number;
}
