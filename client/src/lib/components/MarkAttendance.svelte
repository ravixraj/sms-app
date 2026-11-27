<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { client } from "#lib/api.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import DatePicker from "./DatePicker.svelte";
  import { parseDate } from "@internationalized/date";
  import { schoolDate } from "#lib/validation.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import IconUsers from "@tabler/icons-svelte/icons/users";
  import IconUsersGroup from "@tabler/icons-svelte/icons/users-group";
  import IconCalendarCheck from "@tabler/icons-svelte/icons/calendar-check";
  import IconChevronLeft from "@tabler/icons-svelte/icons/chevron-left";
  import IconChevronRight from "@tabler/icons-svelte/icons/chevron-right";
  import * as Avatar from "#lib/components/ui/avatar/index.js";
  import * as Dialog from "#lib/components/ui/dialog/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import { statusStyles, statusTextStyles } from "#lib/status.js";

  const labels = {
    PRESENT: "Present",
    ABSENT: "Absent",
    LEAVE: "Leave",
  } as const;
  type Status = keyof typeof labels;
  const statuses = Object.keys(labels) as Status[];

  let team = $state<{ teamId: string; teamName: string } | null>(null);
  let rows = $state<
    { id: string; name: string; email: string; status: Status }[]
  >([]);
  let date = $state("");
  let loading = $state(true);
  let loadError = $state("");
  let saving = $state(false);
  let feedback = $state("");
  const counts = $derived.by(() => {
    const totals = { PRESENT: 0, ABSENT: 0, LEAVE: 0 };
    for (const row of rows) totals[row.status]++;
    return totals;
  });

  let first = $state("");
  let last = $state("");
  let dirty = $state(false);

  type DateChange = { day: string; start: string; end: string };

  let discardOpen = $state(false);
  let pendingDate = $state<DateChange | null>(null);

  function applyDate({ day, start, end }: DateChange) {
    first = start;
    last = end;
    if (day !== date) void load(day);
  }

  function changeDate(day: string, start = day, end = "") {
    if (loading || saving) return;
    if (day === date) {
      applyDate({ day, start, end });
      return;
    }
    if (dirty) {
      pendingDate = { day, start, end };
      discardOpen = true;
      return;
    }
    applyDate({ day, start, end });
  }

  function mark(row: (typeof rows)[number], status: Status) {
    if (row.status !== status) dirty = true;
    row.status = status;
    feedback = "";
  }

  async function load(day = date) {
    date = day;
    dirty = false;
    feedback = "";
    loading = true;
    loadError = "";
    try {
      const roster = await (await client.api.team.member.$get()).json();
      if (!roster.success) throw new Error(roster.message);
      const { teamId, teamName, users = [] } = roster.data;
      const marks = await (
        await client.api.attendance.classes.$get({
          query: { teamId, date: day || undefined },
        })
      ).json();
      if (!marks.success) throw new Error(marks.message);
      const saved = new Map(
        marks.data.records.map((record) => [record.userId, record.status]),
      );
      date = marks.data.date;
      if (!first) first = date;
      team = { teamId, teamName };
      rows = users.map(({ id, name, email }) => ({
        id,
        name,
        email,
        status: saved.get(id) ?? "PRESENT",
      }));
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : "Could not load attendance.";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  async function save() {
    if (!team || saving || !rows.length) return;
    saving = true;
    feedback = "";
    try {
      // The attendance API accepts up to 200 records per request.
      for (let start = 0; start < rows.length; start += 200) {
        const records = rows
          .slice(start, start + 200)
          .map(({ id, status }) => ({ userId: id, status }));
        const result = await (
          await client.api.attendance.$post({
            json: { teamId: team.teamId, date, records },
          })
        ).json();
        if (!result.success) throw new Error(result.message);
      }
      dirty = false;
      toast.success("Attendance saved");
    } catch (error) {
      feedback =
        "Save incomplete. " +
        (error instanceof Error ? error.message : "Please try again.");
    } finally {
      saving = false;
    }
  }
</script>

<main class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
  <Card.Root>
    <Card.Header class="gap-1 px-4 sm:px-6">
      <Card.Title class="flex items-center gap-2">
        <IconCalendarCheck class="size-4 text-primary/70" aria-hidden="true" />
        Attendance
      </Card.Title>
    </Card.Header>
    <Card.Content class="gap-4 px-4 sm:px-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div
          class="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 py-3"
        >
          <IconUsers class="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span
            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >Class</span
          >
          <span class="ml-auto truncate text-sm font-medium"
            >{team?.teamName ?? "—"}</span
          >
        </div>
        <div
          class="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 py-3"
        >
          <IconUsersGroup
            class="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span
            class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >Students</span
          >
          <span class="ml-auto text-sm font-medium tabular-nums"
            >{loading || loadError ? "—" : rows.length}</span
          >
        </div>
        <div class="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
          {#if !loading && !loadError && rows.length}
            <Button
              variant="outline"
              class="min-h-11 w-full px-3 sm:w-auto"
              disabled={saving}
              onclick={() => {
                for (const row of rows) mark(row, "ABSENT");
              }}>Mark all absent</Button
            >
          {/if}
          <DatePicker
            label="Attendance date"
            value={first}
            end={last}
            max={auth.schoolDate || schoolDate()}
            disabled={loading || saving}
            allowRange
            disableSundays
            onchange={(start, end) => changeDate(start, start, end)}
          />
        </div>
      </div>
    </Card.Content>
    <div>
      {#if last && date}
        <nav
          aria-label="Days in selected range"
          class="mb-4 flex justify-between border-y px-3 py-1 sm:px-6"
        >
          <Button
            variant="ghost"
            size="icon"
            class="min-h-11"
            aria-label="Previous day"
            disabled={loading || saving || date <= first}
            onclick={() =>
              changeDate(
                parseDate(date).subtract({ days: 1 }).toString(),
                first,
                last,
              )}
          >
            <IconChevronLeft class="size-5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="min-h-11"
            aria-label="Next day"
            disabled={loading || saving || date >= last}
            onclick={() =>
              changeDate(
                parseDate(date).add({ days: 1 }).toString(),
                first,
                last,
              )}
          >
            <IconChevronRight class="size-5" aria-hidden="true" />
          </Button>
        </nav>
      {/if}
      {#if loading}
        <div
          role="status"
          class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-muted-foreground sm:py-16"
        >
          <Spinner
            class="size-6 text-primary"
            role="presentation"
            aria-hidden="true"
          />
          <p class="text-sm">Loading attendance…</p>
        </div>
      {:else if loadError}
        <div class="space-y-3 p-4 sm:p-6">
          <p role="alert">{loadError}</p>
          <Button variant="outline" class="min-h-11" onclick={() => load()}
            >Try again</Button
          >
        </div>
      {:else if !rows.length}
        <EmptyState
          title="No students yet"
          description="Add students to this team to start marking attendance."
        >
          {#snippet icon()}
            <IconUsers class="size-5" aria-hidden="true" />
          {/snippet}
        </EmptyState>
      {:else}
        <section
          aria-label="Attendance summary"
          class="grid grid-cols-3 gap-2 px-4 pb-4 sm:gap-3 sm:px-6"
        >
          {#each statuses as status (status)}
            <div
              data-status={status}
              class={[
                "rounded-lg border py-3 text-center sm:py-4",
                statusStyles[status],
              ]}
            >
              <div
                class="text-2xl leading-tight font-semibold tabular-nums sm:text-3xl"
              >
                {counts[status]}
              </div>
              <div class="mt-0.5 text-xs font-medium sm:text-sm">
                {labels[status]}
              </div>
            </div>
          {/each}
        </section>
        <ol aria-label="Class roster">
          {#each rows as row (row.id)}
            <li
              class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-t px-4 py-3 min-[360px]:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-6"
            >
              <Avatar.Root class="size-10 shrink-0">
                <Avatar.Fallback class="text-sm font-semibold">
                  {row.name.charAt(0).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              <div class="min-w-0 wrap-anywhere">
                <div class="font-medium">{row.name}</div>
                <div class="text-sm text-muted-foreground">{row.email}</div>
              </div>
              <div
                role="group"
                aria-label={row.name}
                class="col-span-full grid grid-cols-3 gap-1.5 min-[360px]:col-span-1"
              >
                {#each statuses as status (status)}
                  <button
                    type="button"
                    disabled={saving}
                    aria-label={labels[status]}
                    title={labels[status]}
                    aria-pressed={row.status === status}
                    data-status={status}
                    class={[
                      "min-h-11 min-w-11 rounded-md border text-sm font-medium hover:bg-current/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 aria-pressed:border-current aria-pressed:bg-current/10 aria-pressed:font-semibold md:min-w-20",
                      statusTextStyles[status],
                    ]}
                    onclick={() => mark(row, status)}
                  >
                    <span class="hidden md:inline">{labels[status]}</span>
                    <span class="md:hidden">{status[0]}</span>
                  </button>
                {/each}
              </div>
            </li>
          {/each}
        </ol>
        <footer
          class="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-end sm:p-6"
        >
          <p role="status" class="text-sm text-muted-foreground empty:hidden">
            {feedback}
          </p>
          <Button class="min-h-11 px-6" disabled={saving} onclick={save}>
            {saving ? "Saving…" : "Save attendance"}
          </Button>
        </footer>
      {/if}
    </div>
  </Card.Root>

  <Dialog.Root bind:open={discardOpen}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Discard unsaved changes?</Dialog.Title>
        <Dialog.Description>
          Your unsaved attendance marks for this date will be lost.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="ghost" onclick={() => (discardOpen = false)}>
          Keep editing
        </Button>
        <Button
          variant="destructive"
          onclick={() => {
            const next = pendingDate;
            discardOpen = false;
            pendingDate = null;
            if (next) applyDate(next);
          }}
        >
          Discard &amp; continue
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</main>
