/**
 * Blizzard 인증 (docs/BLIZZARD-API-INTEGRATION-PLAN.md §1)
 *
 * Battle.net 개발자 API는 OAuth client credentials 방식을 쓴다.
 * WoW: Forever API가 같은 방식을 쓰는지는 확인 필요다. 그래서 인증은 인터페이스로 분리하고,
 * 토큰 URL은 설정(BLIZZARD_OAUTH_TOKEN_URL)에서만 받는다.
 */
import { ProviderNotConfiguredError } from "../types";
import type { BlizzardProviderConfig } from "./config";
import { BlizzardApiError, errorForStatus } from "./errors";
import type { BlizzardHttpTransport } from "./transport";

export interface BlizzardAuth {
  getAccessToken(): Promise<string>;
}

/** 토큰 만료 전 여유 시간 */
const EXPIRY_MARGIN_MS = 60_000;

export class ClientCredentialsAuth implements BlizzardAuth {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: BlizzardProviderConfig,
    private readonly transport: BlizzardHttpTransport,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getAccessToken(): Promise<string> {
    const nowMs = this.now().getTime();
    if (this.token && this.token.expiresAt - EXPIRY_MARGIN_MS > nowMs) return this.token.value;

    const { oauthTokenUrl, clientId, clientSecret } = this.config;
    if (!oauthTokenUrl || !clientId || !clientSecret) {
      throw new ProviderNotConfiguredError("Blizzard 인증 설정이 없습니다.");
    }
    const response = await this.transport.send({
      method: "POST",
      url: oauthTokenUrl,
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (response.status !== 200) throw errorForStatus(response.status);
    const body = response.body as { access_token?: unknown; expires_in?: unknown } | null;
    if (typeof body?.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new BlizzardApiError("Blizzard 인증 응답 형식이 올바르지 않습니다.", response.status, false);
    }
    this.token = { value: body.access_token, expiresAt: nowMs + body.expires_in * 1000 };
    return this.token.value;
  }
}
