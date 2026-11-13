import { clipToPhoto } from "./spine-masks.js";
import { escapeHtml } from "./artwork.js";

const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

// Render nonempty frozen-plan pairs in detail, whole-photo, or section mode.
// Own crops, clipped outlines, labels, and interactive section targets together.
function detailBounds(pair, box) {
  const polygon = pair.outlines[0].polygon;
  const centerX = (polygon[2][0] + polygon[5][0]) / 2,
    centerY = (polygon[2][1] + polygon[5][1]) / 2;
  const width = 1300,
    height = 1500;
  return [
    clamp(centerX - width / 2, 0, box.width - width),
    clamp(centerY - height / 2, 0, box.height - height),
    width,
    height,
  ];
}
export function renderCaptureMap(pairs, box, mode = "detail") {
  const whole = mode === "whole",
    section = mode === "section",
    interactive = section;
  const detail = !whole && !section;
  const b = section
    ? [0, 0, box.width, box.height + 300]
    : whole
      ? [0, 0, box.width, box.height]
      : detailBounds(pairs[0], box);
  const count = pairs.length;
  const labelWidth = section || whole ? 280 : 105,
    labelHeight = section || whole ? 180 : 64;
  const shapes = pairs
    .map((p, i) => {
      const outline = p.outlines[0];
      let a = outline.anchor ?? outline.polygon.at(-2);
      if (a[1] > box.height || a[0] < 0 || a[0] > box.width) {
        const clipped = clipToPhoto(outline.polygon, box.width, box.height);
        const footY = Math.max(...clipped.map((v) => v[1]));
        const foot = clipped.filter((v) => Math.abs(v[1] - footY) < 1);
        a = [foot.reduce((sum, v) => sum + v[0], 0) / foot.length, footY];
      }
      if (detail) {
        const y = b[1] + b[3] - 180;
        const crossings = [];
        outline.polygon.forEach((v, index) => {
          const next = outline.polygon[(index + 1) % outline.polygon.length];
          if ((v[1] <= y && next[1] > y) || (next[1] <= y && v[1] > y))
            crossings.push(
              v[0] + ((y - v[1]) * (next[0] - v[0])) / (next[1] - v[1]),
            );
        });
        a = [
          crossings.length
            ? (Math.min(...crossings) + Math.max(...crossings)) / 2
            : (outline.polygon[2][0] + outline.polygon[5][0]) / 2,
          y,
        ];
      }
      const x = section ? b[0] + ((i + 0.5) * b[2]) / count : a[0];
      const y = section
        ? box.height + 50
        : whole
          ? Math.min(box.height - 190, a[1] + 65)
          : Math.min(box.height - 65, a[1] + 65);
      return `<g${interactive ? ` data-pair="${p.pair}" role="button" tabindex="0" aria-label="Sleeve ${p.position}: ${escapeHtml(p.title)}, photos ${p.frontShot} and ${p.backShot}"` : ""}>${p.outlines
        .map(
          (o) =>
            `<polygon class="${interactive ? "map-spine" : "mask"}" points="${clipToPhoto(
              o.polygon,
              box.width,
              box.height,
            )
              .map((v) => v.join(","))
              .join(" ")}"/>`,
        )
        .join(
          "",
        )}<g class="map-tag"><line x1="${a[0]}" y1="${Math.min(a[1], box.height)}" x2="${x}" y2="${y}"/><rect x="${x - labelWidth / 2}" y="${y}" width="${labelWidth}" height="${labelHeight}" rx="6"/><text x="${x}" y="${y + labelHeight * 0.72}" style="font-size:${section || whole ? 128 : 38}px">${p.position}</text></g></g>`;
    })
    .join("");
  const clip = `crop-${box.id}-${pairs[0].pair}-${whole ? "whole" : "detail"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.join(" ")}" aria-label="${escapeHtml(box.name)} box, highlighted sleeve positions" role="${interactive ? "group" : "img"}"><defs><clipPath id="${clip}"><rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}"/></clipPath></defs><g clip-path="url(#${clip})"><image href="${escapeHtml(box.photo)}" x="0" y="0" width="${box.width}" height="${box.height}"/>${shapes}</g></svg>`;
}
