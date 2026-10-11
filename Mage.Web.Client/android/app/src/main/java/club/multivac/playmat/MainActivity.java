package club.multivac.playmat;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * The Playmat web client in a native shell: full screen (the system bars come back on a swipe and hide again), the
 * screen kept awake through a game, card pictures kept on the device, and the WebView tuned for a page that animates
 * a lot.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PictureCachePlugin.class);
        super.onCreate(savedInstanceState);
        // card pictures come from the device's own store (PictureCache) before the network
        getBridge().setWebViewClient(new PlaymatWebViewClient(getBridge()));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        // card pictures are served immutable for 30 days: use the HTTP cache without revalidating
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // raster the page ahead of scrolling and animation (more memory, smoother frames)
        settings.setOffscreenPreRaster(true);
        // the app owns the gestures; no overscroll glow at the mat's edges
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // dialogs, the keyboard and the app switcher bring the bars back; hide them again on return
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
