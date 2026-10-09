package mage.server.moderation;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;

import static org.assertj.core.api.Assertions.assertThat;

public class ClientErrorsTest {

    private static ClientErrors fresh() throws Exception {
        Constructor<ClientErrors> constructor = ClientErrors.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }

    private static ClientErrors.ClientError error(String message) {
        ClientErrors.ClientError error = new ClientErrors.ClientError();
        error.message = message;
        error.path = "/game/1";
        error.source = "window";
        return error;
    }

    @Test
    void keepsNewestFirstAndCountsRepeats() throws Exception {
        ClientErrors errors = fresh();
        errors.report("1.2.3.4", "ana", error("first"), 1_000);
        errors.report("1.2.3.4", "ana", error("second"), 2_000);
        errors.report("1.2.3.4", "ana", error("second"), 3_000);

        assertThat(errors.recent(10)).extracting(e -> e.message).containsExactly("second", "first");
        assertThat(errors.recent(10).get(0).repeats).isEqualTo(1);
        assertThat(errors.recent(10).get(0).userName).isEqualTo("ana");
    }

    @Test
    void eachReporterHasABudgetPerMinute() throws Exception {
        ClientErrors errors = fresh();
        for (int i = 0; i < ClientErrors.PER_MINUTE; i++) {
            assertThat(errors.report("1.2.3.4", null, error("e" + i), 60_000 + i)).isTrue();
        }
        assertThat(errors.report("1.2.3.4", null, error("over"), 60_500)).isFalse();
        assertThat(errors.report("5.6.7.8", null, error("someone else"), 60_500)).isTrue();
        assertThat(errors.report("1.2.3.4", null, error("next minute"), 120_000)).isTrue();
    }

    @Test
    void clipsLongFields() throws Exception {
        ClientErrors errors = fresh();
        ClientErrors.ClientError error = error(new String(new char[2000]).replace('\0', 'x'));
        errors.report("1.2.3.4", null, error, 1);
        assertThat(errors.recent(1).get(0).message).hasSize(500);
    }
}
