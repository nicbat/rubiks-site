<script>
  import Button from "../lib/components/ui/button/button.svelte";
  let { current, title, description = "", actions } = $props();
</script>

<header class="personal-workspace-header">
  <div class="workspace-heading">
    <div class="workspace-title">
      <h1>{title}</h1>
      {#if description}<p class="muted">{description}</p>{/if}
    </div>
    {#if actions}<div class="button-row workspace-actions">
        {@render actions()}
      </div>{/if}
  </div>
  <nav class="workspace-tabs" aria-label="Your workspace">
    <Button
      variant="link"
      href="/account/profile"
      aria-current={current === "profile" ? "page" : undefined}>Profile</Button
    >
    <Button
      variant="link"
      href="/progress"
      aria-current={current === "progress" ? "page" : undefined}
      >Progress</Button
    >
  </nav>
</header>

<style>
  .personal-workspace-header {
    margin: 28px 0 24px;
    min-width: 0;
  }
  .workspace-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 24px;
  }
  .workspace-title {
    min-width: 0;
    flex: 1 1 280px;
  }
  h1 {
    margin: 0;
    font: 400 clamp(26px, 3.4vw, 42px) / 1.2 var(--font-display);
    overflow-wrap: anywhere;
  }
  p {
    margin: 8px 0 0;
    max-width: 70ch;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .workspace-actions {
    align-items: center;
    gap: 8px 20px;
  }
  .workspace-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0 24px;
    width: 100%;
    margin-top: 16px;
    border-bottom: 1px solid var(--line);
  }
  .workspace-tabs :global(a) {
    min-height: 44px;
    padding: 10px 4px;
    margin-bottom: -1px;
    border-bottom: 3px solid transparent;
    font: 600 16px / 1.4 var(--font-sans);
    color: var(--muted);
    text-decoration: none;
  }
  .workspace-tabs :global(a[aria-current="page"]) {
    color: var(--ink);
    border-bottom-color: var(--title);
  }
  .workspace-tabs :global(a:hover) {
    color: var(--ink);
  }
</style>
