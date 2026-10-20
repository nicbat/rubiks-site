<script lang="ts" module>
  import { type VariantProps, tv } from "tailwind-variants/lite";
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";

  export const buttonVariants = tv({
    // Variant classes are semantic; cn() performs the single Tailwind merge.
    // Keep Last Layer's established visual language and 44px targets.
    base: "",
    variants: {
      variant: {
        default: "primary",
        outline: "secondary",
        secondary: "secondary",
        ghost: "text-button",
        destructive: "secondary cube-delete",
        link: "text-button",
        plain: "",
      },
      size: { default: "", icon: "icon-button" },
    },
    defaultVariants: { variant: "plain", size: "default" },
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
  export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

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
