package mage.server.game;

import mage.MageObject;
import mage.constants.WatcherScope;
import mage.constants.Zone;
import mage.game.Game;
import mage.game.events.DamagedEvent;
import mage.game.events.GameEvent;
import mage.game.events.ZoneChangeEvent;
import mage.game.permanent.Permanent;
import mage.game.stack.Spell;
import mage.players.Player;
import mage.view.GameEventView;
import mage.view.GameEventView.GameEventKind;
import mage.watchers.Watcher;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

/**
 * Turns the game's own events into {@link GameEventView}s for the game's {@link GameEventFeed}. A watcher, because
 * watchers see every event. The AI's simulations run on copies of the game and are skipped.
 */
public class GameEventRecorder extends Watcher {

    private static final Set<Zone> PUBLIC_ZONES = EnumSet.of(Zone.BATTLEFIELD, Zone.GRAVEYARD, Zone.STACK, Zone.EXILED, Zone.COMMAND);

    private final UUID gameId;

    public GameEventRecorder(UUID gameId) {
        super(WatcherScope.GAME);
        this.gameId = gameId;
    }

    @Override
    public void watch(GameEvent event, Game game) {
        if (game.isSimulation()) {
            return;
        }
        GameEventFeed feed = GameEventFeed.of(gameId);
        if (feed == null) {
            return;
        }
        switch (event.getType()) {
            case DAMAGED_PLAYER:
            case DAMAGED_PERMANENT:
                feed.add(view(feed, GameEventKind.DAMAGE, game, event)
                        .source(event.getSourceId(), nameOf(game, event.getSourceId()))
                        .combat(event instanceof DamagedEvent && ((DamagedEvent) event).isCombatDamage()), null);
                break;
            case GAINED_LIFE:
                feed.add(view(feed, GameEventKind.LIFE_GAIN, game, event).player(event.getTargetId()), null);
                break;
            case LOST_LIFE:
                feed.add(view(feed, GameEventKind.LIFE_LOSS, game, event).player(event.getTargetId()), null);
                break;
            case COUNTERS_ADDED:
                feed.add(view(feed, GameEventKind.COUNTERS_ADDED, game, event).counter(event.getData()), null);
                break;
            case COUNTERS_REMOVED:
                feed.add(view(feed, GameEventKind.COUNTERS_REMOVED, game, event).counter(event.getData()), null);
                break;
            case TAPPED:
                feed.add(view(feed, GameEventKind.TAP, game, event), null);
                break;
            case UNTAPPED:
                feed.add(view(feed, GameEventKind.UNTAP, game, event), null);
                break;
            case SPELL_CAST: {
                Spell spell = game.getSpell(event.getTargetId());
                boolean faceDown = spell != null && spell.isFaceDown(game);
                feed.add(view(feed, GameEventKind.CAST, game, event).player(event.getPlayerId()), faceDown ? event.getPlayerId() : null);
                break;
            }
            case ATTACKER_DECLARED:
            case BLOCKER_DECLARED:
                feed.add(view(feed, event.getType() == GameEvent.EventType.ATTACKER_DECLARED ? GameEventKind.ATTACK : GameEventKind.BLOCK, game, event)
                        .source(event.getSourceId(), nameOf(game, event.getSourceId())), null);
                break;
            case DREW_CARD:
                feed.add(view(feed, GameEventKind.DRAW, game, event).player(event.getPlayerId()).zones(Zone.LIBRARY.name(), Zone.HAND.name()), event.getPlayerId());
                break;
            case CREATED_TOKEN:
                feed.add(view(feed, GameEventKind.TOKEN, game, event).player(event.getPlayerId()), null);
                break;
            case ZONE_CHANGE:
                zoneChange(feed, (ZoneChangeEvent) event, game);
                break;
            default:
                break;
        }
    }

    private void zoneChange(GameEventFeed feed, ZoneChangeEvent event, Game game) {
        Zone from = event.getFromZone();
        Zone to = event.getToZone();
        UUID owner = game.getOwnerId(event.getTargetId());
        Permanent permanent = event.getTarget();
        boolean faceDown = permanent != null && permanent.isFaceDown(game);
        // a card only the owner saw on both sides of the move (library to hand, hand to library) stays theirs
        boolean seen = !faceDown && (PUBLIC_ZONES.contains(from) || PUBLIC_ZONES.contains(to));
        GameEventView view = view(feed, GameEventKind.ZONE, game, event)
                .player(owner)
                .zones(from == null ? null : from.name(), to == null ? null : to.name());
        feed.add(view, seen ? null : (owner == null ? event.getPlayerId() : owner));
    }

    private static GameEventView view(GameEventFeed feed, GameEventKind kind, Game game, GameEvent event) {
        return new GameEventView(feed.nextSeq(), kind)
                .target(event.getTargetId(), nameOf(game, event.getTargetId()))
                .amount(event.getAmount());
    }

    private static String nameOf(Game game, UUID id) {
        if (id == null) {
            return null;
        }
        Player player = game.getPlayer(id);
        if (player != null) {
            return player.getName();
        }
        MageObject object = game.getObject(id);
        if (object == null || (object instanceof Permanent && ((Permanent) object).isFaceDown(game))) {
            return null;
        }
        return object.getName();
    }
}
