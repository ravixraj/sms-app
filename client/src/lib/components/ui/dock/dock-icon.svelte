<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { prefersReducedMotion } from "svelte/motion";
  import { fromStore, type Readable } from "svelte/store";
  import { cn } from "#lib/utils.js";
  import { dockKey, type DockSettings } from "./context.js";

  type MotionPosition = {
    get(): number;
    on(event: "change", update: (value: number) => void): () => void;
  };
  let {
    class: classProp,
    className,
    children,
    size,
    magnification,
    distance,
    mouseX,
    ...props
  }: HTMLAttributes<HTMLDivElement> & {
    className?: string;
    children?: Snippet;
    size?: number;
    magnification?: number;
    distance?: number;
    mouseX?: number | Readable<number> | MotionPosition;
  } = $props();

  const dock = getContext<DockSettings | undefined>(dockKey);
  let element = $state<HTMLDivElement>();
  const position = $derived.by(() => {
    const source = mouseX;
    if (typeof source !== "object" || !source) return undefined;
    if ("subscribe" in source) return fromStore(source);
    return fromStore<number>({
      subscribe(update) {
        update(source.get());
        return source.on("change", update);
      },
    });
  });
  const base = $derived(Math.max(1, size ?? dock?.iconSize ?? 40));
  const extent = $derived.by(() => {
    const x =
      typeof mouseX === "number"
        ? mouseX
        : (position?.current ?? dock?.mouseX ?? Infinity);
    const radius = distance ?? dock?.iconDistance ?? 140;
    if (
      !Number.isFinite(x) ||
      !element ||
      radius <= 0 ||
      dock?.disableMagnification ||
      prefersReducedMotion.current
    )
      return base;
    const bounds = element.getBoundingClientRect();
    const delta = Math.abs(x - (bounds.left + bounds.width / 2));
    const weight = Math.max(0, 1 - delta / radius);
    return (
      base +
      (Math.max(1, magnification ?? dock?.iconMagnification ?? 60) - base) *
        weight
    );
  });
</script>

<div
  {...props}
  bind:this={element}
  class={cn(
    "relative grid shrink-0 place-items-center rounded-full",
    classProp,
    className,
  )}
  style:width={`${extent}px`}
  style:height={`${extent}px`}
>
  <div
    class="grid place-items-center"
    style:width={`${base}px`}
    style:height={`${base}px`}
    style:transform={`scale(${extent / base})`}
  >
    {@render children?.()}
  </div>
</div>
