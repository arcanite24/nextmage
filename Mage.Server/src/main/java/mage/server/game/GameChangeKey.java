package mage.server.game;

import mage.game.Game;
import mage.game.GameState;
import mage.game.permanent.Permanent;
import mage.players.Player;

/**
 * A cheap summary of what players see of a game, to tell whether anything changed since the last time a costly view
 * (a replay snapshot, the playable highlights) was built. Every change to the game goes through applyEffects, which
 * counts; the rest covers what moves without it: mana in pools, priority, taps and zone sizes.
 */
public final class GameChangeKey {

    private GameChangeKey() {
    }

    public static String of(Game game) {
        GameState state = game.getState();
        StringBuilder key = new StringBuilder(128)
                .append(state.getApplyEffectsCounter()).append('|').append(state.getTurnNum())
                .append('|').append(state.getTurn() == null || state.getTurn().getStep() == null ? null : state.getTurn().getStep().getType())
                .append('|').append(state.getPriorityPlayerId())
                .append('|').append(state.getActivePlayerId())
                .append('|').append(state.getStack().size())
                .append('|').append(state.getCombat() == null ? 0 : state.getCombat().getAttackers().size());
        int tapped = 0;
        int permanents = 0;
        for (Permanent permanent : state.getBattlefield().getAllPermanents()) {
            permanents++;
            tapped += permanent.isTapped() ? 1 : 0;
        }
        key.append('|').append(permanents).append('/').append(tapped);
        for (Player player : state.getPlayers().values()) {
            key.append('|').append(player.getLife()).append(',').append(player.getHand().size())
                    .append(',').append(player.getLibrary().size()).append(',').append(player.getGraveyard().size())
                    .append(',').append(player.getManaPool().count()).append(',').append(player.hasLeft() ? 1 : 0)
                    .append(',').append(player.getTurnControlledBy());
        }
        return key.toString();
    }
}
