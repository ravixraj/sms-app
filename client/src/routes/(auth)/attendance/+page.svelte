<script lang="ts">
  import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import MarkAttendance from "#lib/components/MarkAttendance.svelte";
  import ShowAttendance from "#lib/components/ShowAttendance.svelte";

  type View = "mark" | "mine";

  const isTeacher = $derived(auth.user?.role === "TEACHER");
  const isStudent = $derived(auth.user?.role === "STUDENT");
  let view = $state<View>("mark");

  function changeView(value: string | undefined) {
    if (value === "mark" || value === "mine") view = value;
  }
</script>

<svelte:head>
  <title>Attendance</title>
  <meta name="description" content="Track your attendance." />
</svelte:head>

{#if isTeacher}
  <div
    class="mx-auto flex w-full max-w-6xl justify-center px-4 pt-6 sm:px-6 lg:px-8"
  >
    <ToggleGroup.Root
      type="single"
      value={view}
      onValueChange={changeView}
      variant="outline"
      class="w-full max-w-md"
    >
      <ToggleGroup.Item value="mark" class="min-h-11 flex-1 px-4">
        Mark attendance
      </ToggleGroup.Item>
      <ToggleGroup.Item value="mine" class="min-h-11 flex-1 px-4">
        My attendance
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
  {#if view === "mark"}
    <MarkAttendance />
  {:else}
    <ShowAttendance />
  {/if}
{:else if isStudent}
  <ShowAttendance />
{/if}
