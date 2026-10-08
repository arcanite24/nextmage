package mage.server.websocket.service.deckimport;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.net.URI;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Web client bridge: MTGTop8 tournament decks. The list comes from the .dec export ({@code /dec?d={id}});
 * the export has no name, player or format, so those come from the deck's event page title
 * ("5c Domain Aggro - Ryuumei @ mtgtop8.com") and its format parameter or metagame label.
 */
final class MtgTop8Source implements DeckSource {

    private static final Pattern DECK_PATH = Pattern.compile("^/(event|dec|mtgo)$");
    private static final Pattern NUMBER = Pattern.compile("^\\d+$");
    private static final Pattern CARD_LINE = Pattern.compile("^(SB:\\s*)?(\\d+)\\s+\\[([A-Za-z0-9]*)\\]\\s+(.+)$");
    private static final Pattern TITLE = Pattern.compile("^(.+?)\\s+-\\s+(.+?)\\s+@\\s+mtgtop8\\.com$");

    private static final Map<String, String> FORMATS = new HashMap<>();

    static {
        FORMATS.put("ST", "Constructed - Standard");
        FORMATS.put("PI", "Constructed - Pioneer");
        FORMATS.put("MO", "Constructed - Modern");
        FORMATS.put("LE", "Constructed - Legacy");
        FORMATS.put("VI", "Constructed - Vintage");
        FORMATS.put("PAU", "Constructed - Pauper");
        FORMATS.put("PREM", "Constructed - Premodern");
        FORMATS.put("HI", "Constructed - Historic");
        FORMATS.put("EDH", "Variant Magic - Duel Commander");
        FORMATS.put("CEDH", "Variant Magic - Commander");
        FORMATS.put("cEDH", "Variant Magic - Commander");
    }

    @Override
    public String id() {
        return "mtgtop8";
    }

    @Override
    public List<String> pageHosts() {
        return Arrays.asList("mtgtop8.com", "www.mtgtop8.com");
    }

    @Override
    public List<String> fetchHosts() {
        return Arrays.asList("mtgtop8.com", "www.mtgtop8.com");
    }

    @Override
    public String deckId(URI url) {
        if (url.getPath() == null || !DECK_PATH.matcher(url.getPath()).matches()) {
            return null;
        }
        String d = query(url, "d");
        return d != null && NUMBER.matcher(d).matches() ? d : null;
    }

    static String query(URI url, String key) {
        String raw = url.getRawQuery();
        if (raw == null) {
            return null;
        }
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(key)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }

    @Override
    public ImportedDeck fetch(URI url, String deckId, Fetcher fetcher) throws DeckImportException {
        String list = fetcher.get(URI.create("https://mtgtop8.com/dec?d=" + deckId), "text/plain");
        String event = query(url, "e");
        String format = query(url, "f");
        String page = null;
        if (event != null && NUMBER.matcher(event).matches()) {
            try {
                page = fetcher.get(URI.create("https://mtgtop8.com/event?e=" + event + "&d=" + deckId + (format != null && format.matches("[A-Za-z]+") ? "&f=" + format : "")), "text/html");
            } catch (DeckImportException e) {
                // the list is what matters; the page only names it
                page = null;
            }
        }
        return read(list, page, deckId, event, format);
    }

    static ImportedDeck read(String list, String page, String deckId, String event, String format) throws DeckImportException {
        String url = "https://mtgtop8.com/event?" + (event != null ? "e=" + event + "&" : "") + "d=" + deckId + (format != null ? "&f=" + format : "");
        ImportedDeck deck = new ImportedDeck("mtgtop8", deckId, url);
        if (list == null || list.trim().startsWith("<")) {
            throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, "MTGTop8 answered with a page instead of a deck list");
        }
        for (String raw : list.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("//")) {
                continue;
            }
            Matcher card = CARD_LINE.matcher(line);
            if (!card.matches()) {
                continue;
            }
            ImportedDeck.Section section = card.group(1) != null ? ImportedDeck.Section.SIDE : ImportedDeck.Section.MAIN;
            deck.add(section, SourceSupport.cardName(card.group(4)), card.group(3), null, Integer.parseInt(card.group(2)));
        }
        if (deck.cardCount() == 0) {
            throw new DeckImportException(DeckImportException.Reason.NOT_FOUND, "MTGTop8 has no deck " + deckId);
        }

        String deckType = format != null ? FORMATS.get(format.toUpperCase(Locale.ROOT)) : null;
        if (page != null) {
            Document doc = Jsoup.parse(page);
            Matcher title = TITLE.matcher(doc.title().trim());
            if (title.matches()) {
                deck.setName(title.group(1));
                deck.setAuthor(title.group(2));
            }
            Element eventTitle = doc.selectFirst("div.event_title");
            if (eventTitle != null) {
                deck.setDescription(eventTitle.text());
            }
            Element meta = doc.selectFirst("div.meta_arch");
            if (deckType == null && meta != null) {
                deckType = SourceSupport.deckType(meta.ownText().trim());
            }
        }
        deck.setFormat(deckType);
        if (deck.getName() == null) {
            deck.setName("MTGTop8 deck " + deckId);
        }
        return deck;
    }
}
