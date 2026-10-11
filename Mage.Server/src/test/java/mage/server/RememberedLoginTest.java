package mage.server;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Keep me signed in": a remembered device's token signs in only its own user, and stops working when the device
 * signs out or the password changes.
 */
public class RememberedLoginTest {

    private AuthorizedUserRepository repository;

    @BeforeEach
    void setUp() {
        repository = new AuthorizedUserRepository("jdbc:h2:mem:remembered-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        repository.add("alice", "secret", "alice@example.test");
        repository.add("bob", "hunter2", "bob@example.test");
    }

    @Test
    void tokenSignsInOnlyItsOwnUser() {
        String token = repository.rememberLogin("alice");

        assertThat(token).hasSize(64);
        assertThat(repository.isRememberedLogin("alice", token)).isTrue();
        assertThat(repository.isRememberedLogin("bob", token)).isFalse();
        assertThat(repository.isRememberedLogin("alice", token + "0")).isFalse();
        assertThat(repository.isRememberedLogin("alice", "")).isFalse();
        assertThat(repository.isRememberedLogin("alice", null)).isFalse();
    }

    @Test
    void signingOutForgetsOnlyThatDevice() {
        String phone = repository.rememberLogin("alice");
        String laptop = repository.rememberLogin("alice");

        repository.forgetLogin("bob", phone);
        assertThat(repository.isRememberedLogin("alice", phone)).as("only its own user can forget it").isTrue();

        repository.forgetLogin("alice", phone);
        assertThat(repository.isRememberedLogin("alice", phone)).isFalse();
        assertThat(repository.isRememberedLogin("alice", laptop)).isTrue();
    }

    @Test
    void newPasswordForgetsEveryDevice() {
        String token = repository.rememberLogin("alice");
        String bobs = repository.rememberLogin("bob");

        repository.changePassword("alice", "new secret");

        assertThat(repository.isRememberedLogin("alice", token)).isFalse();
        assertThat(repository.isRememberedLogin("bob", bobs)).isTrue();
    }

    @Test
    void keepsTheNewestTenDevices() throws InterruptedException {
        String first = repository.rememberLogin("alice");
        String last = null;
        for (int i = 0; i < 10; i++) {
            Thread.sleep(2); // newest by last use, kept to the millisecond
            last = repository.rememberLogin("alice");
        }

        assertThat(repository.isRememberedLogin("alice", last)).isTrue();
        assertThat(repository.isRememberedLogin("alice", first)).isFalse();
    }
}
