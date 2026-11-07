<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import { syncStatus } from "../sync-status.js";
  let { account, demo = false, presentation, notice = "" } = $props();
  let sync = $derived(presentation || syncStatus({ account, demo, notice }));
</script>

{#if account.profile}
  <div
    class="account-sync-status"
    role="group"
    aria-label="Training sync"
    data-state={sync.state}
    title={sync.label}
  >
    <Button variant="link" class="account-sync-link" data-action="sync-details"
      >Sync status</Button
    >
    <span class="muted" class:attention={sync.attention}>{sync.label}</span>
  </div>
{/if}

<style>
  .account-sync-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 16px;
    min-width: 0;
    font-size: 14px;
  }
  span {
    overflow-wrap: anywhere;
  }
  .attention {
    color: var(--warn);
  }
</style>
