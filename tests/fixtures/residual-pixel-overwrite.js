// Deliberate regression fixture, appended to a frozen copy of the valid scene.
// Leave all numerical and geometric evidence intact while corrupting the pixels.
const renderBeforeCorruption = window.C2M.render;
window.C2M.render = time => {
  const evidence = renderBeforeCorruption(time);
  if (evidence.stage === 'output') {
    const ctx = document.getElementById('scene').getContext('2d');
    ctx.fillStyle = '#ff00ff';
    for (const v of evidence.geometry.output) {
      const x = (v.start.x + v.end.x) / 2;
      ctx.fillRect(x - 5, v.start.y - 5, 10, 10);
    }
  }
  return evidence;
};
