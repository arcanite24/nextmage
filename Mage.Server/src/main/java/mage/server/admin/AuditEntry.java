package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * One staff action: who did what to whom, and why.
 */
@DatabaseTable(tableName = "audit_entry")
public class AuditEntry {

    @DatabaseField(generatedId = true)
    public long id;
    @DatabaseField(index = true)
    public long at;
    /** the staff account, or "console" for the shared admin password */
    @DatabaseField(index = true)
    public String actor;
    /** what was done, e.g. "access.mode" or "user.lock" */
    @DatabaseField(index = true)
    public String action;
    /** who or what it was done to */
    @DatabaseField(index = true)
    public String target;
    @DatabaseField(width = 1000)
    public String detail;
    /** the reason staff gave, for the actions that ask for one */
    @DatabaseField(width = 500)
    public String reason;

    public AuditEntry() {
    }
}
