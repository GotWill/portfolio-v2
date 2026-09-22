const base = 'http://localhost:9225';

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

console.log('lenis methods:', await evalJs(`Object.keys(window.__lenis || {}).join(',')`));

// scroll down using lenis, immediate
await evalJs(`window.__lenis.scrollTo(1200, { immediate: true })`);
await new Promise((r) => setTimeout(r, 300));
console.log('scrollY after lenis down:', await evalJs(`window.scrollY`));
console.log('visible after down:', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

// scroll up using lenis, immediate
await evalJs(`window.__lenis.scrollTo(900, { immediate: true })`);
await new Promise((r) => setTimeout(r, 300));
console.log('scrollY after lenis up to 900:', await evalJs(`window.scrollY`));
console.log('visible after up (past threshold):', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

const styleInfo = await evalJs(`(() => {
  const btn = document.getElementById('back-to-top');
  const cs = getComputedStyle(btn);
  return JSON.stringify({ opacity: cs.opacity, transform: cs.transform });
})()`);
console.log('Style:', styleInfo);

const shotRes = await jsonRpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync('backtotop_test.png', Buffer.from(shotRes.result.data, 'base64'));
console.log('Screenshot saved');

// click and verify it returns to top
await evalJs(`document.getElementById('back-to-top').click()`);
await new Promise((r) => setTimeout(r, 1600));
console.log('scrollY after click:', await evalJs(`window.scrollY`));
console.log('visible after returning to top:', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

ws.close();
