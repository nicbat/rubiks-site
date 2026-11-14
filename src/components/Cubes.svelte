<script>
  import {
    CUBE_EVENT_REGISTRY,
    PUZZLE_IDS,
    getCubeEvent,
  } from "../cube-events.js";
  import SelectControl from "./SelectControl.svelte";
  import NativeSelect from "../lib/components/ui/native-select/native-select.svelte";
  import Card from "../lib/components/ui/card/card.svelte";
  import Button from "../lib/components/ui/button/button.svelte";
  import Label from "../lib/components/ui/label/label.svelte";
  import Input from "../lib/components/ui/input/input.svelte";
  import Textarea from "../lib/components/ui/textarea/textarea.svelte";
  let props = $props();
</script>

{#snippet content(
  { cubes, defaultId, defaultsByEvent, eventId = "333" },
  editingId = null,
  deletingId = null,
)}
  {@const event = getCubeEvent(eventId)}
  {@const selectedDefault = defaultsByEvent
    ? defaultsByEvent[eventId]
    : defaultId}
  {@const active = cubes.filter((c) => !c.deleted)}
  {@const editing = active.find((c) => c.id === editingId)}
  <section class="cubes-page">
    <div class="page-heading">
      <div>
        <h1>Cubes</h1>
        <p class="muted">
          Choose your default for the {defaultsByEvent
            ? event.label + " "
            : ""}timer.
        </p>
      </div>
    </div>
    {#if defaultsByEvent}<SelectControl
        id="equipment-event"
        label="Default cube event"
        value={eventId}
        options={CUBE_EVENT_REGISTRY.map((item) => ({
          value: item.id,
          label: item.label,
        }))}
      />{/if}
    <div class="cube-list">
      {#each active as c}<Card class="cube-card" aria-label={c.name}
          ><div class="cube-card-heading">
            <h2>{c.name}</h2>
            {#if selectedDefault === c.id}<span class="cube-default-badge"
                >Default</span
              >{/if}
          </div>
          {#if defaultsByEvent}<p class="muted">
              {c.puzzleId.replace(
                "x",
                "×",
              )}{#each CUBE_EVENT_REGISTRY.filter((event) => defaultsByEvent[event.id] === c.id) as item}
                · Default for {item.label}{/each}
            </p>{/if}
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
              {#if selectedDefault !== c.id && (!defaultsByEvent || c.puzzleId === event.puzzleId)}<Button
                  class="text-button"
                  data-action="equipment-default"
                  data-id={c.id}
                  data-event={eventId}>Make default</Button
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
          {#if defaultsByEvent}<Label class="cube-field" for="cube-puzzle"
              >Puzzle
              <NativeSelect
                id="cube-puzzle"
                name="puzzleId"
                value={editing?.puzzleId || event.puzzleId}
              >
                {#each PUZZLE_IDS as puzzle}<option value={puzzle}
                    >{puzzle.replace("x", "×")}</option
                  >{/each}
              </NativeSelect></Label
            >{/if}
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
    <p class="cube-local-note">Cubes are included in training backups.</p>
  </section>
{/snippet}

{@render content(props, props.editingId, props.deletingId)}
