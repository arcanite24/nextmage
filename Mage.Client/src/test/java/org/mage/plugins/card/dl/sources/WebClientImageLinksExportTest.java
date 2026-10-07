package org.mage.plugins.card.dl.sources;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * Exports the desktop client's Scryfall image exceptions (special card links and token images) for the web client,
 * so both clients show the same pictures.
 * <p>
 * Regenerate after changing the Scryfall support classes:
 * {@code mvn -pl Mage.Client test -Dtest=WebClientImageLinksExportTest -Dxmage.updateWebImageLinks=true}
 */
public class WebClientImageLinksExportTest {

    private static final Path EXPORT_FILE = Paths.get("..", "Mage.Web.Client", "public", "data", "scryfall-links.json");

    @Test
    public void webClientImageLinksAreUpToDate() throws Exception {
        Map<String, Object> export = new LinkedHashMap<>();
        // keys: SET/Card Name[/number]; values: Scryfall API image links
        export.put("cards", new TreeMap<>(ScryfallImageSupportCards.getDirectDownloadLinks()));
        // keys: SET/Token Name[/image number]
        export.put("tokens", new TreeMap<>(ScryfallImageSupportTokens.getTokenLinks()));

        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
        String expected = gson.toJson(export) + "\n";

        if (Boolean.getBoolean("xmage.updateWebImageLinks")) {
            Files.createDirectories(EXPORT_FILE.getParent());
            Files.write(EXPORT_FILE, expected.getBytes(StandardCharsets.UTF_8));
        }

        assertTrue("missing " + EXPORT_FILE + ", regenerate with -Dxmage.updateWebImageLinks=true", Files.exists(EXPORT_FILE));
        assertEquals("stale " + EXPORT_FILE + ", regenerate with -Dxmage.updateWebImageLinks=true",
                expected, new String(Files.readAllBytes(EXPORT_FILE), StandardCharsets.UTF_8));
    }
}
