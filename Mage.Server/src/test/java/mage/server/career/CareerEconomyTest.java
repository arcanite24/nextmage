package mage.server.career;

import org.junit.jupiter.api.Test;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The Career economy model: simulates players and checks the numbers against the targets before players find the
 * grind. Target: a new pack every three or four wins, and steady progress for a player who loses more than they win.
 * Run it with -Dxmage.careerEconomyReport=true to print the table.
 */
public class CareerEconomyTest {

    /** a game against the AI, menus included */
    private static final double MINUTES_PER_GAME = 12;

    @Test
    public void everyTierPaysAPackInThreeOrFourWins() {
        for (int tier = 1; tier <= 3; tier++) {
            double winsPerPack = (double) CareerRules.PACK_PRICE / CareerRules.winCoins(tier);
            assertTrue(winsPerPack >= 2.8 && winsPerPack <= 4.0, "tier " + tier + " takes " + winsPerPack + " wins a pack");
        }
    }

    @Test
    public void simulatedPlayersProgressAtAHumanPace() {
        // win rates against each tier for a weak, an average and a strong player
        double[][] players = {{0.45, 0.30, 0.20}, {0.65, 0.50, 0.35}, {0.85, 0.70, 0.55}};
        String[] names = {"weak", "average", "strong"};
        StringBuilder report = new StringBuilder("player  tier  coins/hour  packs/hour  hours to tier 2\n");
        Random random = new Random(42);
        for (int p = 0; p < players.length; p++) {
            for (int tier = 1; tier <= 3; tier++) {
                double rate = players[p][tier - 1];
                int coins = 0;
                int games = 1000;
                for (int game = 0; game < games; game++) {
                    boolean won = random.nextDouble() < rate;
                    coins += CareerRules.reward(tier, won, 8).coins;
                }
                double coinsPerHour = coins / (games * MINUTES_PER_GAME / 60);
                double packsPerHour = coinsPerHour / CareerRules.PACK_PRICE;
                double hoursToNextTier = CareerRules.WINS_TO_UNLOCK_NEXT_TIER / players[p][0] * MINUTES_PER_GAME / 60;
                report.append(String.format("%-7s %4d  %10.0f  %10.2f  %15.1f%n", names[p], tier, coinsPerHour, packsPerHour, hoursToNextTier));
                // nobody waits more than two hours for a pack, and nobody opens more than two an hour
                assertTrue(packsPerHour >= 0.5 && packsPerHour <= 2.0, names[p] + " at tier " + tier + ": " + packsPerHour + " packs an hour");
            }
        }
        if (Boolean.getBoolean("xmage.careerEconomyReport")) {
            System.out.println(report);
        }
    }
}
