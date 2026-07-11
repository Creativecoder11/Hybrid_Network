import { SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return <SkeletonTable rows={5} cols={6} />;
}
