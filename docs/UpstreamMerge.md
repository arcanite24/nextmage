# Monthly upstream merge

Merge `magefree/mage` master into the fork once a month. Small merges keep conflicts small.

Remotes: `origin` is magefree/mage (upstream, read-only for us: never push there or open PRs or issues on it). `fork` is arcanite24/nextmage (PRs go here).

## Recipe

```sh
git fetch origin && git fetch fork
git worktree add -b upstream-merge-YYYY-MM ../mage-upstream fork/master
cd ../mage-upstream
git merge --no-ff origin/master          # a real merge commit, never a rebase

# Use a private Maven repo if another build may run at the same time (both install 1.4.x jars)
cp -c -R ~/.m2/repository ~/.m2/repository-upstream
M="-Dmaven.repo.local=$HOME/.m2/repository-upstream"

mvn $M -T 1C -pl '!Mage.Client,!Mage.Server.Console,!Mage.Tests,!Mage.Verify,!Mage.Reports' clean install -DskipTests

# Bridge tests, the same command as .github/workflows/web-bridge.yml
mvn $M -pl Mage.Server test -Dtest='mage/server/websocket/**/*Test' \
  -Dsurefire.failIfNoSpecifiedTests=false -Dxmage.dataCollectors.printGameLogs=false \
  -Dlog4j.configuration=file:$PWD/.travis/log4j.properties
```

`WebClientApiDocsTest` fails if the merge changed the generated web protocol. Then regenerate with `mvn -pl Mage.Server test -Dtest=WebClientApiDocsTest -Dxmage.updateWebApiDocs=true`, commit the regenerated `Mage.Web.Client/src/protocol/generated`, and run `npm run typecheck` in `Mage.Web.Client`.

Push the branch to `fork` and open a PR against `master` on arcanite24/nextmage.

## Conflict policy

- The fork owns `Mage.Web.Client/`, `Mage.Server/src/{main,test}/java/mage/server/websocket/`, `ops/web/`, `.github/workflows/web-*.yml` and `docs/`. Keep ours.
- Upstream owns everything else. For engine, card and set conflicts, take upstream, unless the fork's side is one of the deliberate edits listed below. Then keep the fix on top of upstream's version.
- If upstream changed a constructor or method signature that the fork calls, change the fork's call site. Don't re-add the old signature.
- After every merge, `git diff origin/master...HEAD -- . ':!Mage.Web.Client' ':!Mage.Server/src/*/java/mage/server/websocket' ':!ops' ':!docs' ':!.github'` should show only the edits below. Add any new edit to this list.

## Fork edits outside the fork-owned paths

Each `upstream/*` branch is a local branch off `origin/master` with only that fix, ready to be pushed to a personal GitHub fork and offered upstream. Delete the fork-side edit once upstream merges it.

| File(s) | What it does | Upstream status |
|---|---|---|
| `Mage/.../game/match/MatchImpl.java` | Null guard: `cleanUp()` threw an NPE when a match ended before its first game started. | Candidate: `upstream/match-end-npe` |
| `Mage.Common/.../view/TournamentView.java` | Null guard: tournaments without `LimitedOptions` (constructed tournaments) threw an NPE. | Candidate: `upstream/tournament-view-npe` |
| `Mage.Server/.../record/UserStatsRepository.java` | The server keeps running with user stats disabled if sqlite can't load (`LinkageError`). | Candidate: `upstream/user-stats-optional` |
| `Mage/.../cards/decks/Deck.java` | Looks cards up by name when the set code or card number is missing. Imported web decks need this. | Candidate (weaker): `upstream/deck-load-by-name` |
| `Mage/.../cards/decks/CommanderBrackets.java` (new), `Mage.Client/.../BracketLegalityLabel.java` | Moves the bracket rules out of the Swing label so the server can use them. Upstream edits the label's card lists, so this is the most likely conflict. | Candidate: `upstream/commander-brackets-shared`. On conflict, apply upstream's list changes to `CommanderBrackets`. |
| `Mage/.../cards/repository/CardCriteria.java` | Extra fields read by the bridge's `CardSearchService` (text search, color match, format). | Fork-only. Could move into the bridge. |
| `Mage/.../players/net/UserData.java` | No-arg constructor for JSON deserialization. | Fork-only |
| `Mage.Common/.../view/{CardView,GameView}.java`, `.../callback/ClientCallback.java` | Extra view fields and callback serialization for the bridge. | Fork-only |
| `Mage.Server/{pom.xml,Main,MageServerImpl,Session,TableController,TableManager*,GameController,Tournament*,ConfigWrapper}`, `Config.xsd` | WebSocket bridge wiring and config. | Fork-only |
| `Mage.Client/.../ScryfallImageSupportTokens.java` | `getTokenLinks()` for the web client's image export. | Fork-only |

Dropped in 2026-10: the `BoostAllEffect(FilterCreaturePermanent)` and `TargetHasSubtypeCondition(SubType)` overloads. They restored signatures upstream had removed and were unused.
