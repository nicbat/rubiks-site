# Multi-event account and recovery rollout checklist

This checklist covers the remaining account/storage release work after the
`?trainingV2=1` development integration. It is not permission to deploy or enable
production writers. See [the feature plan](multi-event-timer.md),
[shared contracts](cube-engine-contracts.md), and [verification instructions](../testing.md).

## Required release order

1. Deploy the compatible snapshot migration and projections before enabling any
   production v2 writer. Verify direct table updates and the snapshot RPC both
   reject v2→v1 downgrades. Preserve snapshot payloads and revisions during summary
   backfill. Existing isolated SQL/API tests are evidence for the implementation,
   not evidence that a hosted environment has been migrated.
2. Complete the signed-in browser cases below against an isolated backend, with
   approved browser verification. The guest development-worker suite does not
   establish authentication, account switching, or cloud recovery correctness.
3. Provide explicit recovery/export controls for retained legacy originals,
   current legacy bytes, current v2 data, and unsaved in-memory drafts. Resolve
   conflicting copies before re-enabling writes; never clear data merely to make
   a migration succeed.
4. Confirm storage-capacity and missing-Web-Locks behavior on supported browsers.
   Then enable recording through an explicit rollout change. Rollback must retain
   v2 readers, exports, and server downgrade guards; it must not resume v1 writes
   in an adopted scope.

## Finite signed-in regression cases

These are remaining integration assertions, not claims that each underlying
module lacks tests. Use controlled locks/network responses and observable waits.

- [ ] **Initial authentication race:** delay the guest migration lock, authenticate
      account A, then release the lock. Only A may publish readiness or start account
      sync. Repeat with a null initial session and confirm the guest opens normally.
- [ ] **Account changes during commit:** queue a finished solve in A, sign out or
      switch to B before its lock runs, then release it. B must retain its own payload,
      equipment selection, notice and checkpoint. Returning to A must expose its
      saved copy or retained draft without manufacturing a successful save.
- [ ] **Sandbox transitions:** enter and leave demo mode while an account read or
      local open is pending. No demo payload may reach account storage or the remote.
      Leaving demo must open the real scope exactly once and restore auth behavior.
- [ ] **First account hydration:** a truly pristine v2 account receives cloud v1
      history and performs one schema-only CAS. An account containing only selected
      lessons, equipment or reviewed lessons must not be treated as pristine.
- [ ] **Guest transfer with mixed versions:** merge a legacy guest into v2 account
      data, and a native-v2 guest into an account upgraded from v1. Preserve event,
      grip, generator, local dates and equipment references; do not change guest bytes.
      A repeated transfer must not duplicate records.
- [ ] **Guest recovery journal:** a guest with no v2 envelope and a pending v1
      restore journal must refuse transfer before reading partial training fields.
      Keep the account, guest bytes and journal unchanged. The new read-only helper
      has domain regressions; verify the signed-in error/retry presentation as well.
- [ ] **Guest mutation while comparing:** an older tab editing guest storage, or
      another tab publishing its v2 envelope, must not cause fallback to an unchecked
      legacy snapshot. Refresh the comparison before a retry; retain both copies.
- [ ] **Remote commit followed by local failure:** force quota failure after a
      successful upload but before local replacement/checkpoint acknowledgement.
      Retry must preserve remote additions and local deletions rather than using the
      unseen remote result as an acknowledged local baseline.
- [ ] **Cloud replacement scope cancellation:** authenticate another account while
      an asynchronous replacement is waiting for its local lock. Neither its payload
      nor its checkpoint/status may be published into the new account.
- [ ] **Normal v2 tab conflict:** tab A saves while tab B has a stopped timer or
      notes draft. B must refuse stale writes and retain its draft/export. Reloading
      an otherwise clean B adopts A's data without changing legacy originals.
- [ ] **Older-client conflict:** edit each retained v1 key from an older tab,
      including its sync checkpoint or restore journal. V2 recording/sync must stop;
      reloading alone must not silently choose one copy or overwrite either source.
- [ ] **Removed development flag / rollback:** reopen an adopted account without
      the flag. Legacy writers and legacy sync remain blocked. Export must return the
      saved v2 training data, not an apparently current v1 projection.

## Checkpoint invariants already covered in domain tests

`tests/cloud-sync-v2.test.js` and `tests/training-schema.test.js` cover original
v1 fingerprint verification before normalization, schema-only CAS, tampered
baselines, delayed replacement, and gates closing during an upload. Keep these
assertions while adding the signed-in cases above:

- `last-layer.sync.v1` remains byte-for-byte untouched; v2 acknowledgements use
  `last-layer.sync.v2` within the same account namespace.
- If the v2 checkpoint is absent, a valid original v1 baseline can be verified and
  normalized. An invalid or tampered checkpoint must never authorize an implicit
  destructive merge. Distinct copies without a trustworthy baseline need a choice.
- A stale CAS does not advance either local checkpoint. Cancellation prevents
  acknowledgement into a different scope. A successful remote write alone is not
  evidence that a local replacement committed.

## Recovery work still needed

The current `storage` listener stops sync and shows a notice; it does not reconcile
sources. `createTrainingV2Store.inspect()` exposes the committed payload, immutable
legacy originals, current legacy bytes and changed-key list, but the app does not
provide a complete user-facing comparison/export workflow for all of them.

- [ ] Add a recovery view that exports each available source independently,
      including malformed raw bytes when parsing fails. Label the source and scope;
      do not export account A through account B's current state.
- [ ] Define a reviewed reconciliation operation under the same scope lock. It
      must check the exact copies the user reviewed before publishing a resolution;
      a new intervening write invalidates that choice. Retain the pre-resolution
      originals and show any unresolved duplicate IDs/metadata conflicts.
- [ ] Recover pending legacy journals through an explicit safe path before
      migration. The read-only transfer helper deliberately rejects such journals
      rather than invoking legacy recovery without coordination.
- [ ] Test quota exhaustion with retained old keys plus the full envelope and
      checkpoint. Failed migration must preserve originals; failed commit must retain
      the finished solve/draft for export. Decide whether larger histories require
      a different storage backend before broad rollout; do not delete originals to
      free space automatically.
- [ ] Give users without Web Locks a clear read/export route and an actionable
      explanation. Never replace the lock requirement with a pretend compare-and-swap.

## Audit change in this tranche

`readGuestTraining()` previously normalized raw guest v1 keys whenever no guest v2
payload existed, even if a restore journal described an interrupted multi-key
replacement. `readLegacyTrainingV2()` now rejects that journal before reading the
training fields, verifies stable original bytes, refuses concurrent v2 adoption,
and performs no writes. The main guest path also checks its account scope before
returning the snapshot. Domain tests exercise partial-restore refusal, successful
read-only conversion, and intervening journal/solve/adoption changes.

No browser run or hosted migration is implied by this checklist.
