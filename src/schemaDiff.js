// Schema 快照与 Diff（对齐 ObjectAnalyzer 的 SchemaDiff 三件套）

export function toSchemaSnapshot(result, source = '') {
  return {
    snapshotVersion: 1,
    createdAt: new Date().toISOString(),
    source,
    fields: result.fieldStatistics.map((f) => ({
      path: f.fieldName,
      primaryType: f.primaryType,
      semanticType: f.semanticType ?? null,
      nullable: f.nullAppeared,
      coverage: f.coverage,
      minNumber: f.min ?? null,
      maxNumber: f.max ?? null,
      distinctCount: f.distinctCount,
    })),
  };
}

function toMap(snapshot) {
  return new Map(snapshot.fields.map((f) => [f.path, f]));
}

// baseline / current 均为 toSchemaSnapshot 产物
export function diffSnapshots(baseline, current) {
  const baseMap = toMap(baseline);
  const curMap = toMap(current);
  const addedFields = [];
  const removedFields = [];
  const changedFields = [];

  for (const [path, cur] of curMap) {
    if (!baseMap.has(path)) { addedFields.push(cur); continue; }
    const base = baseMap.get(path);
    const changes = [];
    if (base.primaryType !== cur.primaryType) {
      changes.push({
        property: 'primaryType', breaking: true,
        description: `主导类型 ${base.primaryType} → ${cur.primaryType}`,
      });
    }
    if ((base.semanticType ?? null) !== (cur.semanticType ?? null)) {
      changes.push({
        property: 'semanticType', breaking: false,
        description: `语义类型 ${base.semanticType ?? '无'} → ${cur.semanticType ?? '无'}`,
      });
    }
    if (!base.nullable && cur.nullable) {
      changes.push({
        property: 'nullable', breaking: true,
        description: '由非空变为可空（可能出现 null）',
      });
    }
    const covDelta = cur.coverage - base.coverage;
    if (Math.abs(covDelta) >= 0.01) {
      changes.push({
        property: 'coverage', breaking: covDelta <= -0.2,
        description: `覆盖率 ${(base.coverage * 100).toFixed(1)}% → ${(cur.coverage * 100).toFixed(1)}%`,
      });
    }
    if (base.minNumber !== cur.minNumber || base.maxNumber !== cur.maxNumber) {
      const tightened =
        (cur.minNumber ?? -Infinity) > (base.minNumber ?? -Infinity) ||
        (cur.maxNumber ?? Infinity) < (base.maxNumber ?? Infinity);
      changes.push({
        property: 'range', breaking: tightened,
        description: `数值范围 [${base.minNumber ?? '-'}, ${base.maxNumber ?? '-'}] → [${cur.minNumber ?? '-'}, ${cur.maxNumber ?? '-'}]`,
      });
    }
    if (changes.length > 0) {
      changedFields.push({
        path,
        breaking: changes.some((c) => c.breaking),
        changes,
      });
    }
  }
  for (const [path, base] of baseMap) {
    if (!curMap.has(path)) removedFields.push(base);
  }

  return {
    baselineSource: baseline.source || '基线快照',
    currentSource: current.source || '当前数据',
    hasBreakingChanges: removedFields.length > 0 || changedFields.some((f) => f.breaking),
    addedFields,
    removedFields,
    changedFields,
  };
}
