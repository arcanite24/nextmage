package club.multivac.playmat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;

/** The page's handle on the picture store (src/core/images/nativePictures.ts). */
@CapacitorPlugin(name = "PictureCache")
public class PictureCachePlugin extends Plugin {

    /** Downloads the given picture links in the background; resolves at once. */
    @PluginMethod
    public void prefetch(PluginCall call) {
        JSArray urls = call.getArray("urls", new JSArray());
        List<String> list = new ArrayList<>();
        try {
            list.addAll(urls.<String>toList());
        } catch (JSONException e) {
            call.reject("urls must be a list of strings");
            return;
        }
        PictureCache.get(getContext()).prefetch(list);
        call.resolve();
    }

    @PluginMethod
    public void stats(PluginCall call) {
        long[] stats = PictureCache.get(getContext()).stats();
        JSObject result = new JSObject();
        result.put("files", stats[0]);
        result.put("bytes", stats[1]);
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getBridge().execute(() -> {
            PictureCache.get(getContext()).clear();
            call.resolve();
        });
    }
}
