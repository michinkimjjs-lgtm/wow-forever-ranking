/**
 * 등록된 Gear Profile 목록 (docs/GEAR-PROFILE.md)
 * - beta / live 랭킹에는 APPROVED 프로필만 쓴다. 승인은 실제 장비 데이터를 확인한 뒤에만 한다(명세서 §9.5).
 */
import type { GearProfileInput } from "@/lib/config/schema";
import { foreverDraftGearProfile } from "./forever-draft";
import { mockProvisionalGearProfile } from "./mock-provisional";

export const gearProfiles: GearProfileInput[] = [mockProvisionalGearProfile, foreverDraftGearProfile];
