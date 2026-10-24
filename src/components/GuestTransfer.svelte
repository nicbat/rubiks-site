<script>
  import Button from "../lib/components/ui/button/button.svelte";
  let {
    account,
    running = false,
    testData = false,
    progress,
    solves = [],
    cubeCollection,
  } = $props();
  let disabled = $derived(
    account.busy || running || (testData && !account.demo),
  );
</script>

<section class="account-settings" aria-label="Guest progress transfer">
  <h2>Add guest progress?</h2>
  {#if account.guestImportError}
    <p role="status">{account.guestImportError}</p>
  {:else if account.guestImportPreview}
    {@const counts = account.guestImportPreview}
    <p>
      This device has {counts.attempts} guest attempts, {counts.solves} solves,
      {counts.cubes} cubes, {counts.selected} selected cases,
      {counts.known} known marks and {counts.reviewed} reviewed lessons.
    </p>
    <p>
      Your account currently has {progress?.attempts.length || 0} attempts,
      {solves.length} solves and {cubeCollection?.cubes.length || 0} cubes.
      {#if account.sync?.status !== "synced" && !account.demo}Account counts
        update after sync.{/if}
    </p>
    <p>
      Guest history and learning marks will be added. Matching IDs count once;
      existing account records, algorithm choices, course positions and default
      cube are kept. The guest copy stays on this device.
    </p>
  {/if}
  <div class="button-row">
    <Button
      variant="default"
      data-action="account-import-guest"
      disabled={disabled ||
        !!account.guestImportError ||
        !account.guestImportPreview}>Add guest progress</Button
    >
    <Button
      variant="secondary"
      data-action="account-import-cancel"
      disabled={account.busy}>Keep separate</Button
    >
  </div>
</section>
