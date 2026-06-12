"use client";

import { useState } from "react";
import { EventType } from "generated/prisma";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const TYPE_LABEL: Record<EventType, string> = {
  SOW: "Sowed",
  GERMINATE: "Germinated",
  TRANSPLANT: "Transplanted",
  HARVEST: "Harvested",
  DEATH: "Died",
  NOTE: "Note",
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EventTimeline({
  workspaceId,
  plantId,
  canEdit,
}: {
  workspaceId: string;
  plantId: string;
  canEdit: boolean;
}) {
  const utils = api.useUtils();
  const events = api.event.list.useQuery({ workspaceId, plantId });

  const [type, setType] = useState<EventType>(EventType.SOW);
  const [date, setDate] = useState(todayInputValue);
  const [notes, setNotes] = useState("");

  const create = api.event.create.useMutation({
    onSuccess: () => {
      setNotes("");
      void utils.event.list.invalidate({ workspaceId, plantId });
    },
  });

  const remove = api.event.delete.useMutation({
    onSuccess: () => {
      void utils.event.list.invalidate({ workspaceId, plantId });
    },
  });

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (date === "") return;
    create.mutate({
      workspaceId,
      plantId,
      type,
      occurredAt: new Date(date),
      notes: notes.trim() === "" ? undefined : notes.trim(),
    });
  };

  const list = events.data ?? [];

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          onSubmit={onAdd}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <Select
            value={type}
            onValueChange={(v) => setType(v as EventType)}
            disabled={create.isPending}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(EventType).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={create.isPending}
            className="w-full sm:w-40"
          />
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            disabled={create.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={create.isPending || date === ""}>
            {create.isPending ? "Adding..." : "Add"}
          </Button>
        </form>
      )}

      {create.error && (
        <p className="text-destructive text-sm">{create.error.message}</p>
      )}

      {events.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">No events recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((event) => (
            <li
              key={event.id}
              className="border-muted flex items-start justify-between gap-3 border-l-2 py-1 pl-3"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{TYPE_LABEL[event.type]}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {event.occurredAt.toLocaleDateString()}
                  </span>
                </p>
                {event.notes && (
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {event.notes}
                  </p>
                )}
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({ workspaceId, eventId: event.id })
                  }
                >
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
