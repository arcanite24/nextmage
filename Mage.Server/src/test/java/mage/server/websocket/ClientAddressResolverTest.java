package mage.server.websocket;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class ClientAddressResolverTest {

    private final ClientAddressResolver behindProxy = new ClientAddressResolver("127.0.0.1, ::1, 172.16.0.0/12");

    @Test
    void withoutTrustedProxiesTheHeadersAreIgnored() {
        ClientAddressResolver direct = new ClientAddressResolver("");
        assertThat(direct.hasTrustedProxies()).isFalse();
        assertThat(direct.resolve("172.18.0.2", "6.6.6.6", "7.7.7.7")).isEqualTo("172.18.0.2");
    }

    @Test
    void untrustedPeerCannotSpoofItsAddress() {
        assertThat(behindProxy.resolve("198.51.100.7", "1.2.3.4", "5.6.7.8")).isEqualTo("198.51.100.7");
    }

    @Test
    void rightMostUntrustedForwardedAddressIsTheClient() {
        // the client sent a fake X-Forwarded-For; the proxy appended the real address
        assertThat(behindProxy.resolve("172.18.0.2", "6.6.6.6, 203.0.113.5", null)).isEqualTo("203.0.113.5");
        // chained trusted proxies are skipped
        assertThat(behindProxy.resolve("127.0.0.1", "203.0.113.5, 172.20.1.1", null)).isEqualTo("203.0.113.5");
        assertThat(behindProxy.resolve("172.18.0.2", " 203.0.113.5 ", "9.9.9.9")).isEqualTo("203.0.113.5");
    }

    @Test
    void realIpIsUsedWithoutForwardedFor() {
        assertThat(behindProxy.resolve("172.18.0.2", null, "203.0.113.5")).isEqualTo("203.0.113.5");
        assertThat(behindProxy.resolve("172.18.0.2", "", "not an ip")).isEqualTo("172.18.0.2");
    }

    @Test
    void garbageInTheChainStopsAtTheLastTrustedHop() {
        assertThat(behindProxy.resolve("172.18.0.2", "203.0.113.5, evil.example.com", null)).isEqualTo("172.18.0.2");
        assertThat(behindProxy.resolve("172.18.0.2", "203.0.113.5, 999.1.1.1", null)).isEqualTo("172.18.0.2");
        assertThat(behindProxy.resolve("172.18.0.2", "unknown", null)).isEqualTo("172.18.0.2");
    }

    @Test
    void allTrustedChainYieldsTheLeftMostHop() {
        assertThat(behindProxy.resolve("127.0.0.1", "172.17.0.1, 172.18.0.1", null)).isEqualTo("172.17.0.1");
    }

    @Test
    void ipv6AndPortsAreUnderstood() {
        assertThat(behindProxy.resolve("::1", "[2001:db8::1]:4711", null)).isEqualTo("2001:db8:0:0:0:0:0:1");
        assertThat(behindProxy.resolve("0:0:0:0:0:0:0:1", "2001:db8::2", null)).isEqualTo("2001:db8:0:0:0:0:0:2");
        assertThat(behindProxy.resolve("127.0.0.1", "203.0.113.5:5555", null)).isEqualTo("203.0.113.5");
        // IPv4-mapped IPv6 peer of a trusted IPv4 proxy
        assertThat(behindProxy.resolve("::ffff:172.18.0.2", "203.0.113.5", null)).isEqualTo("203.0.113.5");
    }

    @Test
    void parsingNeverResolvesHostNames() {
        assertThat(ClientAddressResolver.parseAddress("localhost")).isNull();
        assertThat(ClientAddressResolver.parseAddress("example.com")).isNull();
        assertThat(ClientAddressResolver.parseAddress("1.2.3")).isNull();
        assertThat(ClientAddressResolver.parseAddress("")).isNull();
    }

    @Test
    void cidrRanges() {
        ClientAddressResolver resolver = new ClientAddressResolver("10.1.2.0/23,fd00::/8");
        assertThat(resolver.isTrusted(ClientAddressResolver.parseAddress("10.1.3.255"))).isTrue();
        assertThat(resolver.isTrusted(ClientAddressResolver.parseAddress("10.1.4.0"))).isFalse();
        assertThat(resolver.isTrusted(ClientAddressResolver.parseAddress("fd12::1"))).isTrue();
        assertThat(resolver.isTrusted(ClientAddressResolver.parseAddress("fe80::1"))).isFalse();
        assertThat(new ClientAddressResolver("0.0.0.0/0").isTrusted(ClientAddressResolver.parseAddress("8.8.8.8"))).isTrue();
        assertThatThrownBy(() -> new ClientAddressResolver("proxy.local")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ClientAddressResolver("10.0.0.0/33")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void connectionLimiterCountsPerAddress() {
        ConnectionLimiter limiter = new ConnectionLimiter(2);
        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isFalse();
        assertThat(limiter.tryAcquire("b")).isTrue();
        limiter.release("a");
        assertThat(limiter.tryAcquire("a")).isTrue();
        limiter.release("a");
        limiter.release("a");
        assertThat(limiter.openConnections("a")).isZero();
        assertThat(new ConnectionLimiter(0).tryAcquire("a")).isTrue();
    }
}
