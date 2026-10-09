package mage.server.websocket;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

import java.util.Iterator;
import java.util.Map;

/**
 * Web client bridge: the difference between two JSON trees, so a game update can be sent as a small patch.
 * <p>
 * A patch is an operation, one of:
 * <ul>
 * <li>{@code [value]}: the value is replaced by {@code value} (any JSON, null included)</li>
 * <li>{@code []}: the object key is removed</li>
 * <li>{@code {"key": operation, ...}}: an object changes key by key; keys without an operation keep their value,
 * new keys are added after the existing ones</li>
 * <li>{@code ["o", {"key": operation or 0, ...}]}: an object gets exactly the listed keys, in that order; 0 keeps
 * the old value (used when keys moved, e.g. a field that was left out because it was null is back)</li>
 * <li>{@code [length, {"index": operation, ...}]}: an array changes element by element, then is cut or grown to
 * {@code length}; elements past the old end are always set with {@code [value]}</li>
 * </ul>
 * Since an operation is always an array or an object, a patch never confuses "set to null" with "removed",
 * unlike RFC 7386 merge patches. Applying a patch keeps the order of object keys exactly as in the new tree.
 */
public final class StateDiff {

    private static final String ORDERED = "o";
    private static final int KEEP = 0;

    private StateDiff() {
    }

    /**
     * @return the operation that turns {@code from} into {@code to}, or null when they are equal
     */
    public static JsonElement diff(JsonElement from, JsonElement to) {
        if (from == null || to == null) {
            return set(to);
        }
        if (from.isJsonObject() && to.isJsonObject()) {
            return diffObjects(from.getAsJsonObject(), to.getAsJsonObject());
        }
        if (from.isJsonArray() && to.isJsonArray()) {
            return diffArrays(from.getAsJsonArray(), to.getAsJsonArray());
        }
        if (from.isJsonObject() || from.isJsonArray() || to.isJsonObject() || to.isJsonArray()) {
            return set(to);
        }
        // primitives and nulls: equal when they serialize the same (Gson numbers differ in class after parsing)
        return from.toString().equals(to.toString()) ? null : set(to);
    }

    private static JsonElement diffObjects(JsonObject from, JsonObject to) {
        if (!keepsKeyOrder(from, to)) {
            return diffReordered(from, to);
        }
        JsonObject patch = new JsonObject();
        for (Map.Entry<String, JsonElement> entry : from.entrySet()) {
            if (!to.has(entry.getKey())) {
                patch.add(entry.getKey(), new JsonArray());
            }
        }
        for (Map.Entry<String, JsonElement> entry : to.entrySet()) {
            JsonElement old = from.get(entry.getKey());
            JsonElement operation = old == null ? set(entry.getValue()) : diff(old, entry.getValue());
            if (operation != null) {
                patch.add(entry.getKey(), operation);
            }
        }
        return patch.size() == 0 ? null : patch;
    }

    private static JsonElement diffReordered(JsonObject from, JsonObject to) {
        JsonObject keys = new JsonObject();
        for (Map.Entry<String, JsonElement> entry : to.entrySet()) {
            JsonElement old = from.get(entry.getKey());
            JsonElement operation = old == null ? set(entry.getValue()) : diff(old, entry.getValue());
            keys.add(entry.getKey(), operation == null ? new JsonPrimitive(KEEP) : operation);
        }
        JsonArray operation = new JsonArray();
        operation.add(ORDERED);
        operation.add(keys);
        return operation;
    }

    /**
     * A patch keeps the remaining keys in place and adds new ones at the end: true when that gives {@code to}'s order.
     */
    private static boolean keepsKeyOrder(JsonObject from, JsonObject to) {
        Iterator<String> kept = from.keySet().stream().filter(to::has).iterator();
        boolean adding = false;
        for (String key : to.keySet()) {
            if (from.has(key)) {
                if (adding || !kept.hasNext() || !kept.next().equals(key)) {
                    return false;
                }
            } else {
                adding = true;
            }
        }
        return true;
    }

