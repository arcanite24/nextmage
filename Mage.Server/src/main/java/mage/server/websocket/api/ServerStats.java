package mage.server.websocket.api;

import mage.server.managers.ManagerFactory;
import mage.server.websocket.BridgeMetrics;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.lang.management.OperatingSystemMXBean;

/**
 * Admin console: the server's load at a glance.
 */
public class ServerStats {

    public long now;
    public long uptimeMillis;
    public int usersOnline;
    public int tables;
    public int activeGames;
    public long heapUsed;
    public long heapMax;
    /** this process's CPU use, 0..1, or -1 when the JVM can't tell */
    public double processCpu;
    /** the system load average over the last minute, or -1 */
    public double systemLoad;
    public int processors;
    public int threads;
    public BridgeMetrics.BridgeSnapshot bridge;

    static ServerStats collect(ManagerFactory managers) {
        ServerStats stats = new ServerStats();
        stats.now = System.currentTimeMillis();
        stats.uptimeMillis = ManagementFactory.getRuntimeMXBean().getUptime();
        stats.usersOnline = managers.userManager().getUsers().size();
        stats.tables = managers.tableManager().getTables().size();
        stats.activeGames = managers.gameManager().getNumberActiveGames();
        MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        stats.heapUsed = heap.getUsed();
        stats.heapMax = heap.getMax();
        OperatingSystemMXBean os = ManagementFactory.getOperatingSystemMXBean();
        stats.systemLoad = os.getSystemLoadAverage();
        stats.processors = os.getAvailableProcessors();
        stats.processCpu = os instanceof com.sun.management.OperatingSystemMXBean
                ? ((com.sun.management.OperatingSystemMXBean) os).getProcessCpuLoad() : -1;
        stats.threads = ManagementFactory.getThreadMXBean().getThreadCount();
        stats.bridge = BridgeMetrics.get().snapshot();
        return stats;
    }
}
