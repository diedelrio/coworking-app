import { useEffect, useMemo, useState } from "react";

const cache = new Map(); // cache simple in-memory

export function usePublicContent(keys = []) {
  const normKeys = useMemo(
    () => Array.from(new Set(keys.filter(Boolean))).sort(),
    [keys]
  );

  const cacheKey = normKeys.join(",");

  const [data, setData] = useState(() => cache.get(cacheKey) || {});
  const [loading, setLoading] = useState(!cache.has(cacheKey));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!normKeys.length) {
      setLoading(false);
      setData({});
      return;
    }

    // cache hit
    if (cache.has(cacheKey)) {
      setLoading(false);
      setData(cache.get(cacheKey));
      return;
    }

    setLoading(true);
    setError(null);

    const qs = encodeURIComponent(normKeys.join(","));
    fetch(`/api/public/content?keys=${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        const payload = json?.content || {};
        cache.set(cacheKey, payload);
        setData(payload);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, normKeys]);

  return { content: data, loading, error };
}
