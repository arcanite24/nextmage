package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * Someone without an invite asking to be let in to a contributors-only server.
 */
@DatabaseTable(tableName = "access_request")
public class AccessRequest {

    public static final String OPEN = "open";
    public static final String APPROVED = "approved";
    public static final String DECLINED = "declined";

    @DatabaseField(generatedId = true)
    public long id;
    @DatabaseField(index = true)
    public String name;
    @DatabaseField(index = true)
    public String email;
    @DatabaseField(width = 500)
    public String note;
    @DatabaseField
    public long createdAt;
    /** open, approved or declined */
    @DatabaseField(index = true)
    public String status = OPEN;
    @DatabaseField
    public String decidedBy;
    @DatabaseField
    public long decidedAt;

    public AccessRequest() {
    }
}
