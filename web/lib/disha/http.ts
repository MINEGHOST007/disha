import { NextResponse } from "next/server";

export class DishaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DishaApiError";
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof DishaApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: "The sandbox could not complete that request." },
    { status: 500 },
  );
}

export async function readJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    throw new DishaApiError("Request body is too large.", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 16_384) {
    throw new DishaApiError("Request body is too large.", 413);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new DishaApiError("Request body must be valid JSON.", 400);
  }
}
