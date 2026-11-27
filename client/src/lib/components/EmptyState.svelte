<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    icon: Snippet;
    title: string;
    description?: string;
    action?: Snippet;
    class?: string;
  };

  let {
    icon,
    title,
    description,
    action,
    class: className = "",
  }: Props = $props();
</script>

<div
  class={[
    "flex flex-col items-center justify-center gap-3 px-4 py-12 text-center",
    className,
  ]}
>
  <div
    class="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground"
    aria-hidden="true"
  >
    {@render icon()}
  </div>
  <div class="space-y-1">
    <p class="text-sm font-medium">{title}</p>
    {#if description}
      <p class="text-sm text-muted-foreground">{description}</p>
    {/if}
  </div>
  {#if action}
    {@render action()}
  {/if}
</div>
