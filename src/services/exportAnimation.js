import * as htmlToImage from "html-to-image";

export async function exportAnimationWebM({
  node,
  duration,
  fps = 12,
  seek,             // function(tSeconds) -> render layout at time t
  pixelRatio = 2,
  filename = "animation.webm",
}) {
  if (!node) throw new Error("No node to record");

  const rect = node.getBoundingClientRect();
  const W = Math.floor(rect.width * pixelRatio);
  const H = Math.floor(rect.height * pixelRatio);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const stream = canvas.captureStream(fps);
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => (rec.onstop = res));
  rec.start();

  const totalFrames = Math.max(1, Math.round(duration * fps));
  for (let frame = 0; frame <= totalFrames; frame++) {
    const t = Math.min(duration, frame / fps);
    seek(t);
    // eslint-disable-next-line no-await-in-loop
    const snap = await htmlToImage.toCanvas(node, {
      pixelRatio,
      backgroundColor: "#0e7a3a",
      cacheBust: true,
      style: { transform: "none", borderRadius: "0px" },
      width: Math.floor(rect.width),
      height: Math.floor(rect.height),
    });
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(snap, 0, 0, W, H);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => requestAnimationFrame(() => r()));
  }

  rec.stop();
  await done;

  const blob = new Blob(chunks, { type: "video/webm" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// For MP4: either use ffmpeg.wasm client-side or POST WebM to your server and transcode with ffmpeg.
