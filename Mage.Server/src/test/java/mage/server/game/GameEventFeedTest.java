package mage.server.game;

import mage.view.GameEventView;
import mage.view.GameEventView.GameEventKind;
import org.junit.After;
import org.junit.Assert;
import org.junit.Test;

import java.util.List;
import java.util.UUID;

public class GameEventFeedTest {

    private final UUID gameId = UUID.randomUUID();

    @After
    public void closeFeed() {
        GameEventFeed.close(gameId);
    }

    @Test
    public void sessionsReadOnlyNewerEvents() {
        GameEventFeed feed = GameEventFeed.open(gameId);
        feed.add(new GameEventView(feed.nextSeq(), GameEventKind.TAP), null);
        long joinedAt = feed.lastSeq();
        feed.add(new GameEventView(feed.nextSeq(), GameEventKind.DAMAGE).amount(3), null);

        List<GameEventView> late = feed.since(joinedAt, null);
        Assert.assertEquals(1, late.size());
        Assert.assertEquals(GameEventKind.DAMAGE, late.get(0).getKind());
        Assert.assertEquals(3, late.get(0).getAmount());
        Assert.assertEquals(2, feed.since(0, null).size());
        Assert.assertSame(feed, GameEventFeed.of(gameId));
    }

    @Test
    public void privateCardsStayWithTheirOwner() {
        GameEventFeed feed = GameEventFeed.open(gameId);
        UUID owner = UUID.randomUUID();
        UUID card = UUID.randomUUID();
        feed.add(new GameEventView(feed.nextSeq(), GameEventKind.DRAW).target(card, "Lightning Bolt").player(owner), owner);

        GameEventView mine = feed.since(0, owner).get(0);
        Assert.assertEquals(card, mine.getTargetId());
        Assert.assertEquals("Lightning Bolt", mine.getTargetName());

        GameEventView theirs = feed.since(0, UUID.randomUUID()).get(0);
        Assert.assertNull(theirs.getTargetId());
        Assert.assertNull(theirs.getTargetName());
        Assert.assertEquals(owner, theirs.getPlayerId());
        Assert.assertNull("spectators see no private card", feed.since(0, null).get(0).getTargetName());
    }

    @Test
    public void oldEventsAreDropped() {
        GameEventFeed feed = GameEventFeed.open(gameId);
        for (int i = 0; i < GameEventFeed.CAPACITY + 10; i++) {
            feed.add(new GameEventView(feed.nextSeq(), GameEventKind.UNTAP), null);
        }
        List<GameEventView> all = feed.since(0, null);
        Assert.assertEquals(GameEventFeed.CAPACITY, all.size());
        Assert.assertEquals(11, all.get(0).getSeq());
    }

    @Test
    public void closedGamesHaveNoFeed() {
        GameEventFeed.open(gameId);
        GameEventFeed.close(gameId);
        Assert.assertNull(GameEventFeed.of(gameId));
    }
}
