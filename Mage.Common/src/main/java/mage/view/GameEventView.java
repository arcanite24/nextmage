package mage.view;

import java.io.Serializable;
import java.util.UUID;

/**
 * One thing that happened in a game since the last view: damage dealt, life gained or lost, a card moving between
 * zones, counters, tapping, a spell cast, an attack or block, a draw or a token. Clients animate and log from these
 * instead of diffing two snapshots. Only the web client reads them; ids of cards in hidden zones are left out.
 */
public class GameEventView implements Serializable {

    private static final long serialVersionUID = 1L;

    public enum GameEventKind {
        DAMAGE, LIFE_GAIN, LIFE_LOSS, ZONE, COUNTERS_ADDED, COUNTERS_REMOVED, TAP, UNTAP, CAST, ATTACK, BLOCK, DRAW, TOKEN
    }

    /** increases by one per event in a game, so a client can tell a gap */
    private final long seq;
    private final GameEventKind kind;
    /** the card, permanent or player it happened to */
    private UUID targetId;
    private String targetName;
    /** what caused it: the damage source, the attacker, the blocker */
    private UUID sourceId;
    private String sourceName;
    /** the player it belongs to (owner of a moved card, the player who drew, gained or lost life) */
    private UUID playerId;
    private int amount;
    private String fromZone;
    private String toZone;
    private boolean combat;
    /** counter name for COUNTERS_ADDED / COUNTERS_REMOVED */
    private String counter;

    public GameEventView(long seq, GameEventKind kind) {
        this.seq = seq;
        this.kind = kind;
    }

    /** A copy without the card's identity, for a player who can't see it. */
    public GameEventView hidden() {
        GameEventView copy = new GameEventView(seq, kind);
        copy.playerId = playerId;
        copy.amount = amount;
        copy.fromZone = fromZone;
        copy.toZone = toZone;
        copy.combat = combat;
        copy.counter = counter;
        return copy;
    }

    public long getSeq() {
        return seq;
    }

    public GameEventKind getKind() {
        return kind;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public GameEventView target(UUID id, String name) {
        this.targetId = id;
        this.targetName = name;
        return this;
    }

    public String getTargetName() {
        return targetName;
    }

    public UUID getSourceId() {
        return sourceId;
    }

    public GameEventView source(UUID id, String name) {
        this.sourceId = id;
        this.sourceName = name;
        return this;
    }

    public String getSourceName() {
        return sourceName;
    }

    public UUID getPlayerId() {
        return playerId;
    }

    public GameEventView player(UUID id) {
        this.playerId = id;
        return this;
    }

    public int getAmount() {
        return amount;
    }

    public GameEventView amount(int amount) {
        this.amount = amount;
        return this;
    }

    public String getFromZone() {
        return fromZone;
    }

    public String getToZone() {
        return toZone;
    }

    public GameEventView zones(String from, String to) {
        this.fromZone = from;
        this.toZone = to;
        return this;
    }

    public boolean isCombat() {
        return combat;
    }

    public GameEventView combat(boolean combat) {
        this.combat = combat;
        return this;
    }

    public String getCounter() {
        return counter;
    }

    public GameEventView counter(String counter) {
        this.counter = counter;
        return this;
    }
}
