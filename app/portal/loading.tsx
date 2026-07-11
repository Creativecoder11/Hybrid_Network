import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl lg:col-span-1" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
