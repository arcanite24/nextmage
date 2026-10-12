# Performance harness

`perf.sh` starts a server from a local distribution and drives load through the WebSocket bridge with the headless bot client. While the load runs it samples CPU, memory and threads, and records JFR. Each run writes a folder under `ops/perf/results/` (git-ignored) holding `summary.json`, `report.txt` (CPU and allocation breakdown), the JFR recording, the server log and a class histogram.

It exists so every change on the performance track (backlog M16–M19) is measured the same way against the same baseline. The investigation behind the track: https://claude.ai/artifact/4m3WVSmX72ipEaoPucvsg8

## Running it

From `Mage.Web.Client` (or call `ops/perf/perf.sh` directly):

```bash
npm run perf -- dist          # build the server and unpack it into ops/perf/.dist, then do one cold start (about 5 min)
npm run perf -- startup       # 3 warm starts: seconds and CPU seconds to ready
npm run perf -- idle          # memory after a full GC, metaspace, native memory, 60 s of idle CPU
npm run perf -- ai            # 8 slots of AI-vs-AI tables for 2 minutes: CPU seconds per game, profile
npm run perf -- human         # 12 human-paced bots against the AI, 3 waves: CPU seconds per game, profile
npm run perf -- hold          # 16 games parked mid-game: live heap per held game
npm run perf -- compare ops/perf/results/<a> ops/perf/results/<b>
```

Run `dist` again after every server change. The distribution is a snapshot of the build, not of your working tree.

The harness uses ports 18171–18173, so it can run next to a dev server on 17171/17172. Replays follow the server default (on), as in production. Set `PERF_ADMIN_PASSWORD` to letters and digits only; the server strips anything else.

## Knobs

| Variable | Default | Meaning |
|---|---|---|
| `PERF_JVM` | `-Xmx2g` | JVM flags for the server, e.g. `"-Xmx384m -XX:+UseSerialGC -XX:ActiveProcessorCount=1"` |
| `PERF_SERVER_OPTS` | | Extra `-D` properties, e.g. `-Dxmage.replays=false` |
| `PERF_JFR` | `1` | `0` skips the JFR recording (it costs a few percent) |
| `PERF_RUNS`, `PERF_COLD` | `3`, `0` | `startup`: number of starts; `1` deletes the card database before each start |
| `PERF_IDLE_SEC` | `60` | `idle`: how long idle CPU is measured |
| `MAGE_PERF_CONC`, `MAGE_PERF_DURATION_MS`, `MAGE_PERF_SKILL` | `8`, `120000`, `1` | `ai` scenario |
| `MAGE_LOAD_GAMES`, `MAGE_LOAD_WAVES` | `12`, `3` | `human` scenario |
| `MAGE_PERF_N`, `MAGE_PERF_HOLD_TURN`, `MAGE_PERF_HOLD_MS` | `16`, `6`, `90000` | `hold` scenario |

To act like a small VPS on a big machine, cap the JVM's view of the hardware: `PERF_JVM="-Xmx384m -XX:ActiveProcessorCount=1"`. Then compare CPU seconds rather than wall-clock time, since the other cores still run the bots.

## Reading the results

- `cpuSecPerGame` in `summary.json` is the main CPU number. It's the server's CPU time during the load divided by the games finished. Wall-clock times are noisy on a busy laptop, but CPU seconds and profile shares hold steady.
- `profile.cpu` holds category shares from JFR. The first match wins, in this order: bridge state diffs, replay recording, AI search, playable highlighting, game views, message serialization, deck loading, card database, desktop transport, rules engine. `report.txt` lists the methods behind each one.
- `liveHeapMBPerHeldGame` (`hold`) is the memory a game holds while it waits for a player.
- `thinkTooLong` counts the AI's "thinks too long" warnings. When it climbs, the AI is running out of time rather than finishing its search.

## Baseline, 12 Oct 2026

Master 64ae4193 on a 12-core Mac with JDK 17, `-Xmx2g`, run by hand before this harness existed. Replays were off for these runs (`-Dxmage.replays=false`), so new runs with replays on will show somewhat more CPU per human game.

| Measure | Value |
|---|---|
| Warm start / cold start | 5.8–6.2 s (15 CPU-s) / 28–30 s (38 CPU-s) |
| Idle live heap after a full GC | 155–166 MB, of which about 113 MB is the H2 card-DB cache |
| Metaspace | 262–268 MB: 38,080 classes, 32,498 of them cards |
| Native memory committed at idle | 1,141 MB |
| Threads at idle | 80 (about 37 with one CPU) |
| Idle CPU | 0.9% of one core |
| Live heap per held 1v1 game | about 3.6 MB |
| CPU per game | 2.7 CPU-s human-paced bot vs AI; 0.91 CPU-s AI vs AI |
| Allocation rate under load | about 3 GB/s (about 3.2 GB per human-paced game) |
| Human game CPU profile | bridge state diffs 48%, AI search 14%, playable highlighting 14%, message serialization 12%, deck loading 7%, rules engine 2% |
| AI-vs-AI CPU profile | AI search 76% (`Game.copy` is 61% of all CPU), deck loading 16% |
| GC (CPU-s per AI game, 512 MB heap) | G1 1.54–1.69; Serial 1.15–1.23; C1-only JIT is about 50% worse |

