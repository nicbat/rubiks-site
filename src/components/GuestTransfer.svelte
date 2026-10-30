<script>
  import MergeSummary from "./MergeSummary.svelte";
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
    account.busy ||
      running ||
      (testData && !account.demo) ||
      (!account.demo && account.sync?.status !== "synced"),
  );
</script>

<section class="account-settings" aria-label="Guest progress transfer">
  <h2>
    {account.guestImportComparison?.hasChanges === false
      ? "No new guest progress"
      : "Add guest progress?"}
  </h2>
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
    {#if account.guestImportComparison}
      {#if !account.guestImportComparison.hasChanges}<p role="status">
          There is nothing new to add. Your account copy is kept.
        </p>{/if}
      <MergeSummary summary={account.guestImportComparison.summary} />
      <p>The guest copy stays on this device.</p>
    {:else}<p role="status">
        Finish syncing your account to compare both copies.
      </p>{/if}
  {/if}
  <div class="button-row">
    <Button
      variant="default"
      data-action="account-import-guest"
      disabled={disabled ||
        !!account.guestImportError ||
        !account.guestImportComparison?.hasChanges}>Add guest progress</Button
    >
    <Button
      variant="secondary"
      data-action="account-import-cancel"
      disabled={account.busy}
      >{account.guestImportComparison?.hasChanges === false
        ? "Close"
        : "Keep separate"}</Button
    >
  </div>
</section>
