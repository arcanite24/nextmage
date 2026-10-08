package mage.server.websocket.service.deckimport;

import mage.cards.decks.DeckCardInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * Web client bridge: a deck read from a deck website, before its cards are matched against the card database.
 * Card names are the site's; set codes are upper case; collector numbers may be missing.
 */
public final class ImportedDeck {

    private final String site;
    private final String remoteId;
    private final String url;
    private String name;
    private String author;
    /** an XMage deck type ("Constructed - Modern"), or null when the site didn't say or we don't map it */
    private String format;
    private String description;
    private final List<DeckCardInfo> main = new ArrayList<>();
    private final List<DeckCardInfo> side = new ArrayList<>();
    private final List<DeckCardInfo> commanders = new ArrayList<>();
    private final List<DeckCardInfo> companion = new ArrayList<>();
    private int maybeboardCount;
    private DeckCardInfo cover;
    /** when the deck last changed on the site, in epoch milliseconds; null when the site doesn't say */
    private Long remoteUpdatedAt;

    public ImportedDeck(String site, String remoteId, String url) {
        this.site = site;
        this.remoteId = remoteId;
        this.url = url;
    }

    public enum Section {MAIN, SIDE, COMMANDER, COMPANION, MAYBE}

    public void add(Section section, String cardName, String setCode, String cardNumber, int amount) {
        if (cardName == null || cardName.trim().isEmpty() || amount <= 0) {
            return;
        }
        DeckCardInfo card = new DeckCardInfo(cardName.trim(), blankToNull(cardNumber), blankToNull(setCode) == null ? null : setCode.trim().toUpperCase(java.util.Locale.ROOT), amount);
        switch (section) {
            case MAIN:
                main.add(card);
                break;
            case SIDE:
                side.add(card);
                break;
            case COMMANDER:
                commanders.add(card);
                break;
            case COMPANION:
                companion.add(card);
                break;
            case MAYBE:
                maybeboardCount += amount;
                break;
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    public int cardCount() {
        int count = 0;
        for (List<DeckCardInfo> list : java.util.Arrays.asList(main, side, commanders, companion)) {
            for (DeckCardInfo card : list) {
                count += card.getAmount();
            }
        }
        return count;
    }

    public String getSite() {
        return site;
    }

    public String getRemoteId() {
        return remoteId;
    }

    public String getUrl() {
        return url;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = blankToNull(name);
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = blankToNull(author);
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = blankToNull(description);
    }

    public List<DeckCardInfo> getMain() {
        return main;
    }

    public List<DeckCardInfo> getSide() {
        return side;
    }

    public List<DeckCardInfo> getCommanders() {
        return commanders;
    }

    public List<DeckCardInfo> getCompanion() {
        return companion;
    }

    public int getMaybeboardCount() {
        return maybeboardCount;
    }

    public DeckCardInfo getCover() {
        return cover;
    }

    public void setCover(String cardName, String setCode, String cardNumber) {
        if (setCode == null || setCode.isEmpty() || cardNumber == null || cardNumber.isEmpty()) {
            return;
        }
        this.cover = new DeckCardInfo(cardName, cardNumber, setCode.toUpperCase(java.util.Locale.ROOT), 1);
    }

    public Long getRemoteUpdatedAt() {
        return remoteUpdatedAt;
    }

    public void setRemoteUpdatedAt(Long remoteUpdatedAt) {
        this.remoteUpdatedAt = remoteUpdatedAt;
    }
}
