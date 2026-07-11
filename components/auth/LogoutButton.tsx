"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";

export function LogoutButton({
  className,
  label = "Exit Portal",
}: {
  className?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => logoutAction())}
      disabled={pending}
      className={
        className ??
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-red/10 hover:text-red disabled:opacity-50"
      }
    >
      <LogOut className="size-4.5" />
      {pending ? "Signing out…" : label}
    </button>
  );
}