    private static JsonElement diffArrays(JsonArray from, JsonArray to) {
        JsonObject changes = new JsonObject();
        int common = Math.min(from.size(), to.size());
        boolean reused = false; // some old element is kept or patched
        for (int i = 0; i < common; i++) {
            JsonElement operation = diff(from.get(i), to.get(i));
            if (operation == null) {
                reused = true;
            } else {
                reused |= !isSet(operation);
                changes.add(Integer.toString(i), operation);
            }
        }
        if (changes.size() == 0 && from.size() == to.size()) {
            return null;
        }
        if (!reused) {
            return set(to); // nothing of the old array is left: the whole array is shorter
        }
        for (int i = common; i < to.size(); i++) {
            changes.add(Integer.toString(i), set(to.get(i)));
        }
        JsonArray operation = new JsonArray();
        operation.add(to.size());
        operation.add(changes);
        return operation;
    }

    private static JsonArray set(JsonElement value) {
        JsonArray operation = new JsonArray();
        operation.add(value == null ? JsonNull.INSTANCE : value);
        return operation;
    }

    /**
     * Applies a patch made by {@link #diff} to a copy of {@code from} (only used to check patches; clients apply them).
     *
     * @param operation null means no change
     * @throws IllegalArgumentException when the patch does not fit the tree
     */
    public static JsonElement apply(JsonElement from, JsonElement operation) {
        if (operation == null) {
            return from == null ? null : from.deepCopy();
        }
        if (operation.isJsonObject()) {
            if (from == null || !from.isJsonObject()) {
                throw new IllegalArgumentException("Object patch on " + describe(from));
            }
            JsonObject patch = operation.getAsJsonObject();
            JsonObject result = new JsonObject();
            for (Map.Entry<String, JsonElement> entry : from.getAsJsonObject().entrySet()) {
                JsonElement keyOperation = patch.get(entry.getKey());
                if (keyOperation == null) {
                    result.add(entry.getKey(), entry.getValue().deepCopy());
                } else if (!isRemove(keyOperation)) {
                    result.add(entry.getKey(), apply(entry.getValue(), keyOperation));
                }
            }
            for (Map.Entry<String, JsonElement> entry : patch.entrySet()) {
                if (!from.getAsJsonObject().has(entry.getKey())) {
                    if (isRemove(entry.getValue())) {
                        throw new IllegalArgumentException("Removes missing key " + entry.getKey());
                    }
                    result.add(entry.getKey(), apply(null, entry.getValue()));
                }
            }
            return result;
        }
        JsonArray array = operation.getAsJsonArray();
        if (array.size() == 1) {
            return array.get(0).deepCopy();
        }
        if (array.size() == 2 && array.get(0).isJsonPrimitive() && array.get(0).getAsJsonPrimitive().isString()) {
            if (!ORDERED.equals(array.get(0).getAsString()) || from == null || !from.isJsonObject()) {
                throw new IllegalArgumentException("Bad operation " + operation + " on " + describe(from));
            }
            JsonObject result = new JsonObject();
            for (Map.Entry<String, JsonElement> entry : array.get(1).getAsJsonObject().entrySet()) {
                JsonElement old = from.getAsJsonObject().get(entry.getKey());
                boolean keep = entry.getValue().isJsonPrimitive();
                if (keep && old == null) {
                    throw new IllegalArgumentException("Keeps missing key " + entry.getKey());
                }
                result.add(entry.getKey(), keep ? old.deepCopy() : apply(old, entry.getValue()));
            }
            return result;
        }
        if (array.size() != 2 || from == null || !from.isJsonArray()) {
            throw new IllegalArgumentException("Bad operation " + operation + " on " + describe(from));
        }
        int length = array.get(0).getAsInt();
        JsonObject changes = array.get(1).getAsJsonObject();
        JsonArray old = from.getAsJsonArray();
        JsonArray result = new JsonArray();
        for (int i = 0; i < length; i++) {
            JsonElement change = changes.get(Integer.toString(i));
            if (i < old.size()) {
                result.add(change == null ? old.get(i).deepCopy() : apply(old.get(i), change));
            } else if (change != null) {
                result.add(apply(null, change));
            } else {
                throw new IllegalArgumentException("Missing new element " + i);
            }
        }
        return result;
    }

    private static boolean isSet(JsonElement operation) {
        return operation.isJsonArray() && operation.getAsJsonArray().size() == 1;
    }

    private static boolean isRemove(JsonElement operation) {
        return operation.isJsonArray() && operation.getAsJsonArray().size() == 0;
    }

    private static String describe(JsonElement element) {
        return element == null ? "nothing" : element.isJsonObject() ? "an object" : element.isJsonArray() ? "an array" : "a value";
    }
}
