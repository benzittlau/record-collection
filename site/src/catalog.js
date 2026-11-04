// Preserve source positions for aliases and geometry; expose only physical items
// to browsing. No DOM or network state belongs to this model.
export function createCatalog(data) {
  const sourceRecords = (data.records ?? data).map((record) => ({
    ...record,
    cover: record.cover ?? record.coverPath ?? null,
    back: record.back ?? record.backPath ?? record.backCover ?? null,
    kind: record.kind ?? "record",
  }));
  const byId = new Map(sourceRecords.map((record) => [record.id, record]));
  const records = sourceRecords.filter((record) => !record.mergedInto);

  function resolveId(id) {
    let record = byId.get(id);
    const seen = new Set();
    while (record?.mergedInto && !seen.has(record.id)) {
      seen.add(record.id);
      record = byId.get(record.mergedInto);
    }
    return record?.id ?? id;
  }

  return {
    records,
    forBox: (box) =>
      records
        .filter((record) => record.box === box)
        .sort((a, b) => a.position - b.position),
    find: (id) => byId.get(resolveId(id)),
    resolveId,
    foldedPositions: (id) =>
      sourceRecords.filter(
        (record) => record.mergedInto && resolveId(record.id) === id,
      ),
    search(query = "", box = "all") {
      const text = query.trim().toLocaleLowerCase();
      return records.filter(
        (record) =>
          (box === "all" || record.box === box) &&
          `${record.title ?? ""} ${record.artist ?? ""} ${record.spineText ?? ""}`
            .toLocaleLowerCase()
            .includes(text),
      );
    },
  };
}

// An invalid optional fragment must never turn a loaded catalog into an error.
export function parseRoute(hash) {
  let route;
  try {
    route = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return null;
  }
  if (route.startsWith("record=")) return { recordId: route.slice(7) };
  if (route.startsWith("box=")) return { box: route.slice(4) };
  return null;
}
