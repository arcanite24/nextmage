
package mage.player.ai;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import mage.abilities.Ability;
import mage.game.Game;
import mage.game.combat.Combat;

/**
 *
 * @author BetaSteward_at_googlemail.com
 */
public class SimulationNode2 implements Serializable {

    /**
     * Nodes made so far by the search this node belongs to, shared along the tree. It was a static count once, so
     * games searching at the same time spent each other's node budget.
     */
    protected final int[] searchNodes;

    protected Game game;
    protected int gameValue; // game state hash to monitor changes
    protected int score;
    protected List<Ability> abilities;
    protected int depth;
    protected List<SimulationNode2> children = new ArrayList<>();
    protected SimulationNode2 parent;
    protected List<UUID> targets = new ArrayList<>(); // TODO: looks like it un-used by bugs (research and implement possible targets simulation for choices?)
    protected List<String> choices = new ArrayList<>(); // TODO: un-used at all, maybe same history as targets above
    protected UUID playerId;
    protected Combat combat;

    public SimulationNode2(SimulationNode2 parent, Game game, int depth, UUID playerId) {
        this.parent = parent;
        this.game = game;
        this.depth = depth;
        this.playerId = playerId;
        game.setCustomData(this);
        this.searchNodes = parent == null ? new int[1] : parent.searchNodes;
        this.searchNodes[0]++;
    }

    public SimulationNode2(SimulationNode2 parent, Game game, List<Ability> abilities, int depth, UUID playerId) {
        this(parent, game, depth, playerId);
        this.abilities = abilities;
    }

    public SimulationNode2(SimulationNode2 parent, Game game, Ability ability, int depth, UUID playerId) {
        this(parent, game, depth, playerId);
        this.abilities = new ArrayList<>();
        abilities.add(ability);
    }

    /**
     * Nodes made so far by this node's search.
     */
    public int getSearchNodes() {
        return searchNodes[0];
    }

    public Game getGame() {
        return this.game;
    }

    public int getGameValue() {
        return this.gameValue;
    }

    public void setGameValue(int value) {
        this.gameValue = value;
    }

    public List<Ability> getAbilities() {
        return this.abilities;
    }

    public SimulationNode2 getParent() {
        return this.parent;
    }

    public List<SimulationNode2> getChildren() {
        return this.children;
    }

    public int getDepth() {
        return this.depth;
    }

    public UUID getPlayerId() {
        return this.playerId;
    }

    public Combat getCombat() {
        return this.combat;
    }

    public void setCombat(Combat combat) {
        this.combat = combat;
    }

    public List<UUID> getTargets() {
        return this.targets;
    }

    public List<String> getChoices() {
        return this.choices;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
    }
}
