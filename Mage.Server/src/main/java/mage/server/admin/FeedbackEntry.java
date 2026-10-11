package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * Feedback a player sent from the app, for staff to read and work through.
 */
@DatabaseTable(tableName = "admin_feedback")
public class FeedbackEntry {

    public static final String NEW = "new";
    public static final String SEEN = "seen";
    public static final String DONE = "done";

    @DatabaseField(generatedId = true)
    public long id;
    @DatabaseField(index = true)
    public long createdAt;
    /** the account or guest name it came from */
    @DatabaseField(index = true)
    public String userName;
    /** bug, idea or other */
    @DatabaseField
    public String type;
    @DatabaseField(width = 200)
    public String title;
    @DatabaseField(width = 4000)
    public String message;
    /** where the app was when it was sent, and its version */
    @DatabaseField(width = 300)
    public String context;
    /** new, seen or done */
    @DatabaseField(index = true)
    public String status;
    /** staff's note, e.g. the issue it became */
    @DatabaseField(width = 500)
    public String note;
    @DatabaseField
    public String handledBy;
    @DatabaseField
    public long handledAt;

    public FeedbackEntry() {
    }
}
