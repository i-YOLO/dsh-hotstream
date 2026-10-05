import {admissionOf} from "./admission.ts";
export function protocolOf(sourceKey: string, meta: Record<string, unknown>): string {
  const tag =
    meta.intelligenceIndexVersion !== undefined
      ? `intelligenceIndexVersion=${meta.intelligenceIndexVersion}`
      : meta.editionId !== undefined
        ? `editionId=${meta.editionId}${meta.datasetVersion !== undefined ? `;datasetVersion=${meta.datasetVersion}` : ""}`
        : meta.release !== undefined && String(sourceKey).startsWith("livebench")
          ? `release=${meta.release}`
          : meta.benchmarkVersion !== undefined
            ? `benchmarkVersion=${meta.benchmarkVersion}`
            : meta.benchmarkFile !== undefined
              ? `benchmarkFile=${meta.benchmarkFile}`
              : "published-schema";
  const audited = admissionOf(sourceKey, { metadata: meta });
  return `${audited.protocolId ?? sourceKey}:single-model-v16:protocolVersion=${audited.version ?? "unversioned"}:${tag}`;
}
