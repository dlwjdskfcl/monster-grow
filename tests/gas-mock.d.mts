/* eslint-disable */
export function createGas(opts?: { name?: string; clock?: () => number }): {
  ctx: any; active: any; created: any[]; cache: Map<string, unknown>; props: Map<string, string>;
  lock: { busy: boolean; failNext: number }; logs: string[];
  post: (obj: unknown) => any; get: () => any;
};
