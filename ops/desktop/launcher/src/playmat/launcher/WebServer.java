package playmat.launcher;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;

/**
 * Serves the built web client, which then talks to the game server's WebSocket bridge on port 17172 of the same
 * host (Mage.Web.Client/src/app/connection.ts). Listens on every interface so players on the same network can open
 * it too. Until the game server is up, page loads get a small "starting" page that reloads itself.
 */
final class WebServer {

    static final int PORT = 17170;

    private static final Map<String, String> TYPES = new HashMap<>();

    static {
        TYPES.put("html", "text/html; charset=utf-8");
        TYPES.put("js", "text/javascript; charset=utf-8");
        TYPES.put("mjs", "text/javascript; charset=utf-8");
        TYPES.put("css", "text/css; charset=utf-8");
        TYPES.put("json", "application/json; charset=utf-8");
        TYPES.put("webmanifest", "application/manifest+json");
        TYPES.put("txt", "text/plain; charset=utf-8");
        TYPES.put("dck", "text/plain; charset=utf-8");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("png", "image/png");
        TYPES.put("jpg", "image/jpeg");
        TYPES.put("jpeg", "image/jpeg");
        TYPES.put("webp", "image/webp");
        TYPES.put("avif", "image/avif");
        TYPES.put("gif", "image/gif");
        TYPES.put("ico", "image/x-icon");
        TYPES.put("woff", "font/woff");
        TYPES.put("woff2", "font/woff2");
        TYPES.put("ttf", "font/ttf");
        TYPES.put("eot", "application/vnd.ms-fontobject");
        TYPES.put("mp3", "audio/mpeg");
        TYPES.put("ogg", "audio/ogg");
        TYPES.put("wav", "audio/wav");
        TYPES.put("map", "application/json; charset=utf-8");
    }

    private static final String STARTING_PAGE = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<meta http-equiv=\"refresh\" content=\"3\"><title>Playmat is starting</title><style>"
            + "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111614;color:#ece6d6;"
            + "font:16px/1.5 system-ui,sans-serif;text-align:center}"
            + "p{margin:.4em 1em}.s{color:#a59f90;font-size:14px}"
            + "i{display:inline-block;width:28px;height:28px;border:3px solid #3a5a51;border-top-color:#f0b13d;"
            + "border-radius:50%;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(1turn)}}"
            + "</style></head><body><div><i></i><p>Playmat is starting&hellip;</p>"
            + "<p class=\"s\">The first start prepares the card database and takes a few minutes. "
            + "This page opens the game by itself when it's ready.</p></div></body></html>";

    private final Path root;
    private final BooleanSupplier gameServerReady;
    private HttpServer server;

    WebServer(Path root, BooleanSupplier gameServerReady) {
        this.root = root.toAbsolutePath().normalize();
        this.gameServerReady = gameServerReady;
    }

    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress(PORT), 64);
        server.setExecutor(Executors.newFixedThreadPool(8, r -> {
            Thread t = new Thread(r, "playmat-web");
            t.setDaemon(true);
            return t;
        }));
        server.createContext("/", this::handle);
        server.start();
        Log.info("Web client on http://localhost:" + PORT);
    }

    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            String method = exchange.getRequestMethod();
            if (!"GET".equals(method) && !"HEAD".equals(method)) {
                send(exchange, 405, "text/plain; charset=utf-8", "Method not allowed".getBytes(StandardCharsets.UTF_8), "no-store");
                return;
            }
            String path = URI.create(exchange.getRequestURI().getRawPath()).getPath();
            if (path == null || path.isEmpty() || path.contains("\0")) {
                path = "/";
            }
            Path file = root.resolve(path.substring(1)).normalize();
            if (!file.startsWith(root)) {
                send(exchange, 404, "text/plain; charset=utf-8", "Not found".getBytes(StandardCharsets.UTF_8), "no-store");
                return;
            }
            boolean exists = Files.isRegularFile(file);
            boolean isPage = !exists || file.equals(root.resolve("index.html"));
            if (isPage && !path.equals("/index.html") && wantsHtml(exchange) && !gameServerReady.getAsBoolean()) {
                send(exchange, 200, TYPES.get("html"), STARTING_PAGE.getBytes(StandardCharsets.UTF_8), "no-store");
                return;
            }
            if (!exists) {
                if (hasExtension(path)) {
                    send(exchange, 404, "text/plain; charset=utf-8", "Not found".getBytes(StandardCharsets.UTF_8), "no-store");
                    return;
                }
                // an app route (/deck/..., /join/...): the single-page app handles it
                file = root.resolve("index.html");
            }
            String name = file.getFileName().toString();
            String cache;
            if (path.startsWith("/assets/")) {
                cache = "public, max-age=31536000, immutable";
            } else if (name.equals("index.html") || name.equals("sw.js") || name.endsWith(".webmanifest")) {
                cache = "no-cache";
            } else {
                cache = "public, max-age=3600";
            }
            send(exchange, 200, type(name), Files.readAllBytes(file), cache);
        } catch (IllegalArgumentException e) {
            send(exchange, 400, "text/plain; charset=utf-8", "Bad request".getBytes(StandardCharsets.UTF_8), "no-store");
        } finally {
            exchange.close();
        }
    }

    private static boolean wantsHtml(HttpExchange exchange) {
        String accept = exchange.getRequestHeaders().getFirst("Accept");
        return accept != null && accept.contains("text/html");
    }

    private static boolean hasExtension(String path) {
        String last = path.substring(path.lastIndexOf('/') + 1);
        return last.contains(".");
    }

    private static String type(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ENGLISH);
        return TYPES.getOrDefault(ext, "application/octet-stream");
    }

    private static void send(HttpExchange exchange, int status, String type, byte[] body, String cache) throws IOException {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", type);
        headers.set("Cache-Control", cache);
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        boolean head = "HEAD".equals(exchange.getRequestMethod());
        exchange.sendResponseHeaders(status, head ? -1 : body.length);
        if (!head) {
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        }
    }
}
