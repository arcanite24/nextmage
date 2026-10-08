package mage.server.websocket.service.deckimport;

import org.junit.Assert;
import org.junit.Assume;
import org.junit.Test;

/**
 * Live canary: imports one known public deck from every site the server reads, over the network, so a site
 * that changes its pages or API shows up here before players hit it. Not part of the normal build (it needs
 * the network and real sites); run it weekly:
 * <pre>mvn -pl Mage.Server test -Dtest=DeckImportLiveCanaryTest -Dxmage.deckImportCanary=true</pre>
 */
public class DeckImportLiveCanaryTest {

    private static final String[][] DECKS = {
            {"https://archidekt.com/decks/3872725/murktide", "archidekt"},
            {"https://infinite.tcgplayer.com/magic-the-gathering/deck/Rakdos-Grief/496500", "tcgplayer"},
            {"https://mtgtop8.com/event?e=91675&d=896184&f=MO", "mtgtop8"},
            {"https://scryfall.com/@gorila/decks/e7aceb4c-29d5-49f5-9a49-c24f64da264b", "scryfall"},
            {"https://manabox.app/decks/AZ6V4n88fhahOvNRFHbXTQ", "manabox"},
    };

    @Test
    public void everySiteStillReads() {
        Assume.assumeTrue("live canary: run with -Dxmage.deckImportCanary=true", Boolean.getBoolean("xmage.deckImportCanary"));
        DeckImportService service = new DeckImportService();
        StringBuilder broken = new StringBuilder();
        for (String[] deck : DECKS) {
            try {
                ImportedDeck imported = service.importFromUrl(deck[0], "canary");
                if (!deck[1].equals(imported.getSite()) || imported.cardCount() < 40 || imported.getName() == null) {
                    broken.append(deck[1]).append(": read ").append(imported.cardCount()).append(" cards, name ").append(imported.getName()).append('\n');
                }
            } catch (DeckImportException e) {
                broken.append(deck[1]).append(": ").append(e.getReason().wireName()).append(" (").append(e.getMessage()).append(")\n");
            }
        }
        Assert.assertEquals("deck sites that no longer import:\n" + broken, "", broken.toString());
    }
}
