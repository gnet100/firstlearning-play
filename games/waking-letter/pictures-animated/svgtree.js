// Tiny SVG-fragment parser used by build.js: the pictures are plain elements and <g> groups, no text nodes.
function parse(src) {
  const root = { tag: "root", attrs: "", kids: [] }, stack = [root];
  const re = /<(\/?)([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(src))) {
    const gap = src.slice(last, m.index).trim();
    if (gap) throw new Error("text between tags: " + gap.slice(0, 40));
    last = re.lastIndex;
    if (m[1]) { const n = stack.pop(); if (n.tag !== m[2]) throw new Error("mismatch " + n.tag + "/" + m[2]); continue; }
    const node = { tag: m[2], attrs: m[3], kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (!m[4]) stack.push(node);
  }
  if (stack.length !== 1) throw new Error("unclosed tags");
  return root;
}
function str(n) {
  if (n.tag === "root") return n.kids.map(str).join("");
  return n.kids.length || ["g", "defs", "clipPath", "style"].includes(n.tag) ? `<${n.tag}${n.attrs}>${n.kids.map(str).join("")}</${n.tag}>` : `<${n.tag}${n.attrs}/>`;
}
function attr(n, a) { const m = n.attrs.match(new RegExp("\\s" + a + '="([^"]*)"')); return m ? m[1] : undefined; }
function dump(n, path = "", out = []) {
  n.kids.forEach((k, i) => {
    const p = path ? path + "." + i : String(i);
    let g = "";
    if (k.tag === "circle" || k.tag === "ellipse") g = ["cx", "cy", "r", "rx", "ry"].map((a) => attr(k, a)).filter(Boolean).join(",");
    else if (k.tag === "rect") g = ["x", "y", "width", "height"].map((a) => attr(k, a)).join(",");
    else if (k.tag === "g") g = (attr(k, "transform") || "") + " " + (attr(k, "clip-path") || "");
    else g = (attr(k, "d") || attr(k, "points") || "").slice(0, 60);
    out.push(`${p} ${k.tag} ${attr(k, "fill") || ""} ${g}`);
    if (k.tag === "g") dump(k, p, out);
  });
  return out;
}
module.exports = { parse, str, attr, dump };
