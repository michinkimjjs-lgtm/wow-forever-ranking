/**
 * 정적 데이터 importer (docs/STATIC-GAME-DATA.md §4)
 *
 * 처리 순서: 검증 → 영역 / 이용 조건 확인 → 같은 버전 확인 → 저장(트랜잭션)
 *
 * - dataEnvironment는 서버 설정(생성자 인자)이 부여한다. 데이터셋 파일의 값을 믿지 않는다.
 * - mock 영역에는 mock 데이터셋만, 실제 영역에는 이용 조건을 확인한(PERMITTED) 데이터셋만 넣는다.
 * - 같은 (영역, 종류, 공급원, datasetVersion)이 이미 있으면
 *   내용(checksum)이 같을 때는 아무것도 하지 않고(UNCHANGED), 다르면 거부한다. 덮어쓰지 않는다.
 * - 새 빌드 / 새 버전은 새 데이터셋으로 추가된다. 이전 데이터셋은 그대로 남는다.
 */
import { and, eq } from "drizzle-orm";
import { staticDataRecords, staticDatasets } from "@/db/schema";
import type { AppDatabase } from "@/db/types";
import type { DataEnvironment } from "@/lib/domain/enums";
import type { StaticDatasetMeta } from "./schema";
import { validateStaticDataset, type StaticDataIssue, type StaticDataReferences, type ValidatedRecord } from "./validate";

export interface StaticDataImportResult {
  status: "IMPORTED" | "UNCHANGED" | "REJECTED";
  datasetId: string | null;
  recordCount: number;
  issues: StaticDataImportIssue[];
}

export type StaticDataImportIssue =
  | StaticDataIssue
  | {
      severity: "error";
      code: "MOCK_ISOLATION" | "LICENSE_NOT_CONFIRMED" | "DATASET_VERSION_CONFLICT";
      message: string;
    };

export interface StaticDataImporter {
  importDataset(input: unknown, options?: { references?: StaticDataReferences }): Promise<StaticDataImportResult>;
}

const INSERT_BATCH = 1000;

/** DB 없이 확인할 수 있는 영역·이용 조건 규칙 */
export function checkImportPolicy(meta: StaticDatasetMeta, dataEnvironment: DataEnvironment): StaticDataImportIssue[] {
  const issues: StaticDataImportIssue[] = [];
  const envIsMock = dataEnvironment === "mock";
  if (envIsMock !== (meta.source === "mock")) {
    issues.push({
      severity: "error",
      code: "MOCK_ISOLATION",
      message: envIsMock
        ? "mock 영역에는 mock 데이터셋만 넣을 수 있습니다."
        : `${dataEnvironment} 영역에는 mock 데이터셋을 넣을 수 없습니다.`,
    });
  }
  if (!envIsMock && meta.license.status !== "PERMITTED") {
    issues.push({
      severity: "error",
      code: "LICENSE_NOT_CONFIRMED",
      message: `이용 조건이 확인되지 않은 데이터셋(${meta.license.status})은 저장하지 않습니다.`,
    });
  }
  return issues;
}

export class DatabaseStaticDataImporter implements StaticDataImporter {
  constructor(
    private readonly db: AppDatabase,
    private readonly dataEnvironment: DataEnvironment,
  ) {}

  async importDataset(input: unknown, options: { references?: StaticDataReferences } = {}): Promise<StaticDataImportResult> {
    const validation = validateStaticDataset(input, options);
    if (!validation.ok) return { status: "REJECTED", datasetId: null, recordCount: 0, issues: validation.issues };

    const { meta, records, checksum } = validation;
    const policyIssues = checkImportPolicy(meta, this.dataEnvironment);
    if (policyIssues.length > 0) {
      return { status: "REJECTED", datasetId: null, recordCount: 0, issues: [...validation.issues, ...policyIssues] };
    }

    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: staticDatasets.id, checksum: staticDatasets.checksum, recordCount: staticDatasets.recordCount })
        .from(staticDatasets)
        .where(
          and(
            eq(staticDatasets.dataEnvironment, this.dataEnvironment),
            eq(staticDatasets.kind, meta.kind),
            eq(staticDatasets.source, meta.source),
            eq(staticDatasets.datasetVersion, meta.datasetVersion),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.checksum === checksum) {
          return { status: "UNCHANGED", datasetId: existing.id, recordCount: existing.recordCount, issues: validation.issues };
        }
        return {
          status: "REJECTED",
          datasetId: existing.id,
          recordCount: 0,
          issues: [
            ...validation.issues,
            {
              severity: "error",
              code: "DATASET_VERSION_CONFLICT",
              message: `datasetVersion ${meta.datasetVersion}이(가) 이미 다른 내용으로 저장되어 있습니다. 새 버전으로 가져와야 합니다.`,
            },
          ],
        };
      }

      const [dataset] = await tx
        .insert(staticDatasets)
        .values({
          dataEnvironment: this.dataEnvironment,
          kind: meta.kind,
          source: meta.source,
          sourceVersion: meta.sourceVersion,
          sourceBuild: meta.sourceBuild,
          interfaceVersion: meta.interfaceVersion,
          datasetVersion: meta.datasetVersion,
          observedAt: meta.observedAt,
          licenseStatus: meta.license.status,
          licenseTermsUrl: meta.license.termsUrl,
          licenseCheckedAt: meta.license.checkedAt,
          attribution: meta.license.attribution,
          checksum,
          recordCount: records.length,
        })
        .returning({ id: staticDatasets.id });
      await insertRecords(tx, dataset!.id, this.dataEnvironment, meta, records);
      return { status: "IMPORTED", datasetId: dataset!.id, recordCount: records.length, issues: validation.issues };
    });
  }
}

async function insertRecords(
  tx: AppDatabase,
  datasetId: string,
  dataEnvironment: DataEnvironment,
  meta: StaticDatasetMeta,
  records: ValidatedRecord[],
): Promise<void> {
  for (let i = 0; i < records.length; i += INSERT_BATCH) {
    await tx.insert(staticDataRecords).values(
      records.slice(i, i + INSERT_BATCH).map((r) => ({
        datasetId,
        dataEnvironment,
        kind: meta.kind,
        recordKey: r.key,
        data: r.data,
      })),
    );
  }
}
