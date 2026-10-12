package playmat.launcher;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;

/**
 * Where things are. The installed app is read-only as far as the launcher is concerned (a macOS app may even run
 * from a read-only translocated copy); everything the server writes lives in the per-user data folder.
 *
 * <pre>
 * &lt;install&gt;/runtime/            the bundled Java runtime
 * &lt;install&gt;/app/playmat-launcher.jar
 * &lt;install&gt;/app/VERSION
 * &lt;install&gt;/app/server/{lib,plugins,config}   the XMage server release
 * &lt;install&gt;/app/web/              the built web client
 *
 * &lt;data&gt;/server/                  the server's working folder: config, plugins (copied), db, saved, extensions
 * &lt;data&gt;/logs/                    launcher.log, server.log
 * &lt;data&gt;/settings.properties
 * </pre>
 */
final class Layout {

    final Path app;
    final Path data;

    private Layout(Path app, Path data) {
        this.app = app;
        this.data = data;
    }

    static Layout detect() throws IOException {
        Path app = appDir();
        Path data = dataDir();
        Files.createDirectories(data);
        Files.createDirectories(data.resolve("logs"));
        return new Layout(app, data);
    }

    Path serverRelease() {
        return app.resolve("server");
    }

    Path web() {
        return app.resolve("web");
    }

    Path serverHome() {
        return data.resolve("server");
    }

    Path logs() {
        return data.resolve("logs");
    }

    String version() {
        try {
            return new String(Files.readAllBytes(app.resolve("VERSION")), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            return "dev";
        }
    }

    /** The java the launcher runs on: the bundled runtime in a release, whatever started it otherwise. */
    static Path javaExecutable() {
        Path home = Paths.get(System.getProperty("java.home"));
        boolean windows = isWindows();
        // the server writes its output to a file, so javaw (no console window) is right on Windows
        Path exe = home.resolve("bin").resolve(windows ? "javaw.exe" : "java");
        if (!Files.isRegularFile(exe)) {
            exe = home.resolve("bin").resolve(windows ? "java.exe" : "java");
        }
        return exe;
    }

    static boolean isWindows() {
        return os().startsWith("windows");
    }

    static boolean isMac() {
        return os().startsWith("mac");
    }

    private static String os() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ENGLISH);
    }

    /** -Dplaymat.app, else the folder holding this jar. */
    private static Path appDir() throws IOException {
        String override = System.getProperty("playmat.app");
        if (override != null && !override.isEmpty()) {
            return Paths.get(override).toAbsolutePath().normalize();
        }
        try {
            Path jar = Paths.get(Layout.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            return (Files.isDirectory(jar) ? jar : jar.getParent()).toAbsolutePath().normalize();
        } catch (URISyntaxException e) {
            throw new IOException("Can't tell where Playmat is installed", e);
        }
    }

    /** PLAYMAT_DATA or -Dplaymat.data, else the platform's per-user application data folder. */
    private static Path dataDir() {
        String override = System.getProperty("playmat.data", System.getenv("PLAYMAT_DATA"));
        if (override != null && !override.isEmpty()) {
            return Paths.get(override).toAbsolutePath().normalize();
        }
        Path home = Paths.get(System.getProperty("user.home"));
        if (isWindows()) {
            String local = System.getenv("LOCALAPPDATA");
            return (local != null && !local.isEmpty() ? Paths.get(local) : home.resolve("AppData").resolve("Local"))
                    .resolve("Playmat");
        }
        if (isMac()) {
            return home.resolve("Library").resolve("Application Support").resolve("Playmat");
        }
        String xdg = System.getenv("XDG_DATA_HOME");
        return (xdg != null && !xdg.isEmpty() ? Paths.get(xdg) : home.resolve(".local").resolve("share")).resolve("playmat");
    }
}
