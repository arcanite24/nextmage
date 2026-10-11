package mage.server.admin;

import com.j256.ormlite.field.DatabaseField;
import com.j256.ormlite.table.DatabaseTable;

/**
 * An account that signs in with GitHub: the GitHub user's id (it survives renames) and its login when last seen.
 */
@DatabaseTable(tableName = "github_link")
public class GithubLink {

    @DatabaseField(id = true)
    public long githubId;
    @DatabaseField(index = true)
    public String login;
    @DatabaseField(index = true)
    public String account;
    @DatabaseField
    public long linkedAt;

    public GithubLink() {
    }
}
