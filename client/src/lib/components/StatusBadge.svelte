<script lang="ts">
  import { Badge } from "#lib/components/ui/badge/index.js";
  import { statusLabels, statusStyles, type AppStatus } from "#lib/status.js";

  type Props = {
    status: AppStatus;
    label?: string;
    class?: string;
  };

  let { status, label, class: className = "" }: Props = $props();
</script>

<Badge variant="outline" class={[statusStyles[status], className]}>
  {label ?? statusLabels[status]}
</Badge>
