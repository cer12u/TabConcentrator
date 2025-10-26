import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

let csrfToken: string | null = null;

async function fetchCSRFToken(forceRefresh = false): Promise<string> {
  if (csrfToken && !forceRefresh) return csrfToken;
  
  try {
    const res = await fetch("/api/csrf-token", {
      credentials: "include",
    });
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken!;
  } catch (error) {
    console.error("Failed to fetch CSRF token:", error);
    return "";
  }
}

// Reset CSRF token cache (call after logout)
export function resetCSRFToken() {
  csrfToken = null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = undefined;
    let message = text || res.statusText;

    if (text) {
      try {
        parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          const maybeMessage = (parsed as Record<string, unknown>).error ??
            (parsed as Record<string, unknown>).message;
          if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
            message = maybeMessage;
          } else {
            message = text;
          }
        }
      } catch {
        // ignore JSON parse errors, fall back to raw text
      }
    }

    const payload = parsed !== undefined ? parsed : (text || undefined);
    throw new ApiError(res.status, message || res.statusText, payload);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = await fetchCSRFToken();
  
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "X-CSRF-Token": token } : {}),
  };
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If 403, try refreshing CSRF token once
  if (res.status === 403 && token) {
    const newToken = await fetchCSRFToken(true);
    const retryHeaders = {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(newToken ? { "X-CSRF-Token": newToken } : {}),
    };
    
    const retryRes = await fetch(url, {
      method,
      headers: retryHeaders,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    await throwIfResNotOk(retryRes);
    return retryRes;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
