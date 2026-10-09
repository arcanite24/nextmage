package mage.server.career;

/**
 * A player's Career at a glance.
 */
public class CareerProfile {

    public static class Wildcards {
        public int common;
        public int uncommon;
        public int rare;
        public int mythic;

        public Wildcards(int common, int uncommon, int rare, int mythic) {
            this.common = common;
            this.uncommon = uncommon;
            this.rare = rare;
            this.mythic = mythic;
        }
    }

    public long created;
    /** the starter deck the Career began with */
    public String starter;
    public int coins;
    public int xp;
    public int level;
    public int wins;
    public int losses;
    public Wildcards wildcards;
    /** cards in the collection, every copy counted */
    public int cards;
}
