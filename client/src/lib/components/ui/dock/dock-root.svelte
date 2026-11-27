<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "#lib/utils.js";
  import { dockKey, type DockSettings } from "./context.js";

  let {
    class: classProp,
    className,
    children,
    iconSize = 40,
    iconMagnification = 60,
    iconDistance = 140,
    direction = "middle",
    disableMagnification = false,
    onpointermove,
    onpointerleave,
    ...props
  }: HTMLAttributes<HTMLElement> & {
    className?: string;
    children?: Snippet;
    iconSize?: number;
    iconMagnification?: number;
    iconDistance?: number;
    direction?: "top" | "middle" | "bottom";
    disableMagnification?: boolean;
  } = $props();

  let cursor = $state(Infinity);
  setContext<DockSettings>(dockKey, {
    get mouseX() {
      return cursor;
    },
    get iconSize() {
      return iconSize;
    },
    get iconMagnification() {
      return iconMagnification;
    },
    get iconDistance() {
      return iconDistance;
    },
    get disableMagnification() {
      return disableMagnification;
    },
  });
</script>

<nav
  {...props}
  class={cn(
    "inline-flex max-w-full gap-1 rounded-2xl border bg-card p-1.5 text-card-foreground shadow-md",
    {
      "items-start": direction === "top",
      "items-center": direction === "middle",
      "items-end": direction === "bottom",
    },
    classProp,
    className,
  )}
  style:height={`calc(${iconSize}px + 0.75rem + 2px)`}
  onpointermove={(event) => {
    cursor = event.pointerType === "touch" ? Infinity : event.clientX;
    onpointermove?.(event);
  }}
  onpointerleave={(event) => {
    cursor = Infinity;
    onpointerleave?.(event);
  }}
>
  {@render children?.()}
</nav>
