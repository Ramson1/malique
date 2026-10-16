"use client";

import { Printer } from "lucide-react";
import { Button, type ButtonProps } from "./button";

export interface PrintButtonProps extends Omit<ButtonProps, "onClick"> {
  label?: string;
  variant?: ButtonProps["variant"];
}

/**
 * Prints the current dashboard page. The browser print dialog is opened via
 * window.print(); print stylesheet rules in globals.css strip the app chrome
 * (sidebar, top bar, buttons, filters) and expand the content area so tables
 * and cards print cleanly on paper. A letterhead block (print-only in the
 * dashboard layout) supplies the page title/date on the printed sheet.
 */
export function PrintButton({ label = "Print", variant = "outline", ...rest }: PrintButtonProps) {
  function handlePrint() {
    // Use the app title as the suggested print/PDF filename.
    const original = document.title;
    document.title = `${original} — Malique Oil & Gas`;
    const restore = () => {
      document.title = original;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <Button
      type="button"
      variant={variant}
      leftIcon={<Printer className="w-4 h-4" />}
      onClick={handlePrint}
      {...rest}
    >
      {label}
    </Button>
  );
}
