import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-4xl space-y-6">
      <Skeleton className="h-8 w-64" />
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}
