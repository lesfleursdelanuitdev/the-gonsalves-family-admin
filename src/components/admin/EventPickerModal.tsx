"use client";

import { useState } from "react";
import { CalendarSearch } from "lucide-react";
import { EventPicker, type EventPickerProps } from "@/components/admin/EventPicker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";

type EventPickerModalProps = {
  onPick: (event: AdminEventListItem) => void;
  excludeEventIds?: Set<string>;
  triggerLabel?: string;
  disabled?: boolean;
  /** Passed through to EventPicker. */
  requireEventType?: EventPickerProps["requireEventType"];
  formatRowLabel?: EventPickerProps["formatRowLabel"];
  limit?: EventPickerProps["limit"];
};

export function EventPickerModal({
  onPick,
  excludeEventIds,
  triggerLabel = "Choose event",
  disabled,
  requireEventType,
  formatRowLabel,
  limit,
}: EventPickerModalProps) {
  const [open, setOpen] = useState(false);

  const [eventType, setEventType] = useState("");
  const [linkScope, setLinkScope] = useState<"individual" | "family">("individual");
  const [indGiven, setIndGiven] = useState("");
  const [indLast, setIndLast] = useState("");
  const [famP1Given, setFamP1Given] = useState("");
  const [famP1Last, setFamP1Last] = useState("");
  const [famP2Given, setFamP2Given] = useState("");
  const [famP2Last, setFamP2Last] = useState("");

  const resetSearch = () => {
    setEventType("");
    setLinkScope("individual");
    setIndGiven("");
    setIndLast("");
    setFamP1Given("");
    setFamP1Last("");
    setFamP2Given("");
    setFamP2Last("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetSearch();
  };

  const handlePick = (event: AdminEventListItem) => {
    onPick(event);
    handleOpenChange(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <CalendarSearch className="size-3.5" aria-hidden />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Find an event</DialogTitle>
          <DialogDescription>
            Filter by event type and person or family name, then select a result.
          </DialogDescription>
          <EventPicker
            idPrefix="event-picker-modal"
            requireEventType={requireEventType}
            eventType={eventType}
            onEventTypeChange={setEventType}
            linkScope={linkScope}
            onLinkScopeChange={setLinkScope}
            indGiven={indGiven}
            indLast={indLast}
            onIndGivenChange={setIndGiven}
            onIndLastChange={setIndLast}
            famP1Given={famP1Given}
            famP1Last={famP1Last}
            famP2Given={famP2Given}
            famP2Last={famP2Last}
            onFamP1GivenChange={setFamP1Given}
            onFamP1LastChange={setFamP1Last}
            onFamP2GivenChange={setFamP2Given}
            onFamP2LastChange={setFamP2Last}
            onPick={handlePick}
            excludeEventIds={excludeEventIds}
            formatRowLabel={formatRowLabel}
            limit={limit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
