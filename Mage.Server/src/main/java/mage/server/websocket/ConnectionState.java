package mage.server.websocket;

import mage.server.websocket.rpc.RpcConnection;
import org.java_websocket.WebSocket;
import org.jboss.remoting.callback.InvokerCallbackHandler;

import java.net.InetSocketAddress;
import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.Executor;

/**
 * Web client bridge: per-connection state (bound session, request queue, rate limit).
 * <p>
 * Requests of one connection run one at a time and in order on the shared worker pool,
 * so slow requests never block the socket threads or other players.
 */
final class ConnectionState implements RpcConnection {

    // token bucket: sustained requests per second and burst size
    private static final double RATE_PER_SECOND = 40.0;
    private static final double BURST = 120.0;

    private final WebSocket conn;
    private final String remoteHost;
    private final Executor workers;
    private final Queue<Runnable> queue = new ArrayDeque<>();
    private boolean running;

    private volatile String sessionId;

    private int rateLimitStrikes;
    private double tokens = BURST;
    private long lastRefillNanos = System.nanoTime();

    ConnectionState(WebSocket conn, Executor workers) {
        this.conn = conn;
        this.workers = workers;
        InetSocketAddress remote = conn.getRemoteSocketAddress();
        this.remoteHost = remote == null || remote.getAddress() == null ? "" : remote.getAddress().getHostAddress();
    }

    @Override
    public String getSessionId() {
        return sessionId;
    }

    @Override
    public void bindSession(String sessionId) {
        this.sessionId = sessionId;
    }

    @Override
    public String getRemoteHost() {
        return remoteHost;
    }

    @Override
    public InvokerCallbackHandler createCallbackHandler() {
        return new WebSocketCallbackHandler(conn);
    }

    synchronized boolean tryAcquire() {
        long now = System.nanoTime();
        tokens = Math.min(BURST, tokens + (now - lastRefillNanos) / 1_000_000_000.0 * RATE_PER_SECOND);
        lastRefillNanos = now;
        if (tokens < 1.0) {
            return false;
        }
        tokens -= 1.0;
        return true;
    }

    synchronized int recordRateLimitStrike() {
        return ++rateLimitStrikes;
    }

    /**
     * Runs the task after every earlier task of this connection has finished.
     *
     * @throws java.util.concurrent.RejectedExecutionException when the worker pool is saturated
     */
    void submit(Runnable task) {
        synchronized (queue) {
            queue.add(task);
            if (running) {
                return;
            }
            running = true;
        }
        try {
            workers.execute(this::drain);
        } catch (RuntimeException e) {
            synchronized (queue) {
                queue.remove(task);
                running = false;
            }
            throw e;
        }
    }

    private void drain() {
        while (true) {
            Runnable next;
            synchronized (queue) {
                next = queue.poll();
                if (next == null) {
                    running = false;
                    return;
                }
            }
            next.run();
        }
    }
}
