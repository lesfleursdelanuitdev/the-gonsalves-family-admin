/**
 * Shared fetch helpers for client-side React Query hooks.
 * All throw on non-2xx responses with the server error message.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function fetchJson<T>(url: string): Promise<T> {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[fetchJson] GET", typeof window !== "undefined" ? `${window.location.origin}${url}` : url);
  }
  const res = await fetch(url, { credentials: "include" });
  return handleResponse<T>(res);
}

export async function postFormData<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return handleResponse<T>(res);
}

/** Bytes sent toward the server for the multipart body (when known). */
export type FormDataUploadProgress = {
  loaded: number;
  total: number | null;
};

/**
 * POST multipart `FormData` with upload progress via `XMLHttpRequest`
 * (`fetch` does not expose upload progress).
 */
export function postFormDataWithUploadProgress<T>(
  url: string,
  formData: FormData,
  onProgress?: (p: FormDataUploadProgress) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      onProgress?.({
        loaded: e.loaded,
        total: e.lengthComputable ? e.total : null,
      });
    };

    xhr.onload = () => {
      const status = xhr.status;
      if (status >= 200 && status < 300) {
        if (status === 204) {
          resolve(undefined as T);
          return;
        }
        resolve(xhr.response as T);
        return;
      }
      let msg = xhr.statusText || `HTTP ${status}`;
      const body = xhr.response;
      if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
        msg = (body as { error: string }).error;
      } else if (xhr.responseText) {
        try {
          const j = JSON.parse(xhr.responseText) as { error?: string };
          if (typeof j.error === "string") msg = j.error;
        } catch {
          /* keep msg */
        }
      }
      reject(new ApiError(status, msg));
    };

    xhr.onerror = () => {
      reject(new ApiError(0, "Network error"));
    };

    xhr.onabort = () => {
      reject(new ApiError(0, "Upload aborted"));
    };

    xhr.send(formData);
  });
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const safe = body && typeof body === "object" && "password" in body
      ? { ...body, password: "(redacted)" }
      : body;
    console.log("[postJson] POST", fullUrl, safe);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[postJson] Response", res.status, res.statusText, url);
  }
  return handleResponse<T>(res);
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function deleteJson<T = void>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  return handleResponse<T>(res);
}
