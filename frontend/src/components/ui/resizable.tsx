"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

// v4 of react-resizable-panels uses Group, Panel, Separator
// The Group component sets flex-direction via inline styles based on orientation prop
// Data attributes: data-group, data-panel, data-separator

function ResizablePanelGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      orientation={orientation}
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({ className, ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel className={cn("overflow-hidden", className)} {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  orientation,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
  orientation?: "horizontal" | "vertical";
}) {
  const isVertical = orientation === "vertical";

  return (
    <Separator
      className={cn(
        "relative flex items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
        isVertical
          ? "h-px w-full cursor-row-resize"
          : "w-px h-full cursor-col-resize",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            "z-10 flex items-center justify-center rounded-sm border bg-border",
            isVertical ? "h-3 w-4 rotate-90" : "h-4 w-3"
          )}
        >
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
