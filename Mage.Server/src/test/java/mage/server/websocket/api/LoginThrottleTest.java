package mage.server.websocket.api;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

public class LoginThrottleTest {

    @Test
    void failuresLockTheAddressOutExponentially() {
        AtomicLong now = new AtomicLong(1_000_000);
        LoginThrottle throttle = new LoginThrottle(now::get);

        assertThat(throttle.tryBegin("ip")).isZero();
        throttle.recordFailure("ip");
        assertThat(throttle.tryBegin("ip")).isEqualTo(1000);
        assertThat(throttle.tryBegin("other")).isZero();

        now.addAndGet(1000);
        assertThat(throttle.tryBegin("ip")).isZero();
        throttle.recordFailure("ip");
        assertThat(throttle.tryBegin("ip")).isEqualTo(2000);

        for (int i = 0; i < 30; i++) {
            now.addAndGet(LoginThrottle.MAX_LOCK_MILLIS);
            assertThat(throttle.tryBegin("ip")).isZero();
            throttle.recordFailure("ip");
        }
        assertThat(throttle.tryBegin("ip")).isEqualTo(LoginThrottle.MAX_LOCK_MILLIS);

        now.addAndGet(LoginThrottle.MAX_LOCK_MILLIS);
        assertThat(throttle.tryBegin("ip")).isZero();
        throttle.recordSuccess("ip");
        assertThat(throttle.tryBegin("ip")).isZero();
    }

    @Test
    void parallelAttemptsFromOneAddressAreRefused() {
        AtomicLong now = new AtomicLong(5_000);
        LoginThrottle throttle = new LoginThrottle(now::get);
        assertThat(throttle.tryBegin("ip")).isZero();
        assertThat(throttle.tryBegin("ip")).isPositive();
        throttle.recordSuccess("ip");
        assertThat(throttle.tryBegin("ip")).isZero();
    }
}
