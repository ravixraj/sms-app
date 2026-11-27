<script lang="ts">
  import { buttonVariants } from "#lib/components/ui/button/index.js";
  import { cn } from "#lib/utils.js";
  import { Calendar, RangeCalendar, Popover } from "bits-ui";
  import {
    getDayOfWeek,
    parseDate,
    type DateValue,
  } from "@internationalized/date";
  import {
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
  } from "@tabler/icons-svelte";

  let {
    value,
    end = "",
    min,
    max,
    label,
    id,
    placeholder = "Select date",
    disabled = false,
    allowRange = false,
    disableSundays = false,
    onchange,
  }: {
    value: string;
    end?: string;
    min?: string;
    max?: string;
    label: string;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    allowRange?: boolean;
    disableSundays?: boolean;
    onchange: (start: string, end?: string) => void;
  } = $props();
  let open = $state(false);
  let range = $state(false);
  const parts = $derived(range ? RangeCalendar : Calendar);
  const selected = $derived(value ? parseDate(value) : undefined);
  const minimum = $derived(min ? parseDate(min) : undefined);
  const maximum = $derived(max ? parseDate(max) : undefined);
  const format = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const display = $derived(
    value
      ? format.format(new Date(value)) +
          (end ? " – " + format.format(new Date(end)) : "")
      : placeholder,
  );

  function choose(start: DateValue, finish?: DateValue) {
    open = false;
    onchange(start.toString(), finish?.toString());
  }
</script>

{#snippet grid({
  months,
  weekdays,
}: {
  months: { value: DateValue; weeks: DateValue[][] }[];
  weekdays: string[];
})}
  <parts.Header class="mb-4 flex items-center justify-between">
    <parts.PrevButton
      class="grid size-9 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
      ><IconChevronLeft size={16} /></parts.PrevButton
    >
    {#if allowRange}
      <parts.Heading class="text-base font-semibold" />
    {:else}
      <parts.Heading class="sr-only" />
      <parts.MonthSelect class="bg-popover text-sm" />
      <parts.YearSelect class="bg-popover text-sm" />
    {/if}
    <parts.NextButton
      class="grid size-9 place-items-center rounded-md hover:bg-muted disabled:opacity-30"
      ><IconChevronRight size={16} /></parts.NextButton
    >
  </parts.Header>
  {#each months as month (month.value.toString())}
    <parts.Grid
      class="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-1 text-center text-base"
    >
      <parts.GridHead
        ><parts.GridRow>
          {#each weekdays as day, i (i)}<parts.HeadCell
              class="pb-1 text-sm font-normal text-muted-foreground"
              >{day.slice(0, 2)}</parts.HeadCell
            >{/each}
        </parts.GridRow></parts.GridHead
      >
      <parts.GridBody>
        {#each month.weeks as week (week[0].toString())}
          <parts.GridRow>
            {#each week as date (date.toString())}
              <parts.Cell {date} month={month.value}>
                <parts.Day
                  class="grid aspect-square w-full cursor-pointer place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring data-disabled:cursor-default data-disabled:opacity-35 data-outside-month:text-muted-foreground data-highlighted:bg-muted data-selected:bg-foreground data-selected:text-background"
                />
              </parts.Cell>
            {/each}
          </parts.GridRow>
        {/each}
      </parts.GridBody>
    </parts.Grid>
  {/each}
{/snippet}

<Popover.Root
  bind:open
  onOpenChange={(next) => {
    if (next) range = Boolean(end);
  }}
>
  <Popover.Trigger
    {id}
    {disabled}
    aria-label={label + ", " + display}
    class={cn(
      buttonVariants({ variant: "outline" }),
      "h-auto min-h-11 min-w-0 justify-between gap-2 px-3 whitespace-normal",
    )}
  >
    {display}<IconCalendar size={17} />
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      sideOffset={6}
      class="z-50 w-[min(18.5rem,calc(100vw-1rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-md"
      aria-label={label}
    >
      {#if range}
        <RangeCalendar.Root
          locale="en-US"
          weekStartsOn={0}
          weekdayFormat="short"
          calendarLabel={label}
          placeholder={selected}
          value={end ? { start: selected, end: parseDate(end) } : undefined}
          minValue={minimum}
          maxValue={maximum}
          isDateDisabled={(date: DateValue) =>
            disableSundays && getDayOfWeek(date, "en-US", "sun") === 0}
          onValueChange={(v) => {
            if (v.start && v.end) choose(v.start, v.end);
          }}
          children={grid}
        />
      {:else}
        <Calendar.Root
          type="single"
          locale="en-US"
          weekStartsOn={0}
          weekdayFormat="short"
          calendarLabel={label}
          placeholder={selected}
          value={end ? undefined : selected}
          minValue={minimum}
          maxValue={maximum}
          isDateDisabled={(date: DateValue) =>
            disableSundays && getDayOfWeek(date, "en-US", "sun") === 0}
          preventDeselect
          onValueChange={(v) => {
            if (v) choose(v);
          }}
          children={grid}
        />
      {/if}
      {#if allowRange}
        <button
          type="button"
          class="mt-1 w-full rounded-md py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onclick={() => (range = !range)}
          >{range ? "Select a single date" : "Select a date range"}</button
        >
      {/if}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
