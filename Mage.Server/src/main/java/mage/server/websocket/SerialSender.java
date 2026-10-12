package mage.server.websocket;

import mage.util.XmageThreadFactory;
import org.apache.log4j.Logger;

import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Web client bridge: encodes and sends one connection's game messages in order, on a small shared pool, so a game
 * thread hands a message over and goes on with the game instead of diffing and writing it out itself.
 * <p>
 * At most {@value #MAX_PENDING} messages wait per connection; past that the caller waits for the oldest to go out,
 * as it did when it sent them itself, so a client that can't keep up never piles messages up in memory.
 * {@code -Dxmage.web.asyncSend=false} sends on the caller's thread.
 */
final class SerialSender implements Executor {

    private static final Logger logger = Logger.getLogger(SerialSender.class);

    static final int MAX_PENDING = 32;
    static final boolean ENABLED = !"false".equalsIgnoreCase(System.getProperty("xmage.web.asyncSend"));

    private static final ThreadPoolExecutor POOL;

    static {
        int threads = Math.max(2, Runtime.getRuntime().availableProcessors());
        POOL = new ThreadPoolExecutor(threads, threads, 60, TimeUnit.SECONDS, new LinkedBlockingQueue<>(),
                new XmageThreadFactory("WEB-SEND", true));
        POOL.allowCoreThreadTimeOut(true);
    }

    /** runs each message on the caller's thread (tests, or async sending turned off) */
    static final Executor DIRECT = Runnable::run;

    static Executor create() {
        return ENABLED ? new SerialSender() : DIRECT;
    }

    private final Queue<Runnable> queue = new ArrayDeque<>();
    private final Semaphore room = new Semaphore(MAX_PENDING);
    private boolean running;

    private SerialSender() {
    }

    @Override
    public void execute(Runnable task) {
        room.acquireUninterruptibly();
        synchronized (queue) {
            queue.add(task);
            if (running) {
                return;
            }
            running = true;
        }
        POOL.execute(this::drain);
    }

    private void drain() {
        for (;;) {
            Runnable task;
            synchronized (queue) {
                task = queue.poll();
                if (task == null) {
                    running = false;
                    return;
                }
            }
            try {
                task.run();
            } catch (Throwable e) {
                logger.warn("Web client message not sent: " + e, e);
            } finally {
                room.release();
            }
        }
    }
}
