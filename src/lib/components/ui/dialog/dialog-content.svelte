<script>
  import { getContext } from "svelte";
  const actions = getContext("actions");
  import { Dialog as DialogPrimitive } from "bits-ui";
  let {
    children,
    id,
    "aria-labelledby": labelledby,
    "aria-describedby": describedby,
    ...restProps
  } = $props();
</script>

<DialogPrimitive.Root open={true}>
  <DialogPrimitive.Content
    {id}
    forceMount
    trapFocus={true}
    preventScroll={false}
    preventOverflowTextSelection={false}
    onOpenAutoFocus={(event) => event.preventDefault()}
    onCloseAutoFocus={(event) => event.preventDefault()}
    onEscapeKeydown={(event) => {
      event.preventDefault();
      actions?.closeDialog(id);
    }}
    onInteractOutside={(event) => event.preventDefault()}
  >
    {#snippet child({ props })}
      <dialog
        {...props}
        {...restProps}
        aria-labelledby={labelledby}
        aria-describedby={describedby}
        data-slot="dialog-content"
      >
        {@render children?.()}
      </dialog>
    {/snippet}
  </DialogPrimitive.Content>
</DialogPrimitive.Root>
