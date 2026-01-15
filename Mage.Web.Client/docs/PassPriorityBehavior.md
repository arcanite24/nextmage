# Pass Priority Behavior Analysis

## Java Client Default Behavior

### Skip Priority Steps Configuration

The Java client uses `UserSkipPrioritySteps` and `SkipPrioritySteps` classes to control when to automatically pass priority.

**Default Values** (from `SkipPrioritySteps.java`):
```java
boolean upkeep = false;        // SKIP upkeep (pass through)
boolean draw = false;          // SKIP draw (pass through)
boolean main1 = true;          // STOP on precombat main
boolean beforeCombat = false;  // SKIP begin combat
boolean endOfCombat = false;   // SKIP end combat
boolean main2 = true;          // STOP on postcombat main
boolean endOfTurn = false;     // SKIP end of turn
```

**⚠️ IMPORTANT CONVENTION**: In Java's SkipPrioritySteps:
- `true` = **STOP** (player receives priority)
- `false` = **SKIP** (automatically pass priority)

### How It Works

In `HumanPlayer.priority()` method (line 1156+):

1. **Check for quick stops** (e.g., when attacked before blockers)
2. **Check skip actions** (F4, F5, F7, F9):
   - `passedAllTurns` - F9: Pass until my next turn
   - `passedTurn` - Pass this turn
   - `passedUntilEndOfTurn` - F4: Pass until end of turn
   - `passedUntilNextMain` - F5: Pass until next main phase
   - `passedUntilStackResolved` - F7: Pass until stack resolves

3. **Check phase-specific skips** via `checkPassStep()`:
   - Looks at `UserSkipPrioritySteps.yourTurn` or `UserSkipPrioritySteps.opponentTurn`
   - Returns `!isPhaseStepSet(phaseStep)` - meaning if the phase is "set" (true), DON'T skip

### Default Behavior on Main Phases

**By default, the Java client STOPS on main phases** (`main1 = true`, `main2 = true`), meaning:
- ✅ Player gets priority on their main phases
- ✅ Can play lands, cast sorceries, etc.
- ✅ Won't auto-pass even if there are playable actions

This is the expected behavior for most players.

### Additional Skip Settings

From `UserSkipPrioritySteps.java`:
```java
boolean stopOnDeclareAttackers = true;
boolean stopOnDeclareBlockersWithZeroPermanents = false;
boolean stopOnDeclareBlockersWithAnyPermanents = true;
boolean stopOnAllMainPhases = true;  // Affects F5 behavior
boolean stopOnAllEndPhases = true;   // Affects F4 behavior
boolean stopOnStackNewObjects = true; // Affects F7 behavior
```

### Pass Priority After Actions

From `UserData.java`:
```java
boolean passPriorityCast = false;        // Auto-pass after casting spell
boolean passPriorityActivation = false;  // Auto-pass after activating ability
```

These control whether priority is automatically passed after you take an action.

## Web Client Current State

### Missing Features

1. ❌ No `UserSkipPrioritySteps` configuration
2. ❌ No phase-specific skip settings
3. ❌ No visual feedback for active skip actions
4. ❌ No "stop on all main phases" toggle for F5
5. ❌ No "stop on all end phases" toggle for F4

### Implemented Features

1. ✅ F2 - Pass Priority
2. ✅ F4 - Pass Until End of Turn
3. ✅ F5 - Pass Until Next Main
4. ✅ F7 - Pass Until Stack Resolved
5. ✅ F9 - Pass Until My Turn
6. ✅ ESC - Cancel all pass actions

## Recommendations

### High Priority

1. **Add visual feedback** for active skip actions (F4, F5, F7, F9)
   - Show which skip is currently active
   - Allow clicking to cancel

2. **Investigate auto-pass behavior**
   - Determine if web client is auto-passing on main phases
   - Ensure it matches Java client default (should STOP on main phases)

### Medium Priority

3. **Add phase-specific skip settings**
   - Allow users to configure which phases to stop on
   - Separate settings for "your turn" vs "opponent's turn"

4. **Add "stop on all main/end phases" toggles**
   - Modify F5 behavior with toggle
   - Modify F4 behavior with toggle

### Low Priority

5. **Add "pass priority after action" settings**
   - Auto-pass after casting spell
   - Auto-pass after activating ability

## Testing Checklist

- [ ] Verify web client stops on main phases by default
- [ ] Verify F5 (pass until next main) stops on YOUR main phase
- [ ] Verify F4 (pass until end of turn) stops on YOUR end step
- [ ] Verify F7 (pass until stack resolved) works correctly
- [ ] Verify F9 (pass until my turn) works correctly
- [ ] Verify ESC cancels all skip actions
- [ ] Test with playable lands in hand
- [ ] Test with instant-speed spells
- [ ] Test during opponent's turn
