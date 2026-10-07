/**
 * HTTP 전송 계층. 테스트에서는 가짜 transport를 넣어 실제 네트워크를 쓰지 않는다.
 */
export interface HttpRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  /** JSON이면 파싱한 값, 아니면 문자열 */
  body: unknown;
}

export interface BlizzardHttpTransport {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export function createFetchTransport(timeoutMs: number): BlizzardHttpTransport {
  return {
    async send(request) {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
      const text = await response.text();
      let body: unknown = text;
      if ((response.headers.get("content-type") ?? "").includes("json")) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body };
    },
  };
}
