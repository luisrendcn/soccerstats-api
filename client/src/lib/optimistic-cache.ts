import type { QueryClient } from "@tanstack/react-query";

export type QueryKeyPredicate = (queryKey: readonly unknown[]) => boolean;
export type OptimisticSnapshot = Array<{
  queryKey: readonly unknown[];
  data: unknown;
}>;

export function queryKeyStartsWith(
  queryKey: readonly unknown[],
  prefix: readonly unknown[],
) {
  return prefix.every((part, index) => queryKey[index] === part);
}

export async function snapshotOptimisticQueries(
  queryClient: QueryClient,
  predicate: QueryKeyPredicate,
): Promise<OptimisticSnapshot> {
  await queryClient.cancelQueries({
    predicate: (query) => predicate(query.queryKey),
  });

  return queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => predicate(query.queryKey) })
    .map((query) => ({
      queryKey: query.queryKey,
      data: query.state.data,
    }));
}

export function restoreOptimisticQueries(
  queryClient: QueryClient,
  snapshot?: OptimisticSnapshot,
) {
  snapshot?.forEach(({ queryKey, data }) => {
    queryClient.setQueryData(queryKey, data);
  });
}

export function invalidateOptimisticQueries(
  queryClient: QueryClient,
  predicate: QueryKeyPredicate,
) {
  return queryClient.invalidateQueries({
    predicate: (query) => predicate(query.queryKey),
  });
}

export function updateOptimisticQueries(
  queryClient: QueryClient,
  predicate: QueryKeyPredicate,
  updater: (data: unknown, queryKey: readonly unknown[]) => unknown,
) {
  queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => predicate(query.queryKey) })
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (current) =>
        updater(current, query.queryKey),
      );
    });
}

export function removeArrayItemById(data: unknown, id: number) {
  if (!Array.isArray(data)) return data;
  return data.filter((item) => !isObjectWithId(item, id));
}

export function replaceArrayItemById<T extends { id: number }>(
  data: unknown,
  item: T,
) {
  if (!Array.isArray(data)) return data;
  return data.map((current) => (isObjectWithId(current, item.id) ? item : current));
}

export function patchArrayItemById(
  data: unknown,
  id: number,
  patch: Record<string, unknown>,
) {
  if (!Array.isArray(data)) return data;
  return data.map((current) =>
    isObjectWithId(current, id) ? { ...current, ...patch } : current,
  );
}

export function prependUniqueArrayItem<T extends { id: number }>(
  data: unknown,
  item: T,
) {
  if (!Array.isArray(data)) return data;
  if (data.some((current) => isObjectWithId(current, item.id))) {
    return replaceArrayItemById(data, item);
  }
  return [item, ...data];
}

export function isObjectWithId(value: unknown, id: number): value is { id: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    (value as { id: unknown }).id === id
  );
}
