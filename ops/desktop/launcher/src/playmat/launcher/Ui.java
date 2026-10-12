package playmat.launcher;

/** What the launcher tells the player: the status window, or the console with --headless. */
interface Ui {

    void starting(String headline, String detail);

    /** Live progress under the headline while starting (elapsed time, the server's latest log line). */
    void progress(String detail);

    void ready(String url, String lanUrl);

    /** Something stopped Playmat; canRetry offers a "Try again" button. */
    void failed(String headline, String detail, boolean canRetry);

    void updateAvailable(String version, String url);
}
