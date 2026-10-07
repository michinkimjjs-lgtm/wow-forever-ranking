-- 정적 게임 데이터 안전장치 (Phase 2C, docs/STATIC-GAME-DATA.md)
--
-- 1) 영역 쓰기 트리거: database_identity가 허용하지 않는 data_environment 행을 거부한다 (0002와 같은 함수).
-- 2) 버전 보존: 한 번 저장한 데이터셋과 레코드는 수정할 수 없다. 새 빌드·새 버전은 새 데이터셋으로 추가한다.
--    실제 영역(beta / live)의 데이터셋은 삭제도 할 수 없다. mock 영역은 개발용 초기화를 위해 삭제를 허용한다.

CREATE TRIGGER static_datasets_env_guard BEFORE INSERT OR UPDATE ON static_datasets
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER static_data_records_env_guard BEFORE INSERT OR UPDATE ON static_data_records
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_static_data_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '정적 데이터(%)는 수정할 수 없습니다. 새 datasetVersion으로 추가해야 합니다.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.data_environment <> 'mock' THEN
    RAISE EXCEPTION '실제 영역의 정적 데이터(%)는 삭제할 수 없습니다.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER static_datasets_immutable BEFORE UPDATE OR DELETE ON static_datasets
  FOR EACH ROW EXECUTE FUNCTION forbid_static_data_change();
--> statement-breakpoint
CREATE TRIGGER static_data_records_immutable BEFORE UPDATE OR DELETE ON static_data_records
  FOR EACH ROW EXECUTE FUNCTION forbid_static_data_change();
