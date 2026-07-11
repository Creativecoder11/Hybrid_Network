"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { setPasswordAction, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} size="lg">
      Activate Account
    </Button>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(setPasswordAction, undefined);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-text-secondary">
          New Password
        </label>
        <Input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters, 1 number"
          icon={<Lock className="size-4" />}
          required
          minLength={8}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="pointer-events-auto text-text-muted hover:text-text-primary"
              tabIndex={-1}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Confirm Password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
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
