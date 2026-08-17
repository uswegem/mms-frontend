import QRCode from 'qrcode';
import { formatLipaNamba } from './format-lipa-namba';

export interface PrintRecord {
  name: string;
  alias: string;
  qrDataUrl: string;
  statusLabel: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load: ${src}`));
    img.src = src;
  });
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Core canvas draw (shared by both public APIs) ──────────────────────────

async function drawPoster(ctx: CanvasRenderingContext2D, opts: {
  name: string;
  alias: string;
  qrImageSrc: string;
  statusLabel: string;
}): Promise<void> {
  const W = 600;
  const H = 855;

  // Background gradient — black → near-black → gold
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#000000');
  bg.addColorStop(0.44, '#1a1400');
  bg.addColorStop(1, '#c8a400');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // White header bar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, 88);

  // TIPS text
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold italic 26px Arial, sans-serif';
  ctx.fillText('TIPS', 24, 44);

  // Letshego logo
  try {
    const logo = await loadImg('/letshego-faidika-logo.png');
    const logoH = 58;
    const logoW = logo.width * (logoH / logo.height);
    ctx.drawImage(logo, W - logoW - 18, (88 - logoH) / 2, logoW, logoH);
  } catch {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#555555';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('Letshego Faidika Bank', W - 18, 44);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // "LIPA HAPA"
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold italic 86px "Arial Black", Arial, sans-serif';
  ctx.fillText('LIPA HAPA', W / 2, 200);

  // "SCAN KULIPA"
  ctx.fillStyle = '#d4a500';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.fillText('SCAN KULIPA', W / 2, 256);

  // QR code
  const qrImg = await loadImg(opts.qrImageSrc);
  ctx.fillStyle = '#ffffff';
  rr(ctx, W / 2 - 122, 276, 244, 244, 10);
  ctx.fill();
  ctx.drawImage(qrImg, W / 2 - 112, 286, 224, 224);

  // Inactive banner
  if (opts.statusLabel !== 'Active') {
    ctx.fillStyle = 'rgba(185,28,28,0.92)';
    rr(ctx, W / 2 - 180, 534, 360, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(`${opts.statusLabel.toUpperCase()} — QR INACTIVE`, W / 2, 556);
  }

  // "LIPA NAMBA" label
  const labelY = opts.statusLabel !== 'Active' ? 592 : 548;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold italic 16px Arial, sans-serif';
  ctx.fillText('LIPA NAMBA', W / 2, labelY);

  // Gold card
  const cardX = W / 2 - 218;
  const cardY = labelY + 10;
  const cardW = 436;
  const cardH = 144;
  ctx.fillStyle = '#d4a500';
  rr(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold italic 46px Arial, sans-serif';
  ctx.fillText(formatLipaNamba(opts.alias), W / 2, cardY + 54);

  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 22, cardY + 70);
  ctx.lineTo(cardX + cardW - 22, cardY + 70);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold italic 28px Arial, sans-serif';
  const label = opts.name.length > 22 ? opts.name.slice(0, 21) + '…' : opts.name;
  ctx.fillText(label.toUpperCase(), W / 2, cardY + 116);

  // Footer
  ctx.fillStyle = '#d4a500';
  ctx.font = 'bold italic 15px Arial, sans-serif';
  ctx.fillText('Lipa kutoka Benki au Mtandao wowote wa Simu', W / 2, cardY + cardH + 40);
}

// ─── Public: render from TLV payload (used by single-record modal) ──────────

export async function renderPosterToCanvas(data: {
  name: string;
  alias: string;
  tlvPayload: string;
  statusLabel: string;
}): Promise<HTMLCanvasElement> {
  const W = 600;
  const H = 855;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const qrImageSrc = await QRCode.toDataURL(data.tlvPayload, {
    width: 216,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  await drawPoster(ctx, { ...data, qrImageSrc });
  return canvas;
}

// ─── Public: render from pre-generated qrDataUrl → PNG data URL ─────────────

async function recordToPng(r: PrintRecord): Promise<string> {
  const W = 600;
  const H = 855;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await drawPoster(ctx, {
    name: r.name,
    alias: r.alias,
    qrImageSrc: r.qrDataUrl,
    statusLabel: r.statusLabel,
  });
  return canvas.toDataURL('image/png');
}

// ─── Print helpers ──────────────────────────────────────────────────────────

export async function writePosterToWindow(win: Window, records: PrintRecord[]): Promise<void> {
  const pngUrls = await Promise.all(records.map(recordToPng));

  const imgs = pngUrls
    .map((url) => `<img src="${url}" alt="QR Poster" />`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Lipa Namba QR</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A5 portrait;margin:0}
  body{background:#fff}
  img{width:148mm;height:210mm;display:block;page-break-after:always;break-after:page}
  img:last-child{page-break-after:avoid;break-after:avoid}
</style>
</head><body>${imgs}</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

export function printPosters(records: PrintRecord[]): void {
  const win = window.open('', '_blank', 'width=620,height=820');
  if (!win) {
    alert('Please allow pop-ups to print / save PDF.');
    return;
  }
  void writePosterToWindow(win, records);
}
