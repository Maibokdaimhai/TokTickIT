export function decodeFilename(name: string): string {
  if (!name) return name;
  for (let i = 0;i < name.length;i++) {
    if (name.charCodeAt(i) > 255) return name;
  }
  if (/^[\x00-\x7F]*$/.test(name)) return name;
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

export function formatContentDisposition(
  disposition: "inline" | "attachment",
  originalName: string = "attachment"
): string {
  const safeName = originalName || "attachment";
  const asciiFallback = safeName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(safeName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
