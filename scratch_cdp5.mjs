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
  return res.result.result.value;
}

// 1. still at top: should be hidden
console.log('At top:', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

// 2. scroll down 1200px (past threshold), still scrolling down: should be hidden
await evalJs(`window.scrollTo(0, 1200); window.dispatchEvent(new Event('scroll'))`);
await new Promise((r) => setTimeout(r, 200));
console.log('After scroll down to 1200:', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

// 3. scroll up a bit (still past threshold): should become visible
await evalJs(`window.scrollTo(0, 900); window.dispatchEvent(new Event('scroll'))`);
await new Promise((r) => setTimeout(r, 200));
console.log('After scrolling up to 900 (past threshold):', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

const styleInfo = await evalJs(`(() => {
  const btn = document.getElementById('back-to-top');
  const cs = getComputedStyle(btn);
  return JSON.stringify({ opacity: cs.opacity, transform: cs.transform, rect: btn.getBoundingClientRect().toJSON() });
})()`);
console.log('Style when visible:', styleInfo);

// 4. click it -> should scroll to top (via lenis or native)
await evalJs(`document.getElementById('back-to-top').click()`);
await new Promise((r) => setTimeout(r, 1600));
console.log('scrollY after click:', await evalJs(`window.scrollY`));
console.log('lenis present:', await evalJs(`!!window.__lenis`));

// 5. scroll below threshold then up: should stay hidden (< SHOW_THRESHOLD)
await evalJs(`window.scrollTo(0, 300); window.dispatchEvent(new Event('scroll'))`);
await new Promise((r) => setTimeout(r, 100));
await evalJs(`window.scrollTo(0, 100); window.dispatchEvent(new Event('scroll'))`);
await new Promise((r) => setTimeout(r, 200));
console.log('Scroll up but below threshold (300->100):', await evalJs(`document.getElementById('back-to-top').classList.contains('is-visible')`));

const shotRes = await jsonRpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
// re-show it for screenshot
await evalJs(`window.scrollTo(0, 1200); window.dispatchEvent(new Event('scroll'))`);
await new Promise((r) => setTimeout(r, 150));
await evalJs(`window.scrollTo(0, 900); window.dispatchEvent(new Event('scroll'))`);
await new Promise((r) => setTimeout(r, 700));
const shotRes2 = await jsonRpc(ws, id++, 'Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync('backtotop_test.png', Buffer.from(shotRes2.result.data, 'base64'));
console.log('Screenshot saved');

ws.close();
