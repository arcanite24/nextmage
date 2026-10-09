package mage.server.replay;

import org.apache.log4j.Logger;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Replay recording settings, from system properties:
 * <ul>
 * <li>{@code xmage.replays} - record games for replay (default true)</li>
 * <li>{@code xmage.replays.dir} - where replays are kept (default saved/replays)</li>
 * <li>{@code xmage.replays.retentionDays} - replays older than this are deleted (default 30)</li>
 * <li>{@code xmage.replays.maxCount} - at most this many replays are kept, the oldest go first (default 300)</li>
 * </ul>
 */
public final class ReplaySettings {

    private static final Logger logger = Logger.getLogger(ReplaySettings.class);

    public static final String ENABLED_PROP = "xmage.replays";
    public static final String DIR_PROP = "xmage.replays.dir";
    public static final String RETENTION_DAYS_PROP = "xmage.replays.retentionDays";
    public static final String MAX_COUNT_PROP = "xmage.replays.maxCount";

    /** a runaway game stops recording here rather than filling the disk (a long game is a few thousand) */
    public static final int MAX_EVENTS_PER_GAME = 20_000;

    public final boolean enabled;
    public final Path dir;
    public final int retentionDays;
    public final int maxCount;

    public ReplaySettings(boolean enabled, Path dir, int retentionDays, int maxCount) {
        this.enabled = enabled;
        this.dir = dir;
        this.retentionDays = Math.max(1, retentionDays);
        this.maxCount = Math.max(1, maxCount);
    }

    public static ReplaySettings fromSystemProperties() {
        return new ReplaySettings(
                !"false".equalsIgnoreCase(System.getProperty(ENABLED_PROP, "true").trim()),
                Paths.get(System.getProperty(DIR_PROP, "saved/replays")),
                intProperty(RETENTION_DAYS_PROP, 30),
                intProperty(MAX_COUNT_PROP, 300)
        );
    }

    private static int intProperty(String name, int defaultValue) {
        String value = System.getProperty(name);
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            logger.warn("Ignoring " + name + "=" + value + ", not a number; using " + defaultValue);
            return defaultValue;
        }
    }
}
