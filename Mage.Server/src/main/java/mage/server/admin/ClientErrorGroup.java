package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * One kind of web client crash: every report with the same fingerprint (message, source and top stack frame) is
 * counted here, with the latest one's details. A resolved error that comes back opens again.
 */
@DatabaseTable(tableName = "admin_client_error")
public class ClientErrorGroup {

    @DatabaseField(generatedId = true)
    public long id;
    @DatabaseField(unique = true, index = true)
    public String fingerprint;
    @DatabaseField(width = 500)
    public String message;
    /** where it was caught: window, promise, react, rpc */
    @DatabaseField
    public String source;
    @DatabaseField(width = 200)
    public String path;
    @DatabaseField(width = 4000)
    public String stack;
    @DatabaseField(width = 60)
    public String appVersion;
    @DatabaseField(width = 300)
    public String userAgent;
    @DatabaseField(width = 1000)
    public String context;
    /** the latest player it happened to; null for a visitor */
    @DatabaseField
    public String lastUser;
    @DatabaseField
    public int count;
    @DatabaseField
    public long firstSeen;
    @DatabaseField(index = true)
    public long lastSeen;
    @DatabaseField(index = true)
    public boolean resolved;
    @DatabaseField
    public String resolvedBy;
    @DatabaseField
    public long resolvedAt;
    /** it came back after it was resolved */
    @DatabaseField
    public boolean regressed;

    public ClientErrorGroup() {
    }
}
