const base = 'http://localhost:9226';

async function jsonRpc(ws, id, method, params = {}) {
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => {
    function handler(ev) {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    }
    ws.addEventListener('message', handler);
  });
}

const newTabRes = await fetch(base + '/json/new?about:blank', { method: 'PUT' });
const tab = await newTabRes.json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve));

let id = 1;
await jsonRpc(ws, id++, 'Page.enable');
await jsonRpc(ws, id++, 'Runtime.enable');
await jsonRpc(ws, id++, 'Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await jsonRpc(ws, id++, 'Page.navigate', { url: 'http://localhost:4321/' });
await new Promise((resolve) => {
  function handler(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Page.loadEventFired') {
      ws.removeEventListener('message', handler);
      resolve();
    }
  }
  ws.addEventListener('message', handler);
});
await new Promise((r) => setTimeout(r, 500));

async function evalJs(expr) {
  const res = await jsonRpc(ws, id++, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  if (res.result.exceptionDetails) console.log('ERR:', JSON.stringify(res.result.exceptionDetails));
  return res.result.result.value;
}

// force it visible via lenis scroll up (same real trigger as production)
await evalJs(`window.__lenis && window.__lenis.scrollTo(1200, { immediate: true })`);
await new Promise((r) => setTimeout(r, 300));
await evalJs(`window.__lenis && window.__lenis.scrollTo(900, { immediate: true })`);
await new Promise((r) => setTimeout(r, 600));

const info = await evalJs(`(() => {
  const rail = document.querySelector('.nav-rail');
  const inner = document.querySelector('.nav-rail-inner');
  const items = [...document.querySelectorAll('.nav-rail-item')];
  const cs = getComputedStyle(inner);
  return JSON.stringify({
    railVisible: rail.classList.contains('is-visible'),
    flexDirection: cs.flexDirection,
    itemRects: items.map(i => i.getBoundingClientRect().toJSON()),
  });
})()`);
console.log('INFO:', info);

const shotRes = await jsonRpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync('navrail_mobile.png', Buffer.from(shotRes.result.data, 'base64'));
console.log('Screenshot saved');

ws.close();
