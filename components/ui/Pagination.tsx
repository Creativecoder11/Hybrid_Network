"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Select } from "@/components/ui/Select";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pageNumbers = () => {
    const nums: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        nums.push(i);
      } else if (nums[nums.length - 1] !== "...") {
        nums.push("...");
      }
    }
    return nums;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-text-muted sm:flex-row">
      <div className="flex items-center gap-3">
        <span>
          Showing {from} to {to} of {total} results
        </span>
        {onPageSizeChange && (
          <div>
            <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 w-auto py-0 text-xs"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="flex size-7 items-center justify-center rounded-lg border border-line disabled:opacity-40 hover:bg-surface-raised"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        {pageNumbers().map((n, i) =>
          n === "..." ? (
            <span key={`dots-${i}`} className="px-1.5">
              &hellip;
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg border text-xs",
                n === page
                  ? "border-accent-green bg-accent-green/15 text-accent-green font-semibold"
                  : "border-line hover:bg-surface-raised"
              )}
            >
              {n}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="flex size-7 items-center justify-center rounded-lg border border-line disabled:opacity-40 hover:bg-surface-raised"
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
