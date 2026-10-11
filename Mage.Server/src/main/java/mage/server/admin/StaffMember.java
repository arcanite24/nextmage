package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * A player account with a staff role: it signs in as itself and gets /admin with what its role allows.
 */
@DatabaseTable(tableName = "admin_staff")
public class StaffMember {

    /** the account name in lower case */
    @DatabaseField(id = true)
    public String key;
    /** the account name as it was granted */
    @DatabaseField
    public String name;
    /** moderator, admin or owner */
    @DatabaseField
    public String role;
    @DatabaseField
    public String grantedBy;
    @DatabaseField
    public long grantedAt;

    public StaffMember() {
    }
}
