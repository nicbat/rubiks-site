<script>
  import Button from "../lib/components/ui/button/button.svelte";
  import { recoveryLinks } from "../site-origin.js";
  let { recovery = null, earlier = false, testData = false } = $props();
</script>

{#if recovery}
  <section
    class="origin-recovery warning"
    aria-label="Recover browser progress"
  >
    <h2>Recover progress from {recovery.hostname}</h2>
    <p>
      Saved data at this address stays here. Export a backup or sign in to sync
      your account, then use lastlayer.net. Guest progress needs a separate
      transfer. Use an email code on this page to sign in during recovery.
    </p>
    {#if testData}<p>
        Turn off test data in Settings to export your saved progress.
      </p>{/if}
    <div class="button-row">
      <Button variant="secondary" data-action="backup" disabled={testData}
        >Backup and transfer</Button
      >
      {#if earlier}<Button
          variant="secondary"
          data-action="export-earlier-learning">Export earlier learning</Button
        >{/if}
      <Button variant="secondary" href={recovery.canonicalHref}
        >Continue at lastlayer.net</Button
      >
    </div>
    <p class="muted">
      On lastlayer.net, sign in and merge your backup in Settings → Data &amp;
      backups.
    </p>
  </section>
{:else}
  <details class="origin-recovery">
    <summary>Recover progress from another address</summary>
    <p>
      Used another address in this browser? Open its recovery page, export a
      backup, then return here and merge it. Sign-ins and guest data are
      separate at each address.
    </p>
    <div class="button-row">
      {#each recoveryLinks as link}<Button
          variant="link"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer">{link.label}</Button
        >{/each}
    </div>
  </details>
{/if}

<style>
  .origin-recovery {
    min-width: 0;
    margin-block: 1rem;
  }
  .origin-recovery h2,
  .origin-recovery p {
    overflow-wrap: anywhere;
  }
</style>
