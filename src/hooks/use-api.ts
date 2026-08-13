"use client";

import * as React from "react";

export function useApi<T>(url: string) {
  const [data, setData] = React.useState<T | undefined>();
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setData(undefined);

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json() as Promise<T>;
      })
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch(() => {
        if (!cancelled) setData(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [url, version]);

  return {
    data,
    refetch: () => setVersion((current) => current + 1),
  };
}
