package playmat.launcher;

/** --headless, or no display: status lines on the console, Ctrl+C quits. */
final class ConsoleUi implements Ui {

    private String lastProgress = "";
    private long lastProgressAt;

    @Override
    public void starting(String headline, String detail) {
        System.out.println(ascii("Playmat: " + headline + (detail.isEmpty() ? "" : " " + detail)));
    }

    @Override
    public synchronized void progress(String detail) {
        // once every 15 seconds is plenty in a terminal
        long now = System.currentTimeMillis();
        if (!detail.equals(lastProgress) && now - lastProgressAt > 15000) {
            System.out.println(ascii("  " + detail));
            lastProgress = detail;
            lastProgressAt = now;
        }
    }

    @Override
    public void ready(String url, String lanUrl) {
        System.out.println("Playmat is ready: open " + url);
        if (lanUrl != null) {
            System.out.println("Players on your network can open " + lanUrl);
        }
        System.out.println("Press Ctrl+C to stop.");
    }

    @Override
    public void failed(String headline, String detail, boolean canRetry) {
        System.out.println(ascii("Playmat: " + headline));
        if (!detail.isEmpty()) {
            System.out.println(ascii("  " + detail));
        }
    }

    /** Terminals that aren't UTF-8 print the window's typography as question marks. */
    private static String ascii(String text) {
        return text.replace("\u2026", "...").replace("\u00b7", "-");
    }

    @Override
    public void updateAvailable(String version, String url) {
        System.out.println("Playmat " + version + " is available: " + url);
    }
}
