import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-72 w-full rounded-2xl" />
      <SkeletonTable rows={6} cols={3} />
    </div>
  );
}
