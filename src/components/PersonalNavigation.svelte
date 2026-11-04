<script>
  import Button from "../lib/components/ui/button/button.svelte";
  let { current = "profile" } = $props();
</script>

<nav class="utility-nav personal-navigation" aria-label="Your workspace">
  <Button
    variant="secondary"
    href="/account/profile"
    aria-current={current === "profile" ? "page" : undefined}>My profile</Button
  >
  <Button
    variant="secondary"
    href="/progress"
    aria-current={current === "progress" ? "page" : undefined}
    >View progress</Button
  >
</nav>
