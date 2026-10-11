package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * An invite link (/join?invite=code): registers an account and puts it on the allowlist.
 */
@DatabaseTable(tableName = "invite")
public class Invite {

    @DatabaseField(id = true)
    public String code;
    @DatabaseField(width = 300)
    public String note;
    @DatabaseField
    public String createdBy;
    @DatabaseField
    public long createdAt;
    @DatabaseField
    public long expiresAt;
    @DatabaseField
    public int maxUses;
    @DatabaseField
    public int uses;
    @DatabaseField
    public boolean revoked;
    /** the accounts it registered, comma separated */
    @DatabaseField(width = 2000)
    public String usedBy;

    public Invite() {
    }

    public boolean usable(long now) {
        return !revoked && uses < maxUses && now < expiresAt;
    }
}
