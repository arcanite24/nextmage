package mage.server;

import com.j256.ormlite.field.DataType;
import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

import java.util.Date;

/**
 * A device that chose "keep me signed in": its token stands in for the account's password. Only the token's hash is
 * kept, so the table can't be used to sign in.
 */
@DatabaseTable(tableName = "remembered_login")
public class RememberedLogin {

    @DatabaseField(id = true)
    protected String tokenHash;

    @DatabaseField(indexName = "remembered_login_name_index")
    protected String name;

    @DatabaseField(dataType = DataType.DATE_LONG)
    protected Date lastUsed;

    public RememberedLogin() {
    }

    RememberedLogin(String tokenHash, String name, Date lastUsed) {
        this.tokenHash = tokenHash;
        this.name = name;
        this.lastUsed = lastUsed;
    }
}
