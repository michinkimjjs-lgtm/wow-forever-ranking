-- 역사 기록 삭제 방지 (역사 기록 보존 Phase 1, docs/HISTORY-PRESERVATION.md)
-- 1) 캐릭터 삭제가 character_snapshots / level_milestones를 연쇄 삭제하지 않도록 FK를 ON DELETE RESTRICT로 바꾼다.
--    (level_milestone_evidence는 0007에서 처음부터 RESTRICT) 역사 기록이 있는 캐릭터는 삭제할 수 없다.
-- 2) 행 단위 보호 트리거
--    - level_milestone_evidence: 수정 금지. 실제 영역(beta / live) 삭제 금지.
--    - character_snapshots: 수정 금지(수집 코드는 추가만 한다). 실제 영역 삭제 금지.
--    - level_milestones: 현재 채택 결과라 수집 코드가 갱신한다. 수정은 허용하고 실제 영역 삭제만 금지.
--    - mock 영역은 개발용 초기화(npm run db:seed)를 위해 삭제를 허용한다.
-- 3) TRUNCATE는 행 트리거를 거치지 않으므로 세 테이블 모두 금지한다.
-- 데이터는 바꾸지 않는다. 기존 행은 모두 그대로다.
ALTER TABLE "character_snapshots" DROP CONSTRAINT "character_snapshots_character_fk";
--> statement-breakpoint
ALTER TABLE "level_milestones" DROP CONSTRAINT "level_milestones_character_fk";
--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_milestones" ADD CONSTRAINT "level_milestones_character_fk" FOREIGN KEY ("character_id","data_environment") REFERENCES "public"."characters"("id","data_environment") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_history_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '역사 기록(%)은 수정할 수 없습니다. 새 행으로 추가해야 합니다.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.data_environment <> 'mock' THEN
    RAISE EXCEPTION '실제 영역의 역사 기록(%)은 삭제할 수 없습니다.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_history_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.data_environment <> 'mock' THEN
    RAISE EXCEPTION '실제 영역의 역사 기록(%)은 삭제할 수 없습니다.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_history_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '역사 기록(%)은 TRUNCATE할 수 없습니다.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER level_milestone_evidence_immutable BEFORE UPDATE OR DELETE ON level_milestone_evidence
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();
--> statement-breakpoint
CREATE TRIGGER character_snapshots_immutable BEFORE UPDATE OR DELETE ON character_snapshots
  FOR EACH ROW EXECUTE FUNCTION forbid_history_change();
--> statement-breakpoint
CREATE TRIGGER level_milestones_no_delete BEFORE DELETE ON level_milestones
  FOR EACH ROW EXECUTE FUNCTION forbid_history_delete();
--> statement-breakpoint
CREATE TRIGGER level_milestone_evidence_no_truncate BEFORE TRUNCATE ON level_milestone_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_history_truncate();
--> statement-breakpoint
CREATE TRIGGER character_snapshots_no_truncate BEFORE TRUNCATE ON character_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_history_truncate();
--> statement-breakpoint
CREATE TRIGGER level_milestones_no_truncate BEFORE TRUNCATE ON level_milestones
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_history_truncate();
