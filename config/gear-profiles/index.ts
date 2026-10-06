/**
 * 등록된 Gear Profile 목록.
 * beta / live용 APPROVED 프로필은 실제 장비 구조가 확인된 뒤에만 추가한다(명세서 §9.5).
 */
import type { GearProfileInput } from "@/lib/config/schema";
import { mockProvisionalGearProfile } from "./mock-provisional";

export const gearProfiles: GearProfileInput[] = [mockProvisionalGearProfile];
