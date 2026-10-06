-- Mock 운영 유입 방지 안전장치 (명세서 §6.4)
--
-- 1) database_identity는 한 번 설정하면 바꾸거나 지울 수 없다.
-- 2) 모든 게임 데이터 테이블은 database_identity가 허용하지 않는 data_environment 행을 거부한다.
--    database_identity가 비어 있으면 어떤 게임 데이터도 쓸 수 없다.

CREATE OR REPLACE FUNCTION forbid_database_identity_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'database_identity는 변경하거나 삭제할 수 없습니다.'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER database_identity_immutable
  BEFORE UPDATE OR DELETE ON database_identity
  FOR EACH ROW EXECUTE FUNCTION forbid_database_identity_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_data_environment() RETURNS trigger AS $$
DECLARE
  allowed data_environment[];
BEGIN
  SELECT allowed_data_environments INTO allowed FROM database_identity WHERE id = 1;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'database_identity가 초기화되지 않아 % 테이블에 쓸 수 없습니다.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (NEW.data_environment = ANY(allowed)) THEN
    RAISE EXCEPTION '이 데이터베이스는 % 영역 데이터를 받을 수 없습니다. (테이블: %, 허용: %)',
      NEW.data_environment, TG_TABLE_NAME, allowed
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ingestion_records_env_guard BEFORE INSERT OR UPDATE ON ingestion_records
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER guilds_env_guard BEFORE INSERT OR UPDATE ON guilds
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER guild_external_refs_env_guard BEFORE INSERT OR UPDATE ON guild_external_refs
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER characters_env_guard BEFORE INSERT OR UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER character_external_refs_env_guard BEFORE INSERT OR UPDATE ON character_external_refs
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER items_env_guard BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER character_items_env_guard BEFORE INSERT OR UPDATE ON character_items
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER character_snapshots_env_guard BEFORE INSERT OR UPDATE ON character_snapshots
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
--> statement-breakpoint
CREATE TRIGGER level_milestones_env_guard BEFORE INSERT OR UPDATE ON level_milestones
  FOR EACH ROW EXECUTE FUNCTION enforce_data_environment();
