package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * Someone allowed on a contributors-only server, by account name or by email (stored lower case).
 */
@DatabaseTable(tableName = "allow_entry")
public class AllowEntry {

    @DatabaseField(generatedId = true)
    public long id;
    @DatabaseField(index = true)
    public String name;
    @DatabaseField(index = true)
    public String email;
    /** e.g. a GitHub handle, or where the invite came from */
    @DatabaseField(width = 300)
    public String note;
    @DatabaseField
    public String addedBy;
    @DatabaseField
    public long addedAt;

    public AllowEntry() {
    }
}
