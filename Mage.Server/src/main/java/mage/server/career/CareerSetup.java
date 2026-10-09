package mage.server.career;

import mage.abilities.Ability;
import mage.abilities.common.SimpleStaticAbility;
import mage.abilities.common.delayed.AtTheBeginOfNextEndStepDelayedTriggeredAbility;
import mage.abilities.common.delayed.AtTheBeginOfYourNextUpkeepDelayedTriggeredAbility;
import mage.abilities.effects.common.InfoEffect;
import mage.abilities.effects.common.LoseGameTargetPlayerEffect;
import mage.abilities.effects.common.WinGameSourceControllerEffect;
import mage.cards.Card;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.constants.TargetController;
import mage.constants.Zone;
import mage.game.Game;
import mage.game.GameSetup;
import mage.game.PutToBattlefieldInfo;
import mage.game.command.emblems.EmblemOfCard;
import mage.players.Player;
import mage.target.targetpointer.FixedTarget;
import org.apache.log4j.Logger;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * How a Career game starts when it isn't a plain duel: an opponent with a twist (more life, extra cards, a permanent
 * or an emblem in play), or a puzzle that starts from a fixed position and must be won this turn.
 */
public final class CareerSetup implements GameSetup {

    private static final long serialVersionUID = 1L;
    private static final Logger logger = Logger.getLogger(CareerSetup.class);

    /** A boss's edge over a normal opponent. Every field is optional. */
    public static class CareerTwists implements Serializable {
        private static final long serialVersionUID = 1L;
        /** life the opponent starts with */
        public Integer startingLife;
        /** cards the opponent draws on top of the opening hand */
        public int extraCards;
        /** cards the opponent starts with in play; "Name" or "Name|tapped" */
        public List<String> permanents;
        /** a card whose abilities the opponent has as an emblem */
        public String emblem;
    }

    /** One player's side of a puzzle. Card lists hold names; battlefield entries may end in "|tapped". */
    public static class CareerPuzzleSide implements Serializable {
        private static final long serialVersionUID = 1L;
        public Integer life;
        public List<String> hand;
        public List<String> battlefield;
        public List<String> graveyard;
        /** the library, top card first */
        public List<String> library;
    }

    /**
     * A fixed position: the player must win from it this turn, or (a campaign trial's "survive") live through the
     * opponent's turn.
     */
    public static class Puzzle implements Serializable {
        private static final long serialVersionUID = 1L;
        public String id;
        public String name;
        public String text;
        /** a nudge for a player who's stuck */
        public String hint;
        public CareerPuzzleSide you;
        public CareerPuzzleSide opponent;
        /** "win" (the default) or "survive" */
        public String objective;

        boolean survive() {
            return "survive".equals(objective);
        }
    }

    private final CareerTwists twists;
    private final Puzzle puzzle;
    /** a table of more than two: the game ends when the player is out */
    private final boolean pod;

    private CareerSetup(CareerTwists twists, Puzzle puzzle, boolean pod) {
        this.twists = twists;
        this.puzzle = puzzle;
        this.pod = pod;
    }

    private CareerSetup(CareerTwists twists, Puzzle puzzle) {
        this(twists, puzzle, false);
    }

    /** a pod's setup: the given one (or none) that also ends the game once the player is out */
    public static CareerSetup pod(CareerSetup setup) {
        return setup == null ? new CareerSetup(null, null, true) : new CareerSetup(setup.twists, setup.puzzle, true);
    }

    @Override
    public boolean endsWhenHumansAreOut() {
        return pod;
    }

    /** null when the twists change nothing */
    public static CareerSetup ofTwists(CareerTwists twists) {
        if (twists == null || (twists.startingLife == null && twists.extraCards <= 0
                && (twists.permanents == null || twists.permanents.isEmpty()) && twists.emblem == null)) {
            return null;
        }
        return new CareerSetup(twists, null);
    }

    public static CareerSetup ofPuzzle(Puzzle puzzle) {
        return new CareerSetup(null, puzzle);
    }

    @Override
    public boolean replacesOpeningHands() {
        return puzzle != null;
    }

    @Override
    public UUID startingPlayer(Game game) {
        if (puzzle == null) {
            return null;
        }
        UUID humanId = human(game);
        if (puzzle.survive()) {
            // the opponent takes the turn the player has to live through
            for (Player player : game.getPlayers().values()) {
                if (!player.getId().equals(humanId)) {
                    return player.getId();
                }
            }
        }
        return humanId;
    }

    private static UUID human(Game game) {
        for (Player player : game.getPlayers().values()) {
            if (player.isHuman()) {
                return player.getId();
            }
        }
        return null;
    }

