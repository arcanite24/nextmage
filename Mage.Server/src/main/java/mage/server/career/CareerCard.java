package mage.server.career;

/**
 * One printing in a collection, or one card a pack or a payout gave.
 */
public class CareerCard {

    public String name;
    public String setCode;
    public String cardNumber;
    /** common, uncommon, rare, mythic, or land for basic lands */
    public String rarity;
    public int count = 1;
    /** set when the copy went past the playset: what it became instead ("coins" or "wildcard") */
    public String convertedTo;

    public CareerCard(String name, String setCode, String cardNumber, String rarity) {
        this.name = name;
        this.setCode = setCode;
        this.cardNumber = cardNumber;
        this.rarity = rarity;
    }
}
