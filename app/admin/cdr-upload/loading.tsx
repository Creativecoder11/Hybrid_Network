import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <SkeletonTable rows={5} cols={7} />
    </div>
  );
}
