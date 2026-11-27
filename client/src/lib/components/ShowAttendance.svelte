<script lang="ts">
  import { onMount } from "svelte";
  import type { InferResponseType } from "hono/client";
  import {
    DateFormatter,
    endOfMonth,
    getDayOfWeek,
    parseDate,
  } from "@internationalized/date";
  import IconCalendarCheck from "@tabler/icons-svelte/icons/calendar-check";
  import IconChevronLeft from "@tabler/icons-svelte/icons/chevron-left";
  import IconChevronRight from "@tabler/icons-svelte/icons/chevron-right";
  import * as Card from "#lib/components/ui/card/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import { client } from "#lib/api.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import { schoolDate } from "#lib/validation.js";
  import {
    statusCellStyles,
    statusStyles,
    statusTextStyles,
    type AttendanceStatus,
  } from "#lib/status.js";

  type AttendanceData = InferResponseType<
    typeof client.api.attendance.me.$get,
    200
  >["data"];
  type Status = AttendanceData["records"][number]["status"];

  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const statusLetter: Record<Status, string> = {
    PRESENT: "P",
    ABSENT: "A",
    LEAVE: "L",
  };
  const today = $derived(auth.schoolDate || schoolDate());
  const todayYear = $derived(Number(today.slice(0, 4)));
  const todayMonth = $derived(Number(today.slice(5, 7)));
  const academicStart = $derived(todayMonth >= 4 ? todayYear : todayYear - 1);
  const session = $derived(
    `${academicStart}-${String((academicStart + 1) % 100).padStart(2, "0")}`,
  );

  let month = $state(schoolDate().slice(0, 7));
  const monthStart = $derived(parseDate(`${month}-01`));
  const monthFormatter = new DateFormatter("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  let monthData = $state<AttendanceData | null>(null);
  let loading = $state(true);
  let errorMessage = $state("");

  const className = $derived.by(() => {
    const name = auth.user?.teamMember?.team.name?.trim();
    if (!name) return "Your attendance";
    return name.toLowerCase().startsWith("class") ? name : `Class ${name}`;
  });

  const monthLabel = $derived(monthFormatter.format(monthStart.toDate("UTC")));

  const summary = $derived(monthData?.summary ?? null);
  const monthPercent = $derived(
    summary?.total ? Math.round((summary.present / summary.total) * 100) : 0,
  );
  const marks = $derived.by(() => {
    const result = new Map<string, Status>();
    for (const record of monthData?.records ?? []) {
      result.set(record.date, record.status);
    }
    return result;
  });

  const days = $derived.by(() => {
    const count = endOfMonth(monthStart).day;
    const leading = getDayOfWeek(monthStart, "en-US", "sun");
    const cells: ({ day: number; date: string } | null)[] = Array.from(
      { length: leading },
      () => null,
    );
    for (let day = 1; day <= count; day++) {
      cells.push({ day, date: `${month}-${String(day).padStart(2, "0")}` });
    }
    return cells;
  });

  async function fetchRange(from: string, to: string) {
    const response = await client.api.attendance.me.$get({
      query: { from, to },
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Unable to load attendance");
    }
    return result.data;
  }

  async function loadMonth() {
    loading = true;
    errorMessage = "";
    const lastDay = endOfMonth(monthStart).day;
    try {
      monthData = await fetchRange(
        `${month}-01`,
        `${month}-${String(lastDay).padStart(2, "0")}`,
      );
    } catch (error) {
      monthData = null;
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function shiftMonth(delta: number) {
    month = monthStart.add({ months: delta }).toString().slice(0, 7);
    void loadMonth();
  }

  onMount(() => {
    void loadMonth();
  });
</script>

<div class="x-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
  <Card.Root>
    <Card.Header class="gap-1 px-4 sm:px-6">
      <Card.Title class="flex items-center gap-2">
        <IconCalendarCheck class="size-4 text-primary/70" aria-hidden="true" />
        My attendance
      </Card.Title>
      <Card.Description>{className} · {session}</Card.Description>
    </Card.Header>
    <Card.Content class="gap-4 px-4 sm:px-6">
      <nav
        aria-label="Attendance month"
        class="flex items-center justify-between gap-2 border-y px-1 py-1"
      >
        <Button
          variant="ghost"
          size="icon"
          class="min-h-11"
          aria-label="Previous month"
          onclick={() => shiftMonth(-1)}
        >
          <IconChevronLeft class="size-5" aria-hidden="true" />
        </Button>
        <span class="text-center text-sm font-medium">{monthLabel}</span>
        <Button
          variant="ghost"
          size="icon"
          class="min-h-11"
          aria-label="Next month"
          onclick={() => shiftMonth(1)}
        >
          <IconChevronRight class="size-5" aria-hidden="true" />
        </Button>
      </nav>

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
      {:else if errorMessage}
        <div class="space-y-3 p-4 sm:p-6">
          <p role="alert">{errorMessage}</p>
          <Button
            variant="outline"
            class="min-h-11"
            onclick={() => void loadMonth()}>Try again</Button
          >
        </div>
      {:else}
        <section
          aria-label="Monthly attendance summary"
          class="rounded-lg border bg-muted/20 p-4"
        >
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-3xl leading-tight font-semibold tabular-nums">
              {monthPercent}%
            </span>
            <span class="text-sm text-muted-foreground">
              {summary?.present ?? 0} of {summary?.total ?? 0} working days
            </span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <div
              class={[
                "rounded-lg border py-3 text-center sm:py-4",
                statusStyles.PRESENT,
              ]}
            >
              <div
                class="text-2xl leading-tight font-semibold tabular-nums sm:text-3xl"
              >
                {summary?.present ?? 0}
              </div>
              <div class="mt-0.5 text-xs font-medium sm:text-sm">Present</div>
            </div>
            <div
              class={[
                "rounded-lg border py-3 text-center sm:py-4",
                statusStyles.ABSENT,
              ]}
            >
              <div
                class="text-2xl leading-tight font-semibold tabular-nums sm:text-3xl"
              >
                {summary?.absent ?? 0}
              </div>
              <div class="mt-0.5 text-xs font-medium sm:text-sm">Absent</div>
            </div>
            <div
              class={[
                "rounded-lg border py-3 text-center sm:py-4",
                statusStyles.LEAVE,
              ]}
            >
              <div
                class="text-2xl leading-tight font-semibold tabular-nums sm:text-3xl"
              >
                {summary?.leave ?? 0}
              </div>
              <div class="mt-0.5 text-xs font-medium sm:text-sm">Leave</div>
            </div>
          </div>
        </section>

        <section
          aria-label="Attendance calendar"
          class="rounded-lg border p-3 sm:p-4"
        >
          <div
            class="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground"
          >
            {#each weekdays as weekday (weekday)}
              <div>{weekday}</div>
            {/each}
          </div>
          <div class="mt-2 grid grid-cols-7 gap-1 text-center">
            {#each days as cell, index (index)}
              {#if cell}
                {@const status = marks.get(cell.date)}
                <div
                  class={[
                    "flex min-h-12 flex-col items-center justify-center rounded-md border border-transparent py-1",
                    status ? statusCellStyles[status as AttendanceStatus] : "",
                    cell.date === today ? "border-primary" : "",
                  ]}
                >
                  <span class="text-xs tabular-nums">{cell.day}</span>
                  {#if status}
                    <span
                      class={[
                        "text-xs font-semibold",
                        statusTextStyles[status as AttendanceStatus],
                      ]}
                      aria-label={status}
                    >
                      {statusLetter[status]}
                    </span>
                  {/if}
                </div>
              {:else}
                <div></div>
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
