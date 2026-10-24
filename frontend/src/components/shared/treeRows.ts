import { useMemo } from 'react';

/**
 * Tree rows for a flat DataGrid (the pattern of RolesTable and
 * ChartOfAccountsTree): items with parent ids become the rows a grid shows,
 * each with its level, whether it has children and whether it is expanded.
 * Items keep their order within a parent; children follow their parent.
 */
export interface TreeRow<T> {
  item: T;
  id: string;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function buildTreeRows<T>(
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null,
  expanded: Set<string>,
  /** Rows that have children not among `items` (e.g. loaded on demand). */
  expandable?: (item: T) => boolean
): TreeRow<T>[] {
  const ids = new Set(items.map(getId));
  const children = new Map<string | null, T[]>();
  items.forEach((item) => {
    const parent = getParentId(item);
    const key = parent && ids.has(parent) ? parent : null;
    children.set(key, [...(children.get(key) ?? []), item]);
  });

  const rows: TreeRow<T>[] = [];
  const visit = (parent: string | null, level: number) => {
    (children.get(parent) ?? []).forEach((item) => {
      const id = getId(item);
      const hasChildren = (children.get(id)?.length ?? 0) > 0 || (expandable?.(item) ?? false);
      const isExpanded = hasChildren && expanded.has(id);
      rows.push({ item, id, level, hasChildren, expanded: isExpanded });
      if (isExpanded) visit(id, level + 1);
    });
  };
  visit(null, 0);
  return rows;
}

export function useTreeRows<T>(
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null,
  expanded: Set<string>,
  expandable?: (item: T) => boolean
): TreeRow<T>[] {
  // The accessors are expected to be stable (module-level or memoized).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildTreeRows(items, getId, getParentId, expanded, expandable), [items, expanded, expandable]);
}
