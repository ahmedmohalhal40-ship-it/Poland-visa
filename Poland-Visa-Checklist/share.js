// Canvas-based sharing and achievement card generation.
export function renderShareCard(container, state, documents, stats) {
  const canvas = document.createElement('canvas');
  const width = 900;
  const height = 540;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0d3b2c');
  gradient.addColorStop(1, '#14532d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, width - 44, height - 44);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(720, 140, 100, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Segoe UI';
  ctx.fillText('Poland Visa D Checklist', 60, 90);
  ctx.font = '24px Segoe UI';
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.fillText('Erasmus+ Progress Snapshot', 60, 132);

  ctx.beginPath();
  ctx.arc(220, 320, 110, -Math.PI / 2, (Math.PI * 2 * stats.percentage) / 100 - Math.PI / 2);
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(220, 320, 110, 0, Math.PI * 2);
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px Segoe UI';
  ctx.fillText(`${stats.percentage}%`, 160, 315);
  ctx.font = '24px Segoe UI';
  ctx.fillText('Completed', 170, 352);

  ctx.fillStyle = '#f8fffb';
  ctx.font = 'bold 26px Segoe UI';
  ctx.fillText(`Completed: ${stats.completed}`, 450, 260);
  ctx.fillText(`Remaining: ${stats.remaining}`, 450, 305);
  ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 450, 350);
  ctx.font = '22px Segoe UI';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('Keep going — your Erasmus journey is becoming reality.', 450, 395);

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(60, 430, 260, 6);

  if (container) {
    container.innerHTML = '';
    container.appendChild(canvas);
  }
  return canvas;
}

export function downloadShareCard() {
  const canvas = document.querySelector('#shareCanvasCard canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'poland-visa-progress.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