The first harness runs, the same day with replays on as in production, put replay recording at 17% of human-game CPU. They measured bridge state diffs 35%, replay recording 17%, deck loading 13%, AI search 13%, message serialization 9% and playable highlighting 7%, at 4.9 CPU-s per game (6 games, a short run). AI-vs-AI ran at 1.2 CPU-s per game: AI search 73%, deck loading 21%.

## Results by milestone

### M16: sizing, prebuilt card database, class archive (12 Oct 2026)

The Docker image now builds its card database and records a class-data archive (`xmage.jsa`); the entrypoint sizes the heap to the machine and picks Serial GC on one or two CPUs. To run the harness the way a 1 GB VPS runs the image, record the archive in the distribution once and pass the same flags:

```bash
cd ops/perf/.dist && java -XX:ArchiveClassesAtExit=xmage.jsa -Dxmage.exitAfterStartup=true -Dxmage.healthPort=0 -jar lib/mage-server-*.jar
PERF_JVM="-Xmx400m -XX:+UseSerialGC -XX:ActiveProcessorCount=1 -XX:SharedArchiveFile=xmage.jsa -Xlog:cds=off -Xlog:cds+dynamic=off" npm run perf -- ai
```

| Measure | Before (`-Xmx2g`, G1) | After (400 MB, Serial, archive) |
|---|---|---|
| Start, CPU seconds (one processor) | 12.9 without the archive | 9.8 |
| First start of a new image | 28–30 s (card database rebuilt) | same as any start |
| Idle metaspace | 262 MB | 6 MB (the classes live in the shared archive) |
| Idle RSS | 1,004 MB | 540–790 MB on macOS, which counts the mapped archive |
| Idle CPU, after the first 90 s | 0.9–1.9% | 0.2% |
| 3 AI tables for 2 minutes: peak RSS | 1,466 MB | 867 MB |
| 3 AI tables: CPU seconds per game | 0.81 | 0.84 |

### M17: the web bridge and replays (12 Oct 2026)

State patches diff the trees the bridge already built (the last state is kept as a tree, so nothing is parsed back), and a patch goes out without writing the complete message unless it's a close call; prompts are written out only if they're sent again. Diffing and writing happen on a per-connection sender instead of the game thread. Replay snapshots are skipped while a cheap change key stays the same and are written straight to text. Decks that only name their cards reuse each name's preferred printing. `-Dxmage.remoting=false` (`XMAGE_DESKTOP=false`) leaves the desktop protocol off.

| Measure (`-Xmx2g`) | Before | After |
|---|---|---|
| Human game: bridge diffs + replay recording | 52% of CPU, 2.5 CPU-s per game | 8–9% of CPU, 0.3 CPU-s per game |
| Human game: everything but the AI and the rules | 4.0 CPU-s per game | 1.6 CPU-s per game |
| AI vs AI: deck loading | 21% of CPU | 1.3% |
| AI vs AI: CPU seconds per game | 1.17 | 0.98 |
| Live heap per held game | 3.25 MB | 3.75 MB (the state kept as a tree) |

Playable highlighting (two game copies per view) is now the largest cost after the AI; M18 takes it on.

### M18: the card database, playable highlighting, the AI's budgets, views and engine trims (12 Oct 2026)

Startup checks the card classes against one query of every set and number instead of a lookup per card, and the card database's cache follows the heap (`XMAGE_DB_CACHE`, else an eighth of the heap, 16–150 MB). The image ships its card database compacted (290 to 53 MB). Playable highlighting is computed once per game change and priority player, and mana checks reuse the copy the check already made. Each AI search counts its own nodes, and the budget follows the skill (2,000 nodes at skills 1–2, 3,500 at 3, 5,000 above; `XMAGE_AI_NODE_SCALE`). A search no longer starts when the player has nothing but mana abilities to play. The search threads follow the machine (`XMAGE_AI_THREADS`). The Monte Carlo AI shares one pool and can be left off (`XMAGE_MONTE_CARLO=false`), and the client then offers only the standard AI. Card views no longer copy the card, and computer sideboards are no longer sent to every viewer. A finished game drops its rollback states and last-known information. Watcher copies look up their class once, mana costs share their payment options until one changes, and card states aren't built just to be thrown away.

| Measure (`-Xmx2g`) | Before | After |
|---|---|---|
| Human game: CPU seconds per game | 3.51 | 1.44 |
| Human game: building views (with playables) | 1.24 CPU-s per game | 0.38 CPU-s per game |
| Human game: peak RSS | 2,399 MB | 1,367 MB |
| AI vs AI: CPU seconds per game | 0.98 | 0.52 |
| Live heap at idle | 155 MB | 59 MB (49 MB with a 16 MB card cache) |
| Live heap per held game | 3.75 MB | 2.81 MB |
| Live heap kept after 16 games end | 20 MB | 5 MB |
| Warm start | 5.9 s | 4.4 s |

Writing the views out as JSON trees (`serializeTree`, about 0.37 CPU-s per human game) is now the largest cost after the AI.
