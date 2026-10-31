import { verifyStartup } from "@/lib/server/context";
import { isDesignPreviewDeployment } from "@/lib/server/design-preview";

// 디자인 확인용 Vercel Preview 배포(APP_DATA_ENVIRONMENT 없음)만 DB에 연결하지 않는다.
// Production·로컬을 포함한 그 밖의 배포는 항상 설정과 DB 식별 표식을 검사한다.
if (!isDesignPreviewDeployment()) {
  await verifyStartup();
}
