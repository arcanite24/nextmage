package mage.server.websocket.service.deckimport;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Web client bridge: fetches deck pages and APIs for the deck sources, and nothing else.
 * <ul>
 * <li>https on the default port, to hosts on the allowlist only (so no IP literals, no internal hosts);</li>
 * <li>redirects are followed by hand, and only to allowlisted hosts;</li>
 * <li>GET only, no cookies, an honest User-Agent;</li>
 * <li>an 8 second deadline and a 2 MB response cap, enforced while reading.</li>
 * </ul>
 */
final class HttpFetcher implements Fetcher {

    static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final int TIMEOUT_MILLIS = 8_000;
    private static final Pattern CHARSET = Pattern.compile("charset=([\\w.-]+)", Pattern.CASE_INSENSITIVE);

    private final Set<String> allowedHosts;
    private final String userAgent;

    HttpFetcher(Set<String> allowedHosts, String userAgent) {
        this.allowedHosts = allowedHosts;
        this.userAgent = userAgent;
    }

    /** Whether the server may fetch this address at all. */
    static boolean allowed(URI uri, Set<String> allowedHosts) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getRawUserInfo() != null) {
            return false;
        }
        if (uri.getPort() != -1 && uri.getPort() != 443) {
            return false;
        }
        String host = uri.getHost();
        return host != null && allowedHosts.contains(host.toLowerCase(Locale.ROOT));
    }

    @Override
    public String get(URI uri, String accept) throws DeckImportException {
        long deadline = System.currentTimeMillis() + TIMEOUT_MILLIS;
        URI current = uri;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            if (!allowed(current, allowedHosts)) {
                throw new DeckImportException(DeckImportException.Reason.UNSUPPORTED, "Not a deck site the server reads: " + current.getHost());
            }
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) current.toURL().openConnection();
                connection.setRequestMethod("GET");
                connection.setInstanceFollowRedirects(false);
                connection.setUseCaches(false);
                connection.setConnectTimeout(5_000);
                connection.setReadTimeout(TIMEOUT_MILLIS);
                connection.setRequestProperty("User-Agent", userAgent);
                connection.setRequestProperty("Accept", accept);
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    if (location == null) {
                        throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, current.getHost() + " redirected nowhere");
                    }
                    current = current.resolve(location);
                    continue;
                }
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String body = stream == null ? "" : read(stream, charsetOf(connection.getContentType()), current, deadline);
                if (status == 200) {
                    return body;
                }
                throw failure(status, body, current);
            } catch (SocketTimeoutException e) {
                throw new DeckImportException(DeckImportException.Reason.TIMEOUT, current.getHost() + " didn't answer in time", e);
            } catch (IOException e) {
                throw new DeckImportException(DeckImportException.Reason.UNAVAILABLE, current.getHost() + " couldn't be reached", e);
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }
        throw new DeckImportException(DeckImportException.Reason.SITE_CHANGED, uri.getHost() + " redirected too many times");
    }

    static DeckImportException failure(int status, String body, URI uri) {
        String host = uri.getHost();
        boolean challenge = body != null && (body.contains("Just a moment...") || body.contains("cf-chl") || body.contains("challenge-platform"));
        if (challenge) {
            return new DeckImportException(DeckImportException.Reason.BLOCKED, host + " asked for a browser check");
        }
        switch (status) {
            case 401:
            case 403:
                return new DeckImportException(DeckImportException.Reason.PRIVATE, host + " won't share this deck");
            case 404:
            case 410:
                return new DeckImportException(DeckImportException.Reason.NOT_FOUND, host + " has no such deck");
            case 429:
                return new DeckImportException(DeckImportException.Reason.RATE_LIMITED, host + " asked us to slow down");
            default:
                return new DeckImportException(status >= 500 ? DeckImportException.Reason.UNAVAILABLE : DeckImportException.Reason.SITE_CHANGED,
                        host + " answered " + status);
        }
    }

    private static Charset charsetOf(String contentType) {
        Matcher declared = CHARSET.matcher(contentType == null ? "" : contentType);
        if (declared.find()) {
            try {
                return Charset.forName(declared.group(1));
            } catch (RuntimeException e) {
                return StandardCharsets.UTF_8;
            }
        }
        return StandardCharsets.UTF_8;
    }

    static String read(InputStream stream, Charset charset, URI uri, long deadline) throws IOException, DeckImportException {
        try (InputStream in = stream) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                if (out.size() + read > MAX_BYTES) {
                    throw new DeckImportException(DeckImportException.Reason.TOO_LARGE, uri.getHost() + " sent more than a deck's worth of data");
                }
                if (System.currentTimeMillis() > deadline) {
                    throw new DeckImportException(DeckImportException.Reason.TIMEOUT, uri.getHost() + " didn't finish answering in time");
                }
                out.write(buffer, 0, read);
            }
            return new String(out.toByteArray(), charset);
        }
    }
}
