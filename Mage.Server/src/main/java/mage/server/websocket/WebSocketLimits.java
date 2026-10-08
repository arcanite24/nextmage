package mage.server.websocket;

import org.apache.log4j.Logger;

/**
 * Web client bridge: abuse limits and proxy settings, read from system properties ({@code -Dname=value}).
 * <ul>
 * <li>{@value #TRUSTED_PROXIES_PROP}: reverse proxies whose X-Forwarded-For / X-Real-IP headers are believed,
 * comma separated IPs or CIDR ranges. Default: none (the TCP peer is the client).</li>
 * <li>{@value #MAX_CONNECTIONS_PER_IP_PROP}: open WebSocket connections per client IP, 0 = unlimited. Default 16.
 * Loopback clients are not limited (local development and e2e tests).</li>
 * <li>{@value #MAX_OUTGOING_BYTES_PROP}: bytes queued for a slow client before its connection is dropped.
 * Default 16 MB.</li>
 * </ul>
 */
final class WebSocketLimits {

    private static final Logger logger = Logger.getLogger(WebSocketLimits.class);

    static final String TRUSTED_PROXIES_PROP = ClientAddressResolver.TRUSTED_PROXIES_PROP;
    static final String MAX_CONNECTIONS_PER_IP_PROP = "xmage.web.maxConnectionsPerIp";
    static final String MAX_OUTGOING_BYTES_PROP = "xmage.web.maxOutgoingBytes";

    static final int DEFAULT_MAX_CONNECTIONS_PER_IP = 16;
    static final long DEFAULT_MAX_OUTGOING_BYTES = 16L * 1024 * 1024;

    final ClientAddressResolver addressResolver;
    final int maxConnectionsPerIp;
    final boolean limitLoopback;
    final long maxOutgoingBytes;

    WebSocketLimits(ClientAddressResolver addressResolver, int maxConnectionsPerIp, boolean limitLoopback, long maxOutgoingBytes) {
        this.addressResolver = addressResolver;
        this.maxConnectionsPerIp = maxConnectionsPerIp;
        this.limitLoopback = limitLoopback;
        this.maxOutgoingBytes = maxOutgoingBytes;
    }

    static WebSocketLimits fromSystemProperties() {
        return new WebSocketLimits(
                ClientAddressResolver.fromSystemProperties(),
                (int) longProperty(MAX_CONNECTIONS_PER_IP_PROP, DEFAULT_MAX_CONNECTIONS_PER_IP),
                false,
                longProperty(MAX_OUTGOING_BYTES_PROP, DEFAULT_MAX_OUTGOING_BYTES));
    }

    private static long longProperty(String name, long defaultValue) {
        String value = System.getProperty(name);
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        try {
            long parsed = Long.parseLong(value.trim());
            if (parsed < 0) {
                throw new NumberFormatException("negative");
            }
            return parsed;
        } catch (NumberFormatException e) {
            logger.warn("Ignoring invalid -D" + name + "=" + value + ", using " + defaultValue);
            return defaultValue;
        }
    }
}
