package playmat.launcher;

import javax.imageio.ImageIO;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JProgressBar;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** The small status window: what's happening, a big Play button, and Quit. */
final class Window implements Ui {

    private static final Color MAT = new Color(0x0f1714);
    private static final Color MAT_RAISED = new Color(0x1c2d27);
    private static final Color INK = new Color(0xe9e4d6);
    private static final Color INK_DIM = new Color(0xa6a193);
    private static final Color GOLD = new Color(0xf0b13d);
    private static final Color GOLD_INK = new Color(0x1d1406);
    private static final Color ERROR = new Color(0xff8a7a);

    private final Main main;
    private JFrame frame;
    private JLabel headline;
    private JLabel detail;
    private JLabel progress;
    private JProgressBar bar;
    private Pill play;
    private Pill retry;
    private JLabel lan;
    private JLabel update;
    private String url;

    private Window(Main main) {
        this.main = main;
    }

    static Window open(Main main, String version, boolean accounts) throws InterruptedException, InvocationTargetException {
        Window window = new Window(main);
        SwingUtilities.invokeAndWait(() -> window.build(version, accounts));
        return window;
    }

    private void build(String version, boolean accounts) {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
            // the default look works too
        }
        frame = new JFrame("Playmat");
        frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
        frame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                confirmQuit();
            }
        });
        List<Image> icons = icons();
        if (!icons.isEmpty()) {
            frame.setIconImages(icons);
        }

        JPanel root = new JPanel(new BorderLayout(18, 0));
        root.setBackground(MAT);
        root.setBorder(BorderFactory.createEmptyBorder(22, 22, 18, 22));

        JLabel logo = new JLabel();
        if (!icons.isEmpty()) {
            logo.setIcon(new javax.swing.ImageIcon(icons.get(icons.size() - 1).getScaledInstance(72, 72, Image.SCALE_SMOOTH)));
        }
        logo.setAlignmentY(Component.TOP_ALIGNMENT);
        JPanel logoColumn = column();
        logoColumn.add(logo);
        root.add(logoColumn, BorderLayout.WEST);

        JPanel body = column();
        headline = label("Starting Playmat…", 20f, Font.BOLD, INK);
        detail = label(" ", 13f, Font.PLAIN, INK_DIM);
        progress = label(" ", 12f, Font.PLAIN, INK_DIM);
        bar = new JProgressBar();
        bar.setIndeterminate(true);
        bar.setAlignmentX(Component.LEFT_ALIGNMENT);
        bar.setMaximumSize(new Dimension(Integer.MAX_VALUE, 6));
        bar.setPreferredSize(new Dimension(360, 6));
        bar.setBorderPainted(false);
        bar.setForeground(GOLD);
        bar.setBackground(MAT_RAISED);

        play = new Pill("Play", true);
        play.setEnabled(false);
        play.addActionListener(e -> {
            if (url != null) {
                Main.browse(url);
            }
        });
        retry = new Pill("Try again", false);
        retry.setVisible(false);
        retry.addActionListener(e -> {
            retry.setVisible(false);
            main.startAll();
        });
        Pill quit = new Pill("Quit", false);
        quit.addActionListener(e -> confirmQuit());
        JPanel buttons = row();
        buttons.add(play);
        buttons.add(Box.createHorizontalStrut(10));
        buttons.add(retry);
        buttons.add(Box.createHorizontalStrut(10));
        buttons.add(quit);

        lan = label(" ", 12f, Font.PLAIN, INK_DIM);
        lan.setVisible(false);
        lan.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));

        JCheckBox accountsBox = new JCheckBox("Player accounts (needed for Career)", accounts);
        accountsBox.setOpaque(false);
        accountsBox.setForeground(INK_DIM);
        accountsBox.setFont(accountsBox.getFont().deriveFont(12f));
        accountsBox.setAlignmentX(Component.LEFT_ALIGNMENT);
        accountsBox.setFocusPainted(false);
        accountsBox.setToolTipText("<html>On: players register with a name and a password, and Career is available.<br>"
                + "Off: anyone signs in with just a name.</html>");
        accountsBox.addActionListener(e -> {
            int answer = JOptionPane.showConfirmDialog(frame,
                    "Playmat restarts its game server to apply this.\nAnyone playing right now will be disconnected for a moment.",
                    "Restart the game server?", JOptionPane.OK_CANCEL_OPTION, JOptionPane.QUESTION_MESSAGE);
            if (answer == JOptionPane.OK_OPTION) {
                main.setAccounts(accountsBox.isSelected());
                play.setEnabled(false);
                main.restart();
            } else {
                accountsBox.setSelected(!accountsBox.isSelected());
            }
        });

        update = label(" ", 12f, Font.BOLD, GOLD);
        update.setVisible(false);
        update.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        update.addMouseListener(click(() -> Main.browse(Main.RELEASES)));

        JPanel links = row();
        links.add(link("Data folder", () -> Main.openFolder(main.dataFolder().toFile())));
        links.add(label("  ·  ", 12f, Font.PLAIN, INK_DIM));
        links.add(link("Log", () -> {
            Path log = main.logFile();
            Main.openFolder(log.toFile().exists() ? log.toFile() : new File(log.getParent().toString()));
        }));
        links.add(label("  ·  ", 12f, Font.PLAIN, INK_DIM));
        links.add(label("Version " + version, 12f, Font.PLAIN, INK_DIM));

        body.add(headline);
        body.add(Box.createVerticalStrut(4));
        body.add(detail);
        body.add(Box.createVerticalStrut(2));
        body.add(progress);
        body.add(Box.createVerticalStrut(12));
        body.add(bar);
        body.add(Box.createVerticalStrut(16));
        body.add(buttons);
        body.add(Box.createVerticalStrut(14));
        body.add(lan);
        body.add(update);
        body.add(Box.createVerticalStrut(10));
        body.add(accountsBox);
        body.add(Box.createVerticalStrut(4));
        body.add(links);
        root.add(body, BorderLayout.CENTER);

        frame.setContentPane(root);
        frame.setMinimumSize(new Dimension(560, 0));
        frame.pack();
        frame.setResizable(false);
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);
    }

    @Override
    public void starting(String headlineText, String detailText) {
        SwingUtilities.invokeLater(() -> {
            headline.setForeground(INK);
            headline.setText(headlineText);
            detail.setText(html(detailText.isEmpty() ? " " : detailText));
            progress.setText(" ");
            bar.setVisible(true);
            bar.setIndeterminate(true);
            play.setEnabled(false);
            retry.setVisible(false);
            frame.pack();
        });
    }

    @Override
    public void progress(String text) {
        SwingUtilities.invokeLater(() -> progress.setText(text));
    }

    @Override
    public void ready(String readyUrl, String lanUrl) {
        SwingUtilities.invokeLater(() -> {
            url = readyUrl;
            headline.setForeground(INK);
            headline.setText("Ready to play");
            detail.setText(html("Playmat opened in your browser. If it didn't, press Play. Keep this window open while you play."));
            progress.setText(readyUrl);
            bar.setVisible(false);
            play.setEnabled(true);
            retry.setVisible(false);
            if (lanUrl != null) {
                lan.setText("Friends on your network can join at " + lanUrl + "  (click to copy)");
                for (java.awt.event.MouseListener l : lan.getMouseListeners()) {
                    lan.removeMouseListener(l);
                }
                lan.addMouseListener(click(() -> {
                    Toolkit.getDefaultToolkit().getSystemClipboard().setContents(new StringSelection(lanUrl), null);
                    lan.setText("Copied " + lanUrl);
                }));
                lan.setVisible(true);
            }
            frame.pack();
        });
    }

    @Override
    public void failed(String headlineText, String detailText, boolean canRetry) {
        SwingUtilities.invokeLater(() -> {
            headline.setForeground(ERROR);
            headline.setText(headlineText);
            detail.setText(html(detailText));
            progress.setText(" ");
            bar.setVisible(false);
            play.setEnabled(false);
            retry.setVisible(canRetry);
            lan.setVisible(false);
            frame.pack();
            frame.toFront();
        });
    }

    @Override
    public void updateAvailable(String version, String releaseUrl) {
        SwingUtilities.invokeLater(() -> {
            update.setText("Playmat " + version + " is out: click to download it");
            update.setVisible(true);
            frame.pack();
        });
    }

    private void confirmQuit() {
        if (play.isEnabled()) {
            Object[] options = {"Quit Playmat", "Keep playing"};
            int answer = JOptionPane.showOptionDialog(frame,
                    "Quitting stops the game server. Games in progress end, for you and for anyone who joined you.",
                    "Quit Playmat?", JOptionPane.DEFAULT_OPTION, JOptionPane.QUESTION_MESSAGE, null, options, options[1]);
            if (answer != 0) {
                return;
            }
        }
        headline.setText("Stopping…");
        detail.setText(" ");
        progress.setText(" ");
        play.setEnabled(false);
        main.quit();
    }

    private static String html(String text) {
        String escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        return "<html><div style='width:340px'>" + escaped + "</div></html>";
    }

    private static JPanel column() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setOpaque(false);
        return panel;
    }

    private static JPanel row() {
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        panel.setOpaque(false);
        panel.setAlignmentX(Component.LEFT_ALIGNMENT);
        return panel;
    }

    private static JLabel label(String text, float size, int style, Color color) {
        JLabel label = new JLabel(text);
        label.setFont(label.getFont().deriveFont(style, size));
        label.setForeground(color);
        label.setAlignmentX(Component.LEFT_ALIGNMENT);
        return label;
    }

    private static JLabel link(String text, Runnable action) {
        JLabel label = label("<html><u>" + text + "</u></html>", 12f, Font.PLAIN, INK_DIM);
        label.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        label.addMouseListener(click(action));
        return label;
    }

    private static MouseAdapter click(Runnable action) {
        return new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                action.run();
            }
        };
    }

    /** The app icon at a few sizes, from the web client's own icons. */
    private List<Image> icons() {
        List<Image> list = new ArrayList<>();
        for (String name : new String[]{"icon-192.png", "icon-512.png"}) {
            try {
                BufferedImage image = ImageIO.read(main.webFolder().resolve(name).toFile());
                if (image != null) {
                    list.add(image);
                }
            } catch (Exception ignored) {
                // no icon: the window still works
            }
        }
        return list;
    }

    /** A rounded button that looks the same on every system. */
    private static final class Pill extends JButton {

        private static final long serialVersionUID = 1L;

        private final boolean primary;

        Pill(String text, boolean primary) {
            super(text);
            this.primary = primary;
            setFont(getFont().deriveFont(Font.BOLD, primary ? 15f : 13f));
            setForeground(primary ? GOLD_INK : INK);
            setContentAreaFilled(false);
            setBorderPainted(false);
            setFocusPainted(false);
            setOpaque(false);
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            setBorder(BorderFactory.createEmptyBorder(primary ? 10 : 9, primary ? 34 : 18, primary ? 10 : 9, primary ? 34 : 18));
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            Color fill = primary ? GOLD : MAT_RAISED;
            if (!isEnabled()) {
                fill = primary ? new Color(0x5a4a2a) : new Color(0x16221d);
            } else if (getModel().isPressed()) {
                fill = fill.darker();
            } else if (getModel().isRollover()) {
                fill = primary ? new Color(0xffc65a) : new Color(0x26392f);
            }
            g2.setColor(fill);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), 10, 10);
            g2.dispose();
            setForeground(isEnabled() ? (primary ? GOLD_INK : INK) : INK_DIM);
            super.paintComponent(g);
        }

        @Override
        public Dimension getMaximumSize() {
            return getPreferredSize();
        }
    }
}
