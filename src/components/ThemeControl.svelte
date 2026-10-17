<script>
  import Label from "../lib/components/ui/label/label.svelte";
  import { themePreference } from "../theme.js";
</script>

<fieldset class="theme-control">
  <legend>Color theme</legend>
  <div class="theme-options">
    {#each ["system", "light", "dark"] as value}
      <Label
        ><input
          type="radio"
          name="theme"
          {value}
          data-theme-control
          checked={themePreference() === value}
        />{value[0].toUpperCase() + value.slice(1)}</Label
      >
    {/each}
  </div>
</fieldset>
