# XMage Web Client

A modern, Magic Arena-inspired web client for XMage. This client provides a beautiful, responsive interface for playing Magic: The Gathering online.

## Features (Phase 1 - Foundation)

- ✅ Modern, glassmorphism-inspired UI design
- ✅ WebSocket service with auto-reconnection
- ✅ User authentication (login/register)
- ✅ Zustand-based state management
- ✅ Type-safe API integration

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Vite + React 18 |
| **Language** | TypeScript |
| **State Management** | Zustand with Immer |
| **Styling** | Vanilla CSS with Design Tokens |
| **WebSocket** | Native WebSocket |
| **Validation** | Zod (for API responses) |

## Getting Started

### Prerequisites

- Node.js 18+
- XMage Server running with WebSocket support (port 17172)

### Installation

```bash
cd Mage.Web.Client
npm install
```

### Development

```bash
npm run dev
```

The development server starts at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── common/           # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   └── ManaSymbols.tsx
│   ├── login/            # Login/register page
│   ├── lobby/            # Game lobby (tables, create game)
│   ├── chat/             # Chat panel
│   └── game/             # Game interface (coming soon)
├── services/
│   ├── WebSocketService.ts   # WebSocket connection management
│   └── CardImageService.ts   # Card image loading via Scryfall
├── stores/
│   ├── sessionStore.ts       # User session & authentication
│   ├── lobbyStore.ts         # Lobby tables & room state
│   ├── gameStore.ts          # Game state management
│   └── chatStore.ts          # Chat messages & channels
├── types/
│   ├── api.ts                # WebSocket API types
│   ├── game.ts               # Game state types
│   └── models.ts             # Lobby & deck types
└── index.css                 # Design system & global styles
```

## Implementation Roadmap

Based on `docs/WebClientImplementationPlan.md`:

### Phase 1: Foundation ✅
- [x] Project setup (Vite + React + TypeScript)
- [x] WebSocket service with reconnection
- [x] Session store with authentication
- [x] Login page UI
- [x] Basic lobby page structure

### Phase 2: Lobby & Chat 🔄
- [x] Table list component
- [x] Create table dialog
- [x] Chat panel
- [ ] Join table with deck selection
- [ ] Table filtering

### Phase 3: Game Core - Read Only
- [ ] Game page layout
- [ ] Battlefield rendering
- [ ] Hand component
- [ ] Stack component
- [ ] Player panel (life, mana)
- [ ] Phase indicator

### Phase 4: Basic Game Actions
- [ ] Priority passing (F-keys)
- [ ] Yes/No dialogs
- [ ] Target selection
- [ ] Card selection

### Phase 5: Advanced Interactions
- [ ] Mana payment dialog
- [ ] Ability picker
- [ ] Combat assignment
- [ ] Pile selection

### Phase 6: Polish
- [ ] Deck editor
- [ ] Animations
- [ ] Sound effects
- [ ] Mobile responsiveness

## Design Philosophy

The web client aims to provide a **Magic Arena-like experience**:

- **Rich Aesthetics**: Dark theme with glassmorphism, gradients, and subtle animations
- **Premium Feel**: Smooth transitions, hover effects, and polished micro-interactions
- **Responsive**: Works on desktop and tablets (mobile support planned)
- **Intuitive**: Clear visual feedback for all game states

## Connecting to XMage Server

The client connects to the XMage WebSocket server. Make sure:

1. XMage Server is running with WebSocket support enabled
2. Server is accessible at the configured URL (default: `ws://localhost:17172`)
3. CORS is properly configured if running on different domains

## Related Documentation

- [`docs/WebSocketAPI.md`](../docs/WebSocketAPI.md) - Full API specification
- [`docs/WebClientDataModels.md`](../docs/WebClientDataModels.md) - TypeScript type definitions
- [`docs/WebClientImplementationPlan.md`](../docs/WebClientImplementationPlan.md) - Detailed implementation plan

## License

Part of the XMage project. See root LICENSE file.
