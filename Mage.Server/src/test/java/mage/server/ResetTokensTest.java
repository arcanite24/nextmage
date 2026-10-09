package mage.server;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

public class ResetTokensTest {

    @Test
    void aCodeWorksOnceForItsEmail() {
        ResetTokens tokens = new ResetTokens();
        String code = tokens.issue("Ana@Example.com", 0);
        assertThat(code).matches("\\d{6}");
        assertThat(tokens.redeem("bob@example.com", code, 1)).isFalse();
        assertThat(tokens.redeem("ana@example.com ", code, 1)).as("email case and spaces don't matter").isTrue();
        assertThat(tokens.redeem("ana@example.com", code, 2)).as("used up").isFalse();
    }

    @Test
    void expires() {
        ResetTokens tokens = new ResetTokens();
        String code = tokens.issue("ana@example.com", 0);
        assertThat(tokens.redeem("ana@example.com", code, ResetTokens.VALID_MILLIS + 1)).isFalse();
    }

    @Test
    void wrongGuessesUseItUp() {
        ResetTokens tokens = new ResetTokens();
        String code = tokens.issue("ana@example.com", 0);
        String wrong = code.equals("000000") ? "000001" : "000000";
        for (int i = 0; i < ResetTokens.ATTEMPTS; i++) {
            assertThat(tokens.redeem("ana@example.com", wrong, 1)).isFalse();
        }
        assertThat(tokens.redeem("ana@example.com", code, 1)).as("too many wrong guesses").isFalse();
    }

    @Test
    void aNewCodeReplacesTheOldOne() {
        ResetTokens tokens = new ResetTokens();
        String first = tokens.issue("ana@example.com", 0);
        String second = tokens.issue("ana@example.com", 1);
        if (!first.equals(second)) {
            assertThat(tokens.redeem("ana@example.com", first, 2)).isFalse();
        }
        assertThat(tokens.redeem("ana@example.com", second, 3)).isTrue();
    }
}
