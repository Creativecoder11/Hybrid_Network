"use client";

import { Mail, Phone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function PayNowModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Payment Instructions"
      description="Online payment isn't available yet — please pay via one of the methods below."
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-sm text-text-secondary">
        <p>To settle your bill, please make a bank transfer using the details provided by your account manager, or contact our billing team directly.</p>
        <div className="space-y-2 rounded-xl border border-line bg-surface-raised p-4">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-accent-green" />
            <span>billing@hybridnetworks.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="size-4 text-accent-green" />
            <span>+60 3-2145 8890</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
