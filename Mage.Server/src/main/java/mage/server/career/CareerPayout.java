package mage.server.career;

/**
 * What one Career match paid.
 */
public class CareerPayout {

    public String matchKey;
    public long at;
    /** opponent id from the roster */
    public String opponent;
    public boolean won;
    public int coins;
    public int xp;
    /** why it paid less than usual, if it did */
    public String note;
}
