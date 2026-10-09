package mage.server.social;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Web client: the ignore list a client hands over after login, enforced for chat and whispers.
 */
public class UserRelationsTest {

    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    @AfterEach
    public void forget() {
        UserRelations.forget(alice);
        UserRelations.forget(bob);
    }

    @Test
    public void ignoresByNameRegardlessOfCase() {
        UserRelations.setIgnored(alice, Arrays.asList("Troll", " spammer ", "", null));

        assertThat(UserRelations.ignores(alice, "troll")).isTrue();
        assertThat(UserRelations.ignores(alice, "SPAMMER")).isTrue();
        assertThat(UserRelations.ignores(alice, "Bob")).isFalse();
        assertThat(UserRelations.ignored(alice)).containsExactlyInAnyOrder("troll", "spammer");
        // lists are per user
        assertThat(UserRelations.ignores(bob, "Troll")).isFalse();
    }

    @Test
    public void aNewListReplacesTheOldOne() {
        UserRelations.setIgnored(alice, Collections.singletonList("Troll"));
        UserRelations.setIgnored(alice, Collections.singletonList("Spammer"));

        assertThat(UserRelations.ignores(alice, "Troll")).isFalse();
        assertThat(UserRelations.ignores(alice, "Spammer")).isTrue();

        UserRelations.setIgnored(alice, Collections.emptyList());
        assertThat(UserRelations.ignored(alice)).isEmpty();
    }

    @Test
    public void forgetsTheListWithTheUser() {
        UserRelations.setIgnored(alice, Collections.singletonList("Troll"));
        UserRelations.forget(alice);

        assertThat(UserRelations.ignores(alice, "Troll")).isFalse();
    }

    @Test
    public void keepsListsBounded() {
        List<String> names = new ArrayList<>();
        for (int i = 0; i < UserRelations.MAX_IGNORED + 50; i++) {
            names.add("player" + i);
        }
        UserRelations.setIgnored(alice, names);

        assertThat(UserRelations.ignored(alice)).hasSize(UserRelations.MAX_IGNORED);
    }

    @Test
    public void nullsAreHarmless() {
        UserRelations.setIgnored(null, Collections.singletonList("Troll"));
        UserRelations.setIgnored(alice, null);

        assertThat(UserRelations.ignores(null, "Troll")).isFalse();
        assertThat(UserRelations.ignores(alice, null)).isFalse();
    }
}
