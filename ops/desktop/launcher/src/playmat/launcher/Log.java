package playmat.launcher;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/** launcher.log in the data folder (and the console, when there is one). */
final class Log {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static PrintStream file;

    private Log() {
    }

    static synchronized void open(Path path) {
        try {
            file = new PrintStream(Files.newOutputStream(path), true, "UTF-8");
        } catch (IOException e) {
            System.err.println("Can't write " + path + ": " + e.getMessage());
        }
    }

    static void info(String message) {
        write("INFO ", message);
    }

    static void warn(String message) {
        write("WARN ", message);
    }

    static void error(String message, Throwable cause) {
        write("ERROR", message + (cause == null ? "" : ": " + cause));
        if (cause != null && file != null) {
            cause.printStackTrace(file);
        }
    }

    private static synchronized void write(String level, String message) {
        String line = TIME.format(LocalDateTime.now()) + " " + level + " " + message;
        System.out.println(line);
        if (file != null) {
            file.println(line);
        }
    }
}
