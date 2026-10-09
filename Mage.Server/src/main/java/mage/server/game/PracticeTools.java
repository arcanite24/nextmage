package mage.server.game;

import mage.abilities.Ability;
import mage.abilities.common.SimpleStaticAbility;
import mage.abilities.effects.common.InfoEffect;
import mage.cards.Card;
import mage.cards.decks.importer.CardLookup;
import mage.cards.repository.CardInfo;
import mage.constants.Zone;
import mage.game.Game;
import mage.game.permanent.Permanent;
import mage.players.Player;
import mage.util.CardUtil;

import java.util.Collections;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Practice tools for a game against the AI only: put a card into your hand or onto the battlefield, draw, untap
 * everything, set your life. Each tool runs on the game thread the next time the player is asked something, and is
 * announced in the game log so a practice game never passes for a real one.
 */
public final class PracticeTools {

    public enum Tool {
        HAND, BATTLEFIELD, DRAW, UNTAP_ALL, LIFE
    }

    /** cards one use of a tool may add */
    static final int MAX_CARDS = 10;

    private PracticeTools() {
    }

    public static Tool parse(String name) {
        try {
            return Tool.valueOf(name.trim().toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException | NullPointerException e) {
            return null;
        }
    }

    /**
     * The action for a tool, or null with {@code problem} explaining why not (unknown card, bad amount).
     *
     * @param amount cards to add or draw, or the new life total
     */
    public static Consumer<Game> action(Tool tool, UUID playerId, String cardName, int amount, StringBuilder problem) {
        switch (tool) {
            case HAND:
            case BATTLEFIELD: {
                if (amount < 1 || amount > MAX_CARDS) {
                    problem.append("Add 1 to ").append(MAX_CARDS).append(" cards at a time.");
                    return null;
                }
                CardInfo info = cardName == null ? null : CardLookup.instance.lookupCardInfo(cardName.trim());
                if (info == null) {
                    problem.append("No card is named ").append(cardName).append('.');
                    return null;
                }
                Zone zone = tool == Tool.HAND ? Zone.HAND : Zone.BATTLEFIELD;
                return game -> addCards(game, playerId, info, amount, zone);
            }
            case DRAW:
                if (amount < 1 || amount > MAX_CARDS) {
                    problem.append("Draw 1 to ").append(MAX_CARDS).append(" cards at a time.");
                    return null;
                }
                return game -> {
                    Player player = game.getPlayer(playerId);
                    if (player != null) {
                        announce(game, player, "draws " + amount + (amount == 1 ? " card" : " cards"));
                        player.drawCards(amount, null, game);
                    }
                };
            case UNTAP_ALL:
                return game -> {
                    Player player = game.getPlayer(playerId);
                    if (player != null) {
                        announce(game, player, "untaps everything they control");
                        for (Permanent permanent : game.getBattlefield().getAllActivePermanents(playerId)) {
                            permanent.untap(game);
                        }
                    }
                };
            case LIFE:
                if (amount < 1 || amount > 999) {
                    problem.append("Life must be 1 to 999.");
                    return null;
                }
                return game -> {
                    Player player = game.getPlayer(playerId);
                    if (player != null) {
                        announce(game, player, "sets their life to " + amount);
                        player.setLife(amount, game, null);
                    }
                };
            default:
                problem.append("Unknown tool.");
                return null;
        }
    }

    private static void addCards(Game game, UUID playerId, CardInfo info, int amount, Zone zone) {
        Player player = game.getPlayer(playerId);
        if (player == null) {
            return;
        }
        announce(game, player, "puts " + amount + " " + info.getName() + (zone == Zone.HAND ? " into their hand" : " onto the battlefield"));
        Ability source = new SimpleStaticAbility(Zone.OUTSIDE, new InfoEffect("practice tools"));
        source.setControllerId(playerId);
        for (int i = 0; i < amount; i++) {
            Card card = info.createCard();
            if (card == null) {
                return;
            }
            game.loadCards(Collections.singleton(card), playerId);
            if (zone == Zone.BATTLEFIELD) {
                CardUtil.putCardOntoBattlefieldWithEffects(source, game, card, player, false);
            } else {
                card.moveToZone(Zone.HAND, source, game, false);
            }
        }
        game.applyEffects();
    }

    private static void announce(Game game, Player player, String what) {
        game.informPlayers("Practice: " + player.getLogName() + " " + what + ".");
    }
}
