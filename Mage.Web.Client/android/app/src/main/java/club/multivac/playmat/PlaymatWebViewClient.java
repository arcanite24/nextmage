package club.multivac.playmat;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/** Capacitor's client, with card pictures answered from the device's picture store first. */
public class PlaymatWebViewClient extends BridgeWebViewClient {

    private final PictureCache pictures;

    public PlaymatWebViewClient(Bridge bridge) {
        super(bridge);
        pictures = PictureCache.get(bridge.getContext());
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (PictureCache.handles(request)) {
            WebResourceResponse stored = pictures.respond(request);
            if (stored != null) return stored;
        }
        return super.shouldInterceptRequest(view, request);
    }
}
