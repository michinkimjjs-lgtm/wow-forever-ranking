-- 웹 직접 등록(user_submission)을 제출 검토 표에 보관할 수 있도록 출처 제약을 넓힌다.
-- 기존 행은 모두 addon이므로 바뀌지 않는다. 데이터 삭제·변경 없음 (docs/DATA-COLLECTION-STRATEGY.md §2).
ALTER TABLE "character_submissions" DROP CONSTRAINT "character_submissions_source";--> statement-breakpoint
ALTER TABLE "character_submissions" ADD CONSTRAINT "character_submissions_source" CHECK (data_source IN ('addon', 'user_submission'));