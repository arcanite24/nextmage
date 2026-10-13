# Patches for upstream (magefree/mage)

The fork's performance work that isn't specific to Playmat, cut against upstream `master` at `afab346e06`
(12 Oct 2026). Each patch is one change that stands alone. They apply in order with `git am` and compile.
Sent so far (13 Oct 2026): 0001 as magefree/mage#16472, 0003 as #16473, 0004 as #16474 and 0005 as #16475, the small
engine fixes. The rest wait until those are reviewed.

| Patch | Change | Measured in the fork |
|---|---|---|
| 0001 | The card scanner checks cards against one set-and-number query, not one lookup per card | startup made 94,000 queries (37 s on a 1-CPU container); now 0.2 s on a laptop |
| 0002 | Sets name their cards by class name (a build step rewrites the class literals), so card classes load on first use | idle metaspace 262 to 30 MB, idle RSS 628 to 345 MB |
| 0003 | `GameState.getCardState` no longer builds a `CardState` on every call | 1% of AI allocations |
| 0004 | `Watcher.copy` looks each class's constructor and fields up once | 2% of AI CPU |
| 0005 | Mana cost copies share their payment options until one changes them | up to 16% of AI CPU was `ManaOptions.copy` |
| 0006 | `getManaAvailable` reuses the playable check's game copy | part of playable highlighting, 21% to 13% |
| 0007 | `CardView` copies only spells, not every card it shows | view building 1.24 to 0.38 CPU-s per game (with 0006) |
| 0008 | A finished game drops its rollback states and last known information | live heap kept after 16 games 20 to 5 MB |
| 0009 | AI: a node counter per search (it was static, shared by every search), think time from the search's start, no search when only mana abilities are playable | AI vs AI 0.98 to 0.52 CPU-s per game (with 0005) |
| 0010 | Monte Carlo AI: one shared pool instead of a pool per player that never shuts down | no more leaked threads per AI seat |

Upstream's own tests (Mage.Tests, 6,948) pass in the fork with all of these. The fork-only parts stay out: the AI
budgets per skill, the web bridge, the Docker sizing.

To check them against a newer upstream:

```sh
git worktree add --detach /tmp/upstream origin/master
cd /tmp/upstream && git am /path/to/ops/perf/upstream/*.patch
```