    @Override
    public void apply(Game game, UUID startingPlayerId) {
        UUID humanId = human(game);
        for (Player player : game.getPlayers().values()) {
            if (player.getId().equals(humanId)) {
                if (puzzle != null) {
                    side(game, player, puzzle.you);
                }
            } else if (puzzle != null) {
                side(game, player, puzzle.opponent);
            } else if (twists != null) {
                twist(game, player);
            }
        }
        if (puzzle != null && humanId != null && puzzle.survive()) {
            // alive when your turn comes round: you win
            Ability source = fakeSource(humanId);
            game.addDelayedTriggeredAbility(new AtTheBeginOfYourNextUpkeepDelayedTriggeredAbility(new WinGameSourceControllerEffect()), source);
            game.informPlayers("Trial: " + (puzzle.name == null ? "" : puzzle.name + ". ")
                    + (puzzle.text == null ? "Survive their turn." : puzzle.text));
        } else if (puzzle != null && humanId != null) {
            // win this turn, or lose at its end
            Ability source = fakeSource(humanId);
            game.addDelayedTriggeredAbility(new AtTheBeginOfNextEndStepDelayedTriggeredAbility(
                    new LoseGameTargetPlayerEffect().setTargetPointer(new FixedTarget(humanId)), TargetController.ANY), source);
            game.informPlayers("Puzzle: " + (puzzle.name == null ? "" : puzzle.name + ". ")
                    + (puzzle.text == null ? "Win this turn." : puzzle.text));
        }
        game.applyEffects();
    }

    private static Ability fakeSource(UUID controllerId) {
        Ability source = new SimpleStaticAbility(Zone.OUTSIDE, new InfoEffect("Career"));
        source.setControllerId(controllerId);
        return source;
    }

    private void twist(Game game, Player player) {
        if (twists.startingLife != null) {
            player.setLife(twists.startingLife, game, null);
        }
        if (twists.extraCards > 0) {
            player.drawCards(twists.extraCards, null, game);
        }
        if (twists.permanents != null && !twists.permanents.isEmpty()) {
            List<PutToBattlefieldInfo> battlefield = new ArrayList<>();
            for (String entry : twists.permanents) {
                Card card = create(entry);
                if (card != null) {
                    battlefield.add(new PutToBattlefieldInfo(card, entry.endsWith("|tapped")));
                }
            }
            game.cheat(player.getId(), Collections.emptyList(), Collections.emptyList(), battlefield,
                    Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
        }
        if (twists.emblem != null) {
            Card card = create(twists.emblem);
            if (card != null) {
                EmblemOfCard emblem = new EmblemOfCard(card);
                game.addEmblem(emblem, card, player.getId());
                for (Ability ability : emblem.getAbilities()) {
                    game.getState().addAbility(ability, null, emblem);
                }
            }
        }
        game.informPlayers(player.getLogName() + " starts with an edge" + describe(twists) + ".");
    }

    private static String describe(CareerTwists twists) {
        List<String> parts = new ArrayList<>();
        if (twists.startingLife != null) {
            parts.add(twists.startingLife + " life");
        }
        if (twists.extraCards > 0) {
            parts.add(twists.extraCards + (twists.extraCards == 1 ? " extra card" : " extra cards"));
        }
        if (twists.permanents != null) {
            for (String permanent : twists.permanents) {
                parts.add(name(permanent));
            }
        }
        if (twists.emblem != null) {
            parts.add("an emblem of " + twists.emblem);
        }
        return parts.isEmpty() ? "" : ": " + String.join(", ", parts);
    }

    private static void side(Game game, Player player, CareerPuzzleSide side) {
        if (side == null) {
            return;
        }
        player.getHand().clear();
        player.getLibrary().clear();
        if (side.life != null) {
            player.setLife(side.life, game, null);
        }
        List<Card> library = cards(side.library);
        // cheat puts each library card on top, so the last one put ends up first
        Collections.reverse(library);
        List<PutToBattlefieldInfo> battlefield = new ArrayList<>();
        if (side.battlefield != null) {
            for (String entry : side.battlefield) {
                Card card = create(entry);
                if (card != null) {
                    battlefield.add(new PutToBattlefieldInfo(card, entry.endsWith("|tapped")));
                }
            }
        }
        game.cheat(player.getId(), library, cards(side.hand), battlefield, cards(side.graveyard),
                Collections.emptyList(), Collections.emptyList());
    }

    private static List<Card> cards(List<String> names) {
        List<Card> cards = new ArrayList<>();
        if (names != null) {
            for (String name : names) {
                Card card = create(name);
                if (card != null) {
                    cards.add(card);
                }
            }
        }
        return cards;
    }

    static String name(String entry) {
        int bar = entry.indexOf('|');
        return (bar < 0 ? entry : entry.substring(0, bar)).trim();
    }

    private static Card create(String entry) {
        CardInfo info = CardRepository.instance.findPreferredCoreExpansionCard(name(entry));
        if (info == null) {
            logger.warn("Career setup: no card " + name(entry));
            return null;
        }
        return info.createCard();
    }

    public CareerTwists twists() {
        return twists;
    }

    public Puzzle puzzle() {
        return puzzle;
    }
}
