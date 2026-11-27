<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { client } from "#lib/api.js";
  import { auth } from "#lib/stores/auth.svelte.js";
  import { leaveQuerySchema, leaveStatuses } from "#lib/validation.js";
  import { handleZodError } from "#lib/handleZodError.js";
  import * as Card from "#lib/components/ui/card/index.js";
  import * as Select from "#lib/components/ui/select/index.js";
  import * as Avatar from "#lib/components/ui/avatar/index.js";
  import { Badge } from "#lib/components/ui/badge/index.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import StatusBadge from "#lib/components/StatusBadge.svelte";
  import EmptyState from "#lib/components/EmptyState.svelte";
  import { Spinner } from "#lib/components/ui/spinner/index.js";
  import IconClipboardList from "@tabler/icons-svelte/icons/clipboard-list";
  import IconChevronLeft from "@tabler/icons-svelte/icons/chevron-left";
  import IconChevronRight from "@tabler/icons-svelte/icons/chevron-right";

  type LeaveRow = {
    id: string;
    user: { id: string; name: string; email: string; role: string };
    startDate: string;
    endDate: string;
    reason: string;
    status: (typeof leaveStatuses)[number];
    createdAt: string | null;
    reviewedAt: string | null;
  };
  type Pagination = { total: number; limit: number; offset: number };

  const pageSizes = [10, 25, 50, 100];

  let selectedStatus = $state<(typeof leaveStatuses)[number]>("PENDING");
  let limit = $state(25);
  let offset = $state(0);
  let leaves = $state<LeaveRow[]>([]);
  let pagination = $state<Pagination>({ total: 0, limit: 25, offset: 0 });
  let loading = $state(true);
  let loadError = $state("");
  let reviewing = $state<string | null>(null);

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
      // The Hono RPC client sends query values as strings; the API's
      // leaveQuerySchema coerces them back to numbers.
      const query = {
        status: validated.status ?? selectedStatus,
        limit: String(validated.limit),
        offset: String(validated.offset),
      };
      const response = await client.api.leave.$get(
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
        error instanceof Error
          ? error.message
          : "Could not load leave requests.";
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

  async function review(leave: LeaveRow, decision: "APPROVED" | "REJECTED") {
    if (reviewing) return;
    reviewing = leave.id;
    try {
      const response = await client.api.leave.review.$patch(
        {
          json: { leaveId: leave.id, status: decision },
        },
        { init: { signal: AbortSignal.timeout(20_000) } },
      );
      const result = await response.json();
      if (!result.success) {
        if (response.status === 401) auth.clearUser();
        throw new Error(result.message);
      }
      toast.success(
        decision === "APPROVED" ? "Leave approved" : "Leave rejected",
        { description: `${leave.user.name} · ${formatDate(leave.startDate)}` },
      );
      await load();
    } catch (error) {
      toast.error("Unable to update the leave request.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      reviewing = null;
    }
  }
</script>

<Card.Root>
  <Card.Header class="gap-1 px-4 sm:px-6">
    <Card.Title class="flex items-center gap-2">
      <IconClipboardList class="size-4 text-primary/70" aria-hidden="true" />
      Leave requests
    </Card.Title>
    <Card.Description>
      Leave applications submitted by members of your organization.
    </Card.Description>
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
            id="leave-status"
            class="min-h-11 w-full sm:w-44"
            aria-label="Filter by status"
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
            id="leave-limit"
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
        Loading leave requests…
      </p>
    {:else if loadError}
      <div class="space-y-3 p-4 sm:p-6">
        <p role="alert">{loadError}</p>
        <Button
          variant="outline"
          class="min-h-11 cursor-pointer"
          onclick={() => void load()}
        >
          Try again
        </Button>
      </div>
    {:else if !leaves.length}
      <EmptyState
        title="No leave requests"
        description={`No ${selectedStatus.toLowerCase()} leave requests.`}
      >
        {#snippet icon()}
          <IconClipboardList class="size-5" aria-hidden="true" />
        {/snippet}
      </EmptyState>
    {:else}
      <ul aria-label="Leave requests" class="divide-y">
        {#each leaves as leave (leave.id)}
          {@const days = duration(leave.startDate, leave.endDate)}
          <li
            class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-6"
          >
            <Avatar.Root class="size-10 shrink-0">
              <Avatar.Fallback class="text-sm font-semibold">
                {leave.user.name.charAt(0).toUpperCase()}
              </Avatar.Fallback>
            </Avatar.Root>
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{leave.user.name}</span>
                <Badge variant="outline">{leave.user.role}</Badge>
                <StatusBadge status={leave.status} />
              </div>
              <p class="text-sm text-muted-foreground wrap-anywhere">
                {leave.user.email}
              </p>
              <p class="text-sm wrap-anywhere whitespace-pre-line">
                {leave.reason}
              </p>
              <p class="text-xs text-muted-foreground">
                {formatDate(leave.startDate)}{leave.endDate !== leave.startDate
                  ? ` – ${formatDate(leave.endDate)}`
                  : ""}
                · {days} day{days === 1 ? "" : "s"}
              </p>
              <p class="text-xs text-muted-foreground">
                Applied {formatDate(leave.createdAt)}
                {#if leave.reviewedAt}
                  · Reviewed {formatDate(leave.reviewedAt)}
                {/if}
              </p>
            </div>
            {#if leave.status === "PENDING"}
              <div class="flex gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  class="min-h-11 cursor-pointer"
                  disabled={!!reviewing}
                  onclick={() => void review(leave, "REJECTED")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  class="min-h-11 cursor-pointer"
                  disabled={!!reviewing}
                  onclick={() => void review(leave, "APPROVED")}
                >
                  {#if reviewing === leave.id}
                    <Spinner data-icon="inline-start" />
                  {/if}
                  Approve
                </Button>
              </div>
            {/if}
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
