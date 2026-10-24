"use client";

import { useState, useRef, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Trash2, Upload, Loader2, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { updateAvatarAction, removeAvatarAction } from "@/lib/actions/profile";

export function ProfileAvatarForm({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentAvatar = previewUrl || user.avatarUrl || null;
  const hasCustomAvatar = Boolean(user.avatarUrl);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPG, PNG, WEBP, or GIF).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleCancelPreview() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSaveAvatar() {
    if (!selectedFile) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("avatar", selectedFile);

      const res = await updateAvatarAction(undefined, formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success || "Profile picture updated.");
        setSelectedFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  function handleRemoveAvatar() {
    startTransition(async () => {
      const res = await removeAvatarAction();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(res?.success || "Profile picture removed.");
        handleCancelPreview();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {/* Avatar with Camera Trigger Overlay */}
        <div className="relative group">
          <div className="size-20 overflow-hidden rounded-full ring-2 ring-line-soft transition-all group-hover:ring-accent-green">
            <Avatar name={user.name} src={currentAvatar} size="lg" className="size-20 text-xl font-bold" />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:pointer-events-none"
            aria-label="Upload photo"
            title="Change photo"
          >
            <Camera className="size-6 text-text-primary" />
          </button>
        </div>

        {/* User Info */}
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-text-primary">{user.name}</p>
          <p className="truncate text-xs text-text-muted">{user.email}</p>
          <p className="mt-1 text-[11px] text-text-muted">
            PNG, JPG or WEBP up to 5MB.
          </p>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedFile ? (
          <>
            <Button
              type="button"
              onClick={handleSaveAvatar}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save Photo
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancelPreview}
              disabled={isPending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="gap-1.5"
            >
              <Upload className="size-3.5" />
              Upload Photo
            </Button>

            {hasCustomAvatar && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemoveAvatar}
                disabled={isPending}
                className="gap-1.5 text-text-muted hover:text-red hover:bg-red/10"
                title="Remove profile picture"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Remove
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
