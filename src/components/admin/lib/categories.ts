import { localize } from "@/lib/i18n-string";
import type { CategoryNode } from "@/lib/types/domain";

export interface FlatCategory {
  id: string;
  label: string;
  depth: number;
  node: CategoryNode;
}

/** Depth-first flattening of the category tree with an indented, localised label for <select> options. */
export function flattenCategories(tree: CategoryNode[], locale: string): FlatCategory[] {
  const out: FlatCategory[] = [];
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ id: node.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${localize(node.name, locale)}`, depth, node });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}
