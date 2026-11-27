<script lang="ts">
  import { toast } from "svelte-sonner";
  import { onMount } from "svelte";
  import { client } from "#lib/api.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import {
    applyLeaveSchema,
    leaveQuerySchema,
    leaveStatuses,
    schoolDate,
  } from "#lib/validation.js";
  import { handleZodError } from "#lib/handleZodError.js";
  import DatePicker from "#lib/components/DatePicker.svelte";
  import * as Card from "#lib/components/ui/card/index.js";
  import * as Dialog from "#lib/components/ui/dialog/index.js";
  import * as Field from "#lib/components/ui/field/index.js";
  import * as Select from "#lib/components/ui/select/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import StatusBadge from "#lib/components/StatusBadge.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import IconCalendarMinus from "@tabler/icons-svelte/icons/calendar-minus";
  import IconChevronLeft from "@tabler/icons-svelte/icons/chevron-left";
  import IconChevronRight from "@tabler/icons-svelte/icons/chevron-right";
  import IconSend from "@tabler/icons-svelte/icons/send";

  type LeaveRow = {
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: (typeof leaveStatuses)[number];
    createdAt: string | null;
    reviewedAt: string | null;
  };
  type Pagination = { total: number; limit: number; offset: number };

  const pageSizes = [10, 25, 50, 100];

  let applyOpen = $state(false);
  let start = $state("");
  let end = $state("");
  let reason = $state("");
  let applying = $state(false);
  let selectedStatus = $state<(typeof leaveStatuses)[number]>("PENDING");
  let limit = $state(10);
  let offset = $state(0);
  let leaves = $state<LeaveRow[]>([]);
  let pagination = $state<Pagination>({ total: 0, limit: 10, offset: 0 });
  let loading = $state(true);
  let loadError = $state("");

  const invalidRange = $derived(!!start && !!end && end < start);
  const applyDuration = $derived(start ? duration(start, end || start) : 0);

  const rangeStart = $derived(pagination.total ? pagination.offset + 1 : 0);
  const rangeEnd = $derived(
    Math.min(pagination.offset + pagination.limit, pagination.total),
  );
  const hasPrev = $derived(offset > 0);
  const hasNext = $derived(offset + limit < pagination.total);

  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  // Accepts YYYY-MM-DD dates and full ISO strings from date columns.
  function formatDate(value: string | null) {
    if (!value) return "—";
    return dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
  }

  function duration(startDate: string, endDate: string) {
    const from = Date.parse(`${startDate}T00:00:00Z`);
    const to = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
    return Math.round((to - from) / 86_400_000) + 1;
  }

  function changeDates(value: string, finish?: string) {
    start = value;
    end = finish ?? "";
  }

  async function applyLeave() {
    if (applying) return;

    applying = true;
    try {
      const input = handleZodError(
        applyLeaveSchema.safeParse({
          startDate: start,
          endDate: end || start,
          reason,
        }),
      );
      const response = await client.api.leave.$post(
        { json: input },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }

      toast.success("Leave request submitted", {
        description: `${formatDate(input.startDate)} – ${formatDate(input.endDate)}`,
      });
      start = "";
      end = "";
      reason = "";
      applyOpen = false;
      selectedStatus = "PENDING";
      offset = 0;
      await load();
    } catch (error) {
      toast.error("Unable to apply for leave.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      applying = false;
    }
  }

  async function load() {
    loading = true;
    loadError = "";
    try {
      const validated = handleZodError(
        leaveQuerySchema.safeParse({
          status: selectedStatus,
          limit: String(limit),
          offset: String(offset),
        }),
      );
      const query = {
        status: validated.status ?? selectedStatus,
        limit: String(validated.limit),
        offset: String(validated.offset),
      };
      const response = await client.api.leave.me.$get(
        { query },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      leaves = result.data.leaves;
      pagination = result.data.pagination;
    } catch (error) {
      leaves = [];
      pagination = { total: 0, limit, offset };
      loadError =
        error instanceof Error ? error.message : "Could not load your leave.";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  function changeStatus(value: string) {
    const next = leaveStatuses.find((status) => status === value);
    if (!next) return;
    if (next === selectedStatus) return;
    selectedStatus = next;
    offset = 0;
    void load();
  }

  function changeLimit(value: string) {
    const next = Number(value);
    if (!pageSizes.includes(next) || next === limit) return;
    limit = next;
    offset = 0;
    void load();
  }

  function goToOffset(next: number) {
    if (loading || next < 0 || next === offset) return;
    offset = next;
    void load();
  }
</script>

<Card.Root>
  <Card.Header class="gap-1 px-4 sm:px-6">
    <Card.Title class="flex items-center gap-2">
      <IconCalendarMinus class="size-4 text-primary/70" aria-hidden="true" />
      My leave
    </Card.Title>
    <Card.Description>
      Leave requests you've submitted, newest first.
    </Card.Description>
    <Card.Action>
      <Dialog.Root bind:open={applyOpen}>
        <Dialog.Trigger>
          {#snippet child({ props })}
            <Button {...props} class="min-h-10 cursor-pointer">
              <IconSend data-icon="inline-start" aria-hidden="true" />
              Apply leave
            </Button>
          {/snippet}
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
              <IconSend class="size-4" aria-hidden="true" />
              Apply for leave
            </Dialog.Title>
            <Dialog.Description>
              Select the dates and provide a reason.
            </Dialog.Description>
          </Dialog.Header>
          <form
            class="flex flex-col gap-4"
            onsubmit={(event) => {
              event.preventDefault();
              void applyLeave();
            }}
          >
            <Field.Group>
              <Field.Field>
                <Field.Label for="leave-dates">Leave dates</Field.Label>
                <DatePicker
                  id="leave-dates"
                  label="Leave dates"
                  placeholder="Select leave dates"
                  value={start}
                  {end}
                  min={auth.schoolDate || schoolDate()}
                  allowRange
                  disableSundays
                  disabled={applying}
                  onchange={changeDates}
                />
                {#if start}
                  <p class="text-xs text-muted-foreground">
                    Duration: {applyDuration} day{applyDuration === 1
                      ? ""
                      : "s"}
                    {invalidRange
                      ? " — End date must be on or after the start date."
                      : ""}
                  </p>
                {/if}
              </Field.Field>
              <Field.Field>
                <Field.Label for="reason">Reason</Field.Label>
                <Textarea
                  id="reason"
                  bind:value={reason}
                  placeholder="Briefly describe your reason for leave…"
                  rows={3}
                  maxlength={200}
                  disabled={applying}
                />
                <Field.Description>{reason.length}/200</Field.Description>
              </Field.Field>
            </Field.Group>
            <Dialog.Footer>
              <Button
                type="submit"
                class="w-fit cursor-pointer"
                disabled={applying}
              >
                {#if applying}
                  <Spinner data-icon="inline-start" />
                {:else}
                  <IconSend data-icon="inline-start" aria-hidden="true" />
                {/if}
                {applying ? "Applying…" : "Apply leave"}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </Card.Action>
  </Card.Header>

  <Card.Content class="gap-4 px-4 sm:px-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="flex flex-col gap-1.5">
        <Select.Root
          type="single"
          value={selectedStatus}
          onValueChange={changeStatus}
        >
          <Select.Trigger
            id="my-leave-status"
            class="min-h-11 w-full sm:w-44"
            aria-label="Filter your leave by status"
          >
            {selectedStatus}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each leaveStatuses as value (value)}
                <Select.Item {value} label={value}>{value}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-1.5">
        <span
          class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >Rows per page</span
        >
        <Select.Root
          type="single"
          value={String(limit)}
          onValueChange={changeLimit}
        >
          <Select.Trigger
            id="my-leave-limit"
            class="min-h-11 w-full sm:w-32"
            aria-label="Rows per page"
          >
            {limit}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each pageSizes as size (size)}
                <Select.Item value={String(size)} label={String(size)}>
                  {size}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>
      <Button
        variant="outline"
        class="min-h-11 w-full cursor-pointer sm:ml-auto sm:w-auto"
        disabled={loading}
        onclick={() => void load()}
      >
        {#if loading}<Spinner data-icon="inline-start" />{/if}
        Refresh
      </Button>
    </div>
  </Card.Content>

  <div>
    {#if loading && !leaves.length}
      <p
        class="flex items-center gap-2 p-4 text-muted-foreground sm:p-6"
        role="status"
      >
        <Spinner class="size-4" />
        Loading your leave…
      </p>
    {:else if loadError}
      <div class="space-y-3 p-4 sm:p-6">
        <p role="alert">{loadError}</p>
        <Button
          variant="outline"
          class="min-h-11 cursor-pointer"
          onclick={() => void load()}>Try again</Button
        >
      </div>
    {:else if !leaves.length}
      <EmptyState
        title="No leave requests"
        description={`You have no ${selectedStatus.toLowerCase()} leave requests.`}
      >
        {#snippet icon()}
          <IconCalendarMinus class="size-5" aria-hidden="true" />
        {/snippet}
      </EmptyState>
    {:else}
      <ul aria-label="Your leave requests" class="divide-y">
        {#each leaves as leave (leave.id)}
          {@const days = duration(leave.startDate, leave.endDate)}
          <li class="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:p-6">
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">
                  {formatDate(leave.startDate)}{leave.endDate !==
                  leave.startDate
                    ? ` – ${formatDate(leave.endDate)}`
                    : ""}
                </span>
                <StatusBadge status={leave.status} />
              </div>
              <p class="text-sm text-muted-foreground wrap-anywhere">
                {leave.reason}
              </p>
              <p class="text-xs text-muted-foreground">
                {days} day{days === 1 ? "" : "s"} · Applied {formatDate(
                  leave.createdAt,
                )}
              </p>
              {#if leave.reviewedAt}
                <p class="text-xs text-muted-foreground">
                  Reviewed {formatDate(leave.reviewedAt)}
                </p>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
      <footer
        class="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <p class="text-sm text-muted-foreground" role="status">
          Showing {rangeStart}–{rangeEnd} of {pagination.total}
        </p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            class="min-h-11 cursor-pointer"
            disabled={!hasPrev || loading}
            onclick={() => goToOffset(Math.max(0, offset - limit))}
          >
            <IconChevronLeft data-icon="inline-start" aria-hidden="true" />
            Previous
          </Button>
          <Button
            variant="outline"
            class="min-h-11 cursor-pointer"
            disabled={!hasNext || loading}
            onclick={() => goToOffset(offset + limit)}
          >
            Next
            <IconChevronRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      </footer>
    {/if}
  </div>
</Card.Root>
