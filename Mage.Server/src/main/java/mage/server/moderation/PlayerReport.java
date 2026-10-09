package mage.server.moderation;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * A player's report about another player, waiting for a moderator.
 */
@DatabaseTable(tableName = "player_report")
public class PlayerReport {

    @DatabaseField(generatedId = true)
    public long id;
    @DatabaseField(index = true)
    public String reporter;
    @DatabaseField(index = true)
    public String reported;
    /** one of ReportStore.REASONS */
    @DatabaseField
    public String reason;
    @DatabaseField(width = 1000)
    public String details;
    /** the game it happened in, when there was one */
    @DatabaseField
    public String gameId;
    @DatabaseField
    public long createdAt;
    @DatabaseField(index = true)
    public boolean open = true;
    /** what the moderator did, when closed */
    @DatabaseField(width = 500)
    public String resolution;
    @DatabaseField
    public long closedAt;

    public PlayerReport() {
    }
}
