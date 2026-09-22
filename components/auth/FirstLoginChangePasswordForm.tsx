"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { firstLoginChangePasswordAction, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} size="lg">
      Set Password & Access Dashboard
    </Button>
  );
}

export function FirstLoginChangePasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(firstLoginChangePasswordAction, undefined);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="currentPassword" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Current Temporary Password
        </label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type={showCurrent ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter the temporary password sent via email"
          icon={<KeyRound className="size-4" />}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
              className="pointer-events-auto text-text-muted hover:text-text-primary"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="mb-1.5 block text-xs font-medium text-text-secondary">
          New Permanent Password
        </label>
        <Input
          id="newPassword"
          name="newPassword"
          type={showNew ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters, 1 number"
          icon={<Lock className="size-4" />}
          required
          minLength={8}
          trailing={
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="pointer-events-auto text-text-muted hover:text-text-primary"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Confirm New Password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showNew ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          icon={<Lock className="size-4" />}
          required
          minLength={8}
        />
      </div>

      {state?.error && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-3.5 py-2.5 text-xs text-red">
          {state.error}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

