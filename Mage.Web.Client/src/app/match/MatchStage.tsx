import type { GameSession, GameSessionState } from '../../core/game/gameSession';
import { Button } from '../ui/Button';

/** Temporary match view; replaced by the scaled match stage. */
export function MatchStage({ session, state }: { session: GameSession; state: GameSessionState }) {
  const { interaction, view } = state;
  return (
    <div style={{ position: 'fixed', inset: 0, padding: 32, display: 'grid', gap: 16, alignContent: 'start' }}>
      <h1>Turn {view?.turn ?? 0} · {view?.step}</h1>
      <p>{interaction.headline}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[...interaction.clickable.keys()].map((id) => (
          <Button key={id} size="sm" onClick={() => session.click(id)}>
            {view?.myHand?.[id]?.name ?? id.slice(0, 6)}
          </Button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {interaction.secondaryButtons.map((button) => (
          <Button key={button.label} onClick={() => void session.respond(button.command)}>{button.label}</Button>
        ))}
        {interaction.mainButton && (
          <Button variant="decision" onClick={() => void session.respond(interaction.mainButton!.command)}>{interaction.mainButton.label}</Button>
        )}
      </div>
      {state.gameOver && <h2>{state.gameOver}</h2>}
    </div>
  );
}
