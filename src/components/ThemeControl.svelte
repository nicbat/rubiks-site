<script>
  import { getContext } from "svelte";
  import * as RadioGroup from "../lib/components/ui/radio-group/index.js";
  import Label from "../lib/components/ui/label/label.svelte";
  import { themePreference } from "../theme.js";
  const actions = getContext("actions");
</script>

<fieldset class="theme-control">
  <legend id="theme-label">Color theme</legend>
  <RadioGroup.Root
    class="theme-options"
    aria-labelledby="theme-label"
    value={themePreference()}
    onValueChange={(value) => actions?.setThemePreference(value)}
  >
    {#each ["system", "light", "dark"] as value (value)}
      <div class="theme-option">
        <RadioGroup.Item id={`theme-${value}`} {value} />
        <Label for={`theme-${value}`}
          >{value[0].toUpperCase() + value.slice(1)}</Label
        >
      </div>
    {/each}
  </RadioGroup.Root>
</fieldset>
