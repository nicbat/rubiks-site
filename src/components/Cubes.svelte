<script>
  import Card from "../lib/components/ui/card/card.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Textarea from "../lib/components/ui/textarea/textarea.svelte";
  let props = $props();
</script>

{#snippet content({ cubes, defaultId }, editingId = null, deletingId = null)}
  {@const active = cubes.filter((c) => !c.deleted)}
  {@const editing = active.find((c) => c.id === editingId)}
  <section class="cubes-page">
    <div class="page-heading">
      <div>
        <h1>Cubes</h1>
        <p class="muted">Choose your default for the timer.</p>
      </div>
    </div>
    <div class="cube-list">
      {#each active as c}<Card class="cube-card" aria-label={c.name}
          ><div class="cube-card-heading">
            <h2>{c.name}</h2>
            {#if defaultId === c.id}<span class="cube-default-badge"
                >Default</span
              >{/if}
          </div>
          {#if c.description}<p class="cube-description">
              {c.description}
            </p>{/if}
          {#if deletingId === c.id}<div class="cube-delete-confirm">
              <p>Delete this cube? Past solves keep its name.</p>
              <div class="cube-actions">
                <Button
                  class="secondary"
                  data-action="equipment-delete-confirm"
                  data-id={c.id}>Delete cube</Button
                ><Button
                  class="text-button"
                  data-action="equipment-delete-cancel"
                  data-id={c.id}>Cancel</Button
                >
              </div>
            </div>{:else}<div class="cube-actions">
              {#if defaultId !== c.id}<Button
                  class="text-button"
                  data-action="equipment-default"
                  data-id={c.id}>Make default</Button
                >{/if}<Button
                class="text-button"
                data-action="equipment-edit"
                data-id={c.id}
                aria-label={"Edit " + c.name}>Edit</Button
              ><Button
                class="text-button cube-delete"
                data-action="equipment-delete"
                data-id={c.id}
                aria-label={"Delete " + c.name}>Delete</Button
              >
            </div>{/if}</Card
        >{/each}
    </div>
    <details
      id="cube-editor"
      class="cube-editor"
      {...editing || !active.length ? { open: true } : {}}
    >
      <summary>{editing ? "Edit cube" : "Add cube"}</summary>
      {#key `${editingId || "new"}:${props.formRevision || 0}`}
        <form id="cube-form">
          <Label class="cube-field" for="cube-name"
            >Name<Input
              id="cube-name"
              name="name"
              required
              maxlength="100"
              value={editing?.name || ""}
            /></Label
          >
          <Label class="cube-field" for="cube-description"
            >Description (optional)<Textarea
              id="cube-description"
              name="description"
              maxlength="1000"
              rows="2"
              value={editing?.description || ""}
            /></Label
          >
          <div class="cube-actions">
            <Button class="primary" type="submit"
              >{editing ? "Save cube" : "Add cube"}</Button
            ><Button
              class="text-button"
              type="button"
              data-action="equipment-cancel">Cancel</Button
            >
          </div>
        </form>
      {/key}
    </details>
    <p class="cube-local-note">Saved on this device.</p>
  </section>
{/snippet}

{@render content(props, props.editingId, props.deletingId)}
