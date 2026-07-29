"use client";

// shadcn calendar (https://ui.shadcn.com/docs/components/calendar) wired up
// as a visual date-picking affordance next to a native
// <input type="datetime-local">. The native input stays the source of
// truth — it's still directly typeable/keyboard-accessible and keeps its
// existing "yyyy-MM-ddTHH:mm" value contract — the calendar just writes the
// date portion of that same value when a day is clicked, preserving
// whatever time is already set.
import { forwardRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function parseLocalValue(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const DateTimePicker = forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { onValueChange?: (value: string) => void }
>(function DateTimePicker(
  {
    value,
    onChange,
    onValueChange,
    disabled,
    className,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const stringValue = typeof value === "string" ? value : "";
  const selected = parseLocalValue(stringValue);

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    const next = new Date(day);
    if (selected) {
      // Keep whatever time was already set — picking a day shouldn't
      // silently reset the hour/minute the user already chose.
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    onValueChange?.(toLocalValue(next));
    setOpen(false);
  }

  return (
    <div className="flex gap-2">
      <Input
        ref={ref}
        type="datetime-local"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={className}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        {...props}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label="Pick a date from the calendar"
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
            >
              <CalendarIcon className="size-4" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={handleDaySelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
});
