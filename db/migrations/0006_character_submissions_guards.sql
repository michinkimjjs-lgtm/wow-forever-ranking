-- 캐릭터 제출 안전장치 (Phase 3A, docs/SUBMISSION-SYSTEM.md)
-- 영역 쓰기 트리거: database_identity가 허용하지 않는 영역의 행을 거부한다 (0002와 같은 함수).
-- CHECK 제약(0005)으로 mock 영역 금지, 공급원 addon, 검증 상태 COMMUNITY_SUBMITTED, 공개 제출의 동의 기록을 강제한다.

CREATE TRIGGER character_submissions_env_guard BEFORE INSERT OR UPDATE ON character_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
