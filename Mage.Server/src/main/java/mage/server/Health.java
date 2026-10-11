package mage.server;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpServer;
import mage.server.managers.ManagerFactory;
import org.apache.log4j.Logger;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.management.ManagementFactory;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What build is running, and a /healthz answer for the container's health check. The endpoint listens on the
 * loopback address only (IPv4, which the container health check dials) (port {@value #DEFAULT_PORT}, or -Dxmage.healthPort; 0 turns it off).
 */
public final class Health {

    private static final Logger logger = Logger.getLogger(Health.class);

    public static final String PORT_PROP = "xmage.healthPort";
    public static final String COMMIT_PROP = "xmage.commit";
    static final int DEFAULT_PORT = 17173;

    private static volatile String commit;

    private Health() {
    }

    public static String version() {
        return Main.getVersion().toString(false);
    }

    /** The git commit the server was built from: -Dxmage.commit, or the .commit file the Docker build writes; null when unknown. */
    public static String commit() {
        if (commit == null) {
            String fromProperty = System.getProperty(COMMIT_PROP);
            commit = fromProperty != null && !fromProperty.trim().isEmpty() ? fromProperty.trim() : readCommitFile(Paths.get(".commit"));
        }
        return commit.isEmpty() ? null : commit;
    }

    static String readCommitFile(Path file) {
        try {
            if (Files.isRegularFile(file)) {
                String text = new String(Files.readAllBytes(file), StandardCharsets.UTF_8).trim();
                return text.matches("[0-9a-f]{7,64}") ? text : "";
            }
        } catch (IOException e) {
            logger.warn("Can't read " + file + ": " + e.getMessage());
        }
        return "";
    }

    static Map<String, Object> snapshot(ManagerFactory managers) {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "ok");
        health.put("version", version());
        health.put("commit", commit());
        health.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        health.put("usersOnline", managers.userManager().getUsers().size());
        health.put("activeGames", managers.gameManager().getNumberActiveGames());
        Maintenance.MaintenancePlan maintenance = Maintenance.get().plan();
        health.put("maintenanceAt", maintenance == null ? null : maintenance.startsAt);
        BackupStatus.BackupRun backup = BackupStatus.read();
        if (backup != null) {
            health.put("backupProblem", backup.problem);
        }
        return health;
    }

    /** Starts the endpoint unless it is turned off; a port in use is logged, not fatal. */
    static void start(ManagerFactory managers) {
        int port = Integer.getInteger(PORT_PROP, DEFAULT_PORT);
        if (port <= 0) {
            return;
        }
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getByAddress(new byte[]{127, 0, 0, 1}), port), 0);
            Gson gson = new Gson();
            server.createContext("/healthz", exchange -> {
                byte[] body;
                int status;
                try {
                    body = gson.toJson(snapshot(managers)).getBytes(StandardCharsets.UTF_8);
                    status = 200;
                } catch (RuntimeException e) {
                    body = ("{\"status\":\"error\"}").getBytes(StandardCharsets.UTF_8);
                    status = 500;
                }
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, body.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(body);
                }
            });
            server.setExecutor(null);
            server.start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0), "Health shutdown"));
            logger.info("Health check on http://127.0.0.1:" + port + "/healthz");
        } catch (IOException e) {
            logger.warn("Health check endpoint not started on port " + port + ": " + e.getMessage());
        }
    }
}
