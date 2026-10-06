"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Last 30 days" or a calendar month + year, kept in ?month=MM&year=YYYY. */
export function UsagePeriodFilter({ month, year, years }: { month: number | null; year: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const now = new Date();

  function go(nextMonth: number | null, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMonth === null) {
      params.delete("month");
      params.delete("year");
    } else {
      // Don't land on a month that hasn't started yet.
      const latest = nextYear === now.getFullYear() ? now.getMonth() + 1 : 12;
      params.set("month", String(Math.min(nextMonth, latest)));
      params.set("year", String(nextYear));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        aria-label="Month"
        value={month === null ? "last30" : String(month)}
        onChange={(e) => go(e.target.value === "last30" ? null : Number(e.target.value), year)}
        className="sm:w-44"
      >
        <option value="last30">Last 30 days</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1} disabled={year === now.getFullYear() && i > now.getMonth()}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Year"
        value={String(year)}
        onChange={(e) => go(month ?? now.getMonth() + 1, Number(e.target.value))}
        className="sm:w-28"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}
