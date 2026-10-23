<script lang="ts" module>
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";

  // Semantic variants have no compound rules or slots. Keep their mapping
  // static; cn() below still merges caller overrides and retains shared targets.
  const variants = {
    default: "primary",
    outline: "secondary",
    secondary: "secondary",
    ghost: "text-button",
    destructive: "secondary cube-delete",
    link: "text-button",
    plain: "",
  };
  export type ButtonVariant = keyof typeof variants;
  export type ButtonSize = "default" | "icon";
  export function buttonVariants({
    variant = "plain",
    size = "default",
  }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
    return [variants[variant], size === "icon" && "icon-button"]
      .filter(Boolean)
      .join(" ");
  }

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    };
</script>

<script lang="ts">
  let {
    class: className,
    variant = "plain",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {disabled}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
