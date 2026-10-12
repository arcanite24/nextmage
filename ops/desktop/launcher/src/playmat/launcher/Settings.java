package playmat.launcher;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/** The few choices a player can make, kept in settings.properties in the data folder. */
final class Settings {

    private final Path file;
    private final Properties values = new Properties();

    Settings(Path file) {
        this.file = file;
        if (Files.isRegularFile(file)) {
            try (InputStream in = Files.newInputStream(file)) {
                values.load(in);
            } catch (IOException e) {
                Log.warn("Can't read " + file + ": " + e.getMessage());
            }
        }
    }

    /** Player accounts: players register with a name and a password. Career needs them. On by default. */
    boolean accounts() {
        return !"false".equalsIgnoreCase(values.getProperty("accounts", "true").trim());
    }

    void setAccounts(boolean on) {
        values.setProperty("accounts", Boolean.toString(on));
        save();
    }

    /** Java heap for the server, e.g. "2g"; empty picks one from the computer's memory. */
    String memory() {
        return values.getProperty("memory", "").trim();
    }

    private void save() {
        try (OutputStream out = Files.newOutputStream(file)) {
            values.store(out, "Playmat settings");
        } catch (IOException e) {
            Log.warn("Can't save " + file + ": " + e.getMessage());
        }
    }
}
