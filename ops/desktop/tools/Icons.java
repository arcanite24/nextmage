import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * Makes the installers' icons from the web client's 512px app icon, with no tools beyond a JDK:
 *
 * <pre>
 *   java ops/desktop/tools/Icons.java ico     icon-512.png playmat.ico       (Windows)
 *   java ops/desktop/tools/Icons.java iconset icon-512.png Playmat.iconset   (macOS: iconutil -c icns Playmat.iconset)
 *   java ops/desktop/tools/Icons.java png     icon-512.png playmat.png 256   (Linux menu entry)
 * </pre>
 */
public class Icons {

    public static void main(String[] args) throws IOException {
        if (args.length < 3) {
            throw new IllegalArgumentException("usage: Icons ico|iconset|png <source.png> <target> [size]");
        }
        BufferedImage source = ImageIO.read(new File(args[1]));
        if (source == null) {
            throw new IOException("not an image: " + args[1]);
        }
        Path target = Paths.get(args[2]);
        switch (args[0]) {
            case "ico":
                writeIco(source, target);
                break;
            case "iconset":
                Files.createDirectories(target);
                for (int size : new int[]{16, 32, 128, 256, 512}) {
                    ImageIO.write(scale(source, size), "png", target.resolve("icon_" + size + "x" + size + ".png").toFile());
                    ImageIO.write(scale(source, size * 2), "png", target.resolve("icon_" + size + "x" + size + "@2x.png").toFile());
                }
                break;
            case "png":
                ImageIO.write(scale(source, args.length > 3 ? Integer.parseInt(args[3]) : 256), "png", target.toFile());
                break;
            default:
                throw new IllegalArgumentException("unknown kind " + args[0]);
        }
    }

    /** An .ico holding PNG images (Windows Vista and later read those) at the sizes Explorer asks for. */
    private static void writeIco(BufferedImage source, Path target) throws IOException {
        int[] sizes = {16, 24, 32, 48, 64, 128, 256};
        List<byte[]> images = new ArrayList<>();
        for (int size : sizes) {
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            ImageIO.write(scale(source, size), "png", png);
            images.add(png.toByteArray());
        }
        int headerSize = 6 + 16 * sizes.length;
        int total = headerSize;
        for (byte[] image : images) {
            total += image.length;
        }
        ByteBuffer out = ByteBuffer.allocate(total).order(ByteOrder.LITTLE_ENDIAN);
        out.putShort((short) 0).putShort((short) 1).putShort((short) sizes.length);
        int offset = headerSize;
        for (int i = 0; i < sizes.length; i++) {
            int size = sizes[i];
            out.put((byte) (size >= 256 ? 0 : size)).put((byte) (size >= 256 ? 0 : size));
            out.put((byte) 0).put((byte) 0);
            out.putShort((short) 1).putShort((short) 32);
            out.putInt(images.get(i).length).putInt(offset);
            offset += images.get(i).length;
        }
        for (byte[] image : images) {
            out.put(image);
        }
        Files.write(target, out.array());
    }

    /** Halves the image step by step down to the size, which keeps small icons sharp. */
    private static BufferedImage scale(BufferedImage source, int size) {
        BufferedImage current = source;
        while (current.getWidth() / 2 >= size) {
            current = draw(current, current.getWidth() / 2);
        }
        return current.getWidth() == size ? current : draw(current, size);
    }

    private static BufferedImage draw(BufferedImage source, int size) {
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.drawImage(source, 0, 0, size, size, null);
        g.dispose();
        return out;
    }
}
