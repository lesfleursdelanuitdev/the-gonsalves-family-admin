"use client";

import * as React from "react";
import {
  Dialog as DialogPrimitive,
  type DialogRootProps,
} from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

const Dialog = ({
  open,
  onOpenChange,
  ...props
}: DialogRootProps) => (
  <DialogPrimitive.Root
    open={open}
    onOpenChange={(next, details) => onOpenChange?.(next, details)}
    {...props}
  />
);

const DialogPortal = DialogPrimitive.Portal;

const DialogBackdrop = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:animate-in data-[open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogBackdrop.displayName = "DialogBackdrop";

const DialogViewport = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 flex min-h-full w-full items-center justify-center p-4",
      className
    )}
    {...props}
  />
));
DialogViewport.displayName = "DialogViewport";

const DialogPopup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Popup
    ref={ref}
    className={cn(
      "relative z-50 w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl border border-border bg-background shadow-lg p-6",
      "data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
      "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
      className
    )}
    {...props}
  />
));
DialogPopup.displayName = "DialogPopup";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogBackdrop />
    <DialogViewport>
      <DialogPopup ref={ref} className={className} {...props}>
        {children}
      </DialogPopup>
    </DialogViewport>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn(
      "inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
));
DialogClose.displayName = "DialogClose";

export {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogViewport,
  DialogPopup,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
};
