package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * A server setting changed from /admin, kept across restarts.
 */
@DatabaseTable(tableName = "admin_setting")
public class AdminSetting {

    @DatabaseField(id = true)
    public String name;
    @DatabaseField(width = 2000)
    public String value;
    @DatabaseField
    public String changedBy;
    @DatabaseField
    public long changedAt;

    public AdminSetting() {
    }
}
