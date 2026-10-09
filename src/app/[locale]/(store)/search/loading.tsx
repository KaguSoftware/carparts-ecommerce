import { ListingSkeleton } from "@/components/store/catalog/ListingSkeleton";

export default async function Loading() {
  return <ListingSkeleton hero={false} />;
}
