package mage.interfaces.callback;

import mage.remote.traffic.ZippedObject;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Callback data is compressed only when it is java-serialized for a desktop client;
 * JSON clients read the raw data directly.
 */
public class ClientCallbackSerializationTest {

    @Test
    void rawDataIsAvailableWithoutSerialization() {
        ArrayList<String> data = new ArrayList<>(Arrays.asList("a", "b"));
        ClientCallback callback = new ClientCallback(ClientCallbackMethod.CHATMESSAGE, UUID.randomUUID(), data);

        callback.decompressData();

        assertThat(callback.getData()).isSameAs(data);
    }

    @Test
    void javaSerializationSendsCompressedDataThatDesktopClientsCanRead() throws Exception {
        UUID objectId = UUID.randomUUID();
        ClientCallback callback = new ClientCallback(ClientCallbackMethod.GAME_UPDATE, objectId,
                new ArrayList<>(Arrays.asList("x", "y", "z")));
        callback.setMessageId(42);

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(callback);
        }
        // the sender keeps raw data
        assertThat(callback.getData()).isInstanceOf(ArrayList.class);

        ClientCallback received;
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            received = (ClientCallback) in.readObject();
        }

        assertThat(received.getMethod()).isEqualTo(ClientCallbackMethod.GAME_UPDATE);
        assertThat(received.getObjectId()).isEqualTo(objectId);
        assertThat(received.getMessageId()).isEqualTo(42);
        assertThat(readRawField(received)).isInstanceOf(ZippedObject.class);

        received.decompressData();
        assertThat(received.getData()).isEqualTo(Arrays.asList("x", "y", "z"));
    }

    @Test
    void uncompressedCallbacksStayUncompressed() throws Exception {
        ClientCallback callback = new ClientCallback(ClientCallbackMethod.CHATMESSAGE, null, "hello", false);

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(callback);
        }
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            assertThat(((ClientCallback) in.readObject()).getData()).isEqualTo("hello");
        }
    }

    private static Object readRawField(ClientCallback callback) throws Exception {
        java.lang.reflect.Field field = ClientCallback.class.getDeclaredField("data");
        field.setAccessible(true);
        return field.get(callback);
    }
}
