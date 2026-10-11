package club.multivac.playmat;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Card pictures kept on the device for good. Every picture the page shows (the site's image proxy under /img/cards/,
 * or Scryfall's CDN and set symbols directly) is answered from app storage when it is there, and downloaded once in the
 * background and kept when it is not. Pictures never change at a given address (Scryfall versions them in the query), so a stored one is never
 * revalidated. The store is capped; past the cap the least recently used pictures go.
 *
 * The WebView's own HTTP cache would also keep them, but it is small, shared with everything else the page loads
 * and evicted by Chromium at will; a match's worth of pictures can be gone by the next evening.
 */
final class PictureCache {

    private static final String TAG = "PictureCache";
    /** Pictures are 50–300 KB; this holds tens of thousands of them. */
    private static final long MAX_BYTES = 2L * 1024 * 1024 * 1024;
    /** Trimming walks the folder, so it runs only after this much has been written since the last time. */
    private static final long TRIM_EVERY_BYTES = 64L * 1024 * 1024;
    private static final int TIMEOUT_MS = 20_000;

    private final File dir;
    private final ExecutorService prefetchPool = Executors.newFixedThreadPool(4);
    /** One download per picture at a time: a second request for it waits for the first. */
    private final Map<String, Object> locks = new ConcurrentHashMap<>();
    /** Pictures waiting for a download, so asking again while one waits does not queue it twice. */
    private final Set<String> queued = ConcurrentHashMap.newKeySet();
    private final AtomicBoolean trimming = new AtomicBoolean(false);
    private long writtenSinceTrim = TRIM_EVERY_BYTES; // trim once soon after start

    private static PictureCache instance;

    /** The one store, shared by the WebView and the page's prefetch requests. */
    static synchronized PictureCache get(Context context) {
        if (instance == null) instance = new PictureCache(context.getApplicationContext());
        return instance;
    }

    private PictureCache(Context context) {
        dir = new File(context.getFilesDir(), "pictures");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
    }

    /** Whether this request is for a card picture this cache answers. */
    static boolean handles(WebResourceRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) return false;
        return isPicture(request.getUrl());
    }

    static boolean isPicture(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        String path = uri.getPath();
        if (!"https".equals(scheme) || host == null || path == null) return false;
        // card pictures, and the set symbols Career's packs show
        if (host.equals("cards.scryfall.io") || host.equals("svgs.scryfall.io")) return true;
        // the deployment's caching proxy for the same CDN (VITE_IMAGE_PROXY); localhost is the app's own shell
        return !host.equals("localhost") && path.startsWith("/img/cards/");
    }

    /**
     * The stored picture. One not stored yet returns null so the WebView loads it itself straight away, and a copy is
     * stored in the background for next time: the WebView answers requests from a few threads, and holding one through
     * a download stalls every other request the page makes behind it.
     */
    WebResourceResponse respond(WebResourceRequest request) {
        String url = request.getUrl().toString();
        File file = fileFor(url);
        if (!file.exists()) {
            prefetch(Collections.singletonList(url));
            return null;
        }
        try {
            touch(file);
            return response(file);
        } catch (IOException e) {
            Log.w(TAG, "Stored picture unreadable: " + url + " (" + e.getMessage() + ")");
            return null;
        }
    }

    /** Downloads pictures in the background, ahead of need; ones already stored are skipped. */
    void prefetch(List<String> urls) {
        for (String url : urls) {
            if (url == null || !isPicture(Uri.parse(url)) || fileFor(url).exists() || !queued.add(url)) continue;
            prefetchPool.execute(() -> {
                try {
                    fetch(url);
                } catch (IOException e) {
                    Log.w(TAG, "Prefetch failed: " + url + " (" + e.getMessage() + ")");
                } finally {
                    queued.remove(url);
                }
            });
        }
    }

    /** {files, bytes} stored now. */
    long[] stats() {
        File[] files = dir.listFiles();
        long bytes = 0;
        int count = 0;
        if (files != null) {
            for (File file : files) {
                if (file.getName().endsWith(".tmp") || file.getName().endsWith(".type")) continue;
                bytes += file.length();
                count++;
            }
        }
        return new long[] { count, bytes };
    }

    void clear() {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File file : files) {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private File fetch(String url) throws IOException {
        File file = fileFor(url);
        if (file.exists()) {
            touch(file);
            return file;
        }
        Object lock = locks.computeIfAbsent(url, key -> new Object());
        try {
            synchronized (lock) {
                if (file.exists()) return file;
                return download(url, file);
            }
        } finally {
            locks.remove(url);
        }
    }

    private File download(String url, File file) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        try {
            int status = connection.getResponseCode();
            String type = connection.getContentType();
            // a 404 or an error page is not a picture: let the WebView show whatever the page does for those
            if (status != 200 || type == null || !type.startsWith("image/")) return null;

            File tmp = new File(dir, file.getName() + ".tmp");
            long written = 0;
            try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    written += read;
                }
            }
            // the type is kept beside the bytes: Scryfall serves jpg, png and svg under the same paths
            File meta = metaFor(file);
            try (FileOutputStream out = new FileOutputStream(meta)) {
                out.write(type.getBytes(StandardCharsets.UTF_8));
            }
            if (!tmp.renameTo(file)) throw new IOException("could not store " + file.getName());
            afterWrite(written);
            return file;
        } finally {
            connection.disconnect();
        }
    }

    private WebResourceResponse response(File file) throws IOException {
        String type = "image/jpeg";
        File meta = metaFor(file);
        if (meta.exists()) {
            try (FileInputStream in = new FileInputStream(meta); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[128];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                type = out.toString("UTF-8").trim();
            }
        }
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "public, max-age=31536000, immutable");
        // the page reads some pictures into canvases (fetch, crossorigin images)
        headers.put("Access-Control-Allow-Origin", "*");
        String mime = type.split(";")[0].trim();
        WebResourceResponse response = new WebResourceResponse(mime, null, new FileInputStream(file));
        response.setStatusCodeAndReasonPhrase(200, "OK");
        response.setResponseHeaders(headers);
        return response;
    }

    private void touch(File file) {
        //noinspection ResultOfMethodCallIgnored
        file.setLastModified(System.currentTimeMillis());
    }

    private synchronized void afterWrite(long bytes) {
        writtenSinceTrim += bytes;
        if (writtenSinceTrim < TRIM_EVERY_BYTES || !trimming.compareAndSet(false, true)) return;
        writtenSinceTrim = 0;
        prefetchPool.execute(() -> {
            try {
                trim();
            } finally {
                trimming.set(false);
            }
        });
    }

    /** Drops the least recently used pictures until the store is under the cap. */
    private void trim() {
        File[] files = dir.listFiles((parent, name) -> !name.endsWith(".type") && !name.endsWith(".tmp"));
        if (files == null) return;
        long total = 0;
        for (File file : files) total += file.length();
        if (total <= MAX_BYTES) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) {
            if (total <= MAX_BYTES * 9 / 10) break;
            total -= file.length();
            //noinspection ResultOfMethodCallIgnored
            file.delete();
            //noinspection ResultOfMethodCallIgnored
            metaFor(file).delete();
        }
    }

    private File fileFor(String url) {
        return new File(dir, sha1(url));
    }

    private File metaFor(File file) {
        return new File(dir, file.getName() + ".type");
    }

    private static String sha1(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
