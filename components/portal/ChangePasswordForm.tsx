"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { changePasswordAction } from "@/lib/actions/profile";
import type { ActionState } from "@/lib/actions/customers";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Update Password
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(changePasswordAction, undefined);
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <Label required>Current Password</Label>
        <Input
          name="currentPassword"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          icon={<Lock className="size-4" />}
          required
        />
      </div>
      <div>
        <Label required>New Password</Label>
        <Input
          name="newPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          icon={<Lock className="size-4" />}
          placeholder="At least 8 characters, 1 number"
          required
          minLength={8}
        />
      </div>
      <div>
        <Label required>Confirm New Password</Label>
        <Input
          name="confirmPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          icon={<Lock className="size-4" />}
          required
          minLength={8}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-3.5" />
        Show passwords
      </label>
      <SubmitButton />
    </form>
  );
}
