import type { ActionResult } from "deepspace/worker";
import { getAuthToken } from "deepspace";

export async function callAction(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const token = await getAuthToken();

  if (!token) {
    return { success: false, error: "Sign in first" };
  }

  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      return { success: false, error: `Request failed: ${res.status}` };
    }

    const data: unknown = await res.json();

    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as { success?: unknown }).success !== "boolean"
    ) {
      return { success: false, error: "Unexpected response from server" };
    }

    return data as ActionResult;
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "An unexpected error occurred",
    };
  }
}
