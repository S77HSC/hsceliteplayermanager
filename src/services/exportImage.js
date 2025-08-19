// services/exportImage.js
import * as htmlToImage from "html-to-image";

export async function exportNodeAs(node, fmt = "png", filename = "diagram") {
  if (!node) return;
  const opts = { cacheBust: true, pixelRatio: 3, backgroundColor: "#0b7d3b00" };
  const dataUrl =
    fmt === "png"
      ? await htmlToImage.toPng(node, opts)
      : await htmlToImage.toJpeg(node, { ...opts, quality: 0.95 });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${filename}.${fmt}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
