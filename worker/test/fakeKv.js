// In-memory stand-in for a Workers KV namespace (get/put with expirationTtl).
export function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(key, type) {
      if (!store.has(key)) return null;
      const v = store.get(key).value;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(key, value, opts) {
      store.set(key, { value: String(value), ttl: opts?.expirationTtl });
    },
  };
}
