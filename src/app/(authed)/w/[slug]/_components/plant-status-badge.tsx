import type { PlantStatus } from "generated/prisma";

import { Badge } from "~/components/ui/badge";

const STATUS_VARIANT: Record<
  PlantStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  ACTIVE: "default",
  DORMANT: "secondary",
  DEAD: "destructive",
  ARCHIVED: "outline",
};

const STATUS_LABEL: Record<PlantStatus, string> = {
  ACTIVE: "Active",
  DORMANT: "Dormant",
  DEAD: "Dead",
  ARCHIVED: "Archived",
};

export function PlantStatusBadge({ status }: { status: PlantStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
