// Two phones, one match: a direct WebRTC link between the phones (no game server).
// To find each other, the phones meet for a few seconds on the free public PeerJS server
// (0.peerjs.com): the host takes a 4-digit code, the friend types it, and the server passes the
// WebRTC offer, answer and network addresses between them. After that the match goes phone to phone.
// Tests use ?signal=bc: the same meeting over a BroadcastChannel, between tabs of one browser.

const PREFIX = 'kadurid-hagiborim-';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
// (?peer=localhost:9000 tries a PeerJS server of your own, e.g. `npx peer --port 9000`)
const own = new URLSearchParams(location.search).get('peer');
const SERVER = own ? `ws://${own}/peerjs?key=peerjs` : 'wss://0.peerjs.com/peerjs?key=peerjs';
const useBC = () => /[?&]signal=bc\b/.test(location.search);
const rid = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => (x % 36).toString(36)).join('');

// The meeting place. Messages are { type, dst, payload }; the server adds `src`.
// Resolves once the server gave us our id; rejects with 'taken' or 'server'.
function meet(id) {
  return useBC() ? meetBC(id) : meetWS(id);
}

function meetWS(id) {
  return new Promise((resolve, reject) => {
    let ws, beat, opened = false;
    const sig = {
      onmsg: null,
      send: (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); },
      close: () => { clearInterval(beat); try { ws.close(); } catch {} },
    };
    try { ws = new WebSocket(`${SERVER}&id=${id}&token=${rid(10)}&version=1.5.4`); } catch { reject('server'); return; }
    const fail = setTimeout(() => { sig.close(); reject('server'); }, 10000);
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'OPEN') {
        opened = true; clearTimeout(fail);
        beat = setInterval(() => sig.send({ type: 'HEARTBEAT' }), 5000); // the server drops quiet phones
        resolve(sig);
      } else if (!opened) { clearTimeout(fail); sig.close(); reject(m.type === 'ID-TAKEN' ? 'taken' : 'server'); }
      else if (sig.onmsg) sig.onmsg(m);
    };
    ws.onerror = ws.onclose = () => { if (!opened) { clearTimeout(fail); clearInterval(beat); reject('server'); } };
  });
}

function meetBC(id) {
  return new Promise((resolve, reject) => {
    const ch = new BroadcastChannel('kadurid-signal');
    let taken = false;
    const sig = { onmsg: null, send: (m) => ch.postMessage({ ...m, src: id }), close: () => ch.close() };
    ch.onmessage = ({ data: m }) => {
      if (m.type === 'CLAIM' && m.id === id) ch.postMessage({ type: 'TAKEN', id });
      else if (m.type === 'TAKEN' && m.id === id) taken = true;
      // like the real server: a message to nobody comes back as EXPIRE
      else if (m.type === 'WHO' && m.dst === id) ch.postMessage({ type: 'HERE', dst: m.src, src: id });
      else if (m.dst === id && sig.onmsg) sig.onmsg(m);
    };
    ch.postMessage({ type: 'CLAIM', id });
    setTimeout(() => { if (taken) { ch.close(); reject('taken'); } else resolve(sig); }, 150);
  });
}

// The link between the two phones: send(obj), onmessage(obj), onclose(); close().
class Link {
  constructor(pc) {
    this.pc = pc; this.dc = null; this.closed = false;
    this.onmessage = null; this.onclose = null;
    let lost = null;
    pc.addEventListener('connectionstatechange', () => {
      const s = pc.connectionState;
      clearTimeout(lost);
      if (s === 'failed' || s === 'closed') this.end();
      else if (s === 'disconnected') lost = setTimeout(() => this.end(), 5000); // a short Wi-Fi hiccup is fine
    });
  }
  attach(dc) {
    this.dc = dc;
    dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (this.onmessage) this.onmessage(m); };
    dc.onclose = () => this.end();
  }
  get open() { return !this.closed && this.dc && this.dc.readyState === 'open'; }
  send(m) { if (this.open) try { this.dc.send(JSON.stringify(m)); } catch {} }
  end() {
    if (this.closed) return;
    this.closed = true;
    try { this.dc && this.dc.close(); } catch {}
    try { this.pc.close(); } catch {}
    if (this.onclose) this.onclose();
  }
  close() { this.onclose = null; this.end(); }
}

// Candidates can arrive before the offer/answer is in place: keep them until it is.
function iceQueue(pc) {
  const early = [];
  return {
    add(c) { if (pc.remoteDescription) pc.addIceCandidate(c).catch(() => {}); else early.push(c); },
    flush() { for (const c of early.splice(0)) pc.addIceCandidate(c).catch(() => {}); },
  };
}

// Host: take a free 4-digit code, then wait for the friend.
// Returns { code, connected: Promise<Link>, cancel() }.
export async function host() {
  let sig = null, code = '';
  for (let i = 0; i < 6 && !sig; i++) {
    code = String(1000 + Math.floor(Math.random() * 9000));
    try { sig = await meet(PREFIX + code); } catch (e) { if (e !== 'taken') throw e; }
  }
  if (!sig) throw 'server';
  let pc = null, link = null, ice = null, guest = null, done;
  const connected = new Promise((res) => { done = res; });
  sig.onmsg = async (m) => {
    if (m.type === 'OFFER' && !link) {
      guest = m.src;
      pc = new RTCPeerConnection({ iceServers: ICE });
      ice = iceQueue(pc);
      const l = new Link(pc);
      pc.onicecandidate = (e) => { if (e.candidate) sig.send({ type: 'CANDIDATE', dst: guest, payload: e.candidate.toJSON() }); };
      pc.ondatachannel = (e) => {
        l.attach(e.channel);
        const ready = () => { if (link) return; link = l; done(l); setTimeout(() => sig.close(), 1500); };
        if (e.channel.readyState === 'open') ready(); else e.channel.onopen = ready;
      };
      // a friend who never got through: forget them, so the next try can connect
      l.onclose = () => { if (link !== l) { pc = null; guest = null; } };
      try {
        await pc.setRemoteDescription(m.payload);
        ice.flush();
        await pc.setLocalDescription(await pc.createAnswer());
        sig.send({ type: 'ANSWER', dst: guest, payload: pc.localDescription.toJSON() });
      } catch { l.close(); pc = null; guest = null; }
    } else if (m.type === 'CANDIDATE' && pc && m.src === guest) ice.add(m.payload);
  };
  return { code, connected, cancel: () => { sig.close(); if (pc && !link) try { pc.close(); } catch {} } };
}

// Friend: connect to the host with this code. Resolves with the Link; rejects with
// 'nohost' (no game with that code), 'server' (no internet / server) or 'timeout'.
export function join(code, cancelled = () => false) {
  return new Promise(async (resolve, reject) => {
    let sig;
    try { sig = await meet(PREFIX + 'g' + rid(8)); } catch { reject('server'); return; }
    const hostId = PREFIX + code;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const ice = iceQueue(pc), link = new Link(pc);
    let over = false;
    const finish = (err) => {
      if (over) return;
      over = true; clearTimeout(timer); clearInterval(watch);
      setTimeout(() => sig.close(), err ? 0 : 1500);
      if (err) { link.close(); reject(err); } else resolve(link);
    };
    const timer = setTimeout(() => finish('timeout'), 20000);
    const watch = setInterval(() => { if (cancelled()) finish('cancel'); }, 200);
    const dc = pc.createDataChannel('game', { ordered: true });
    link.attach(dc);
    dc.onopen = () => finish(null);
    link.onclose = () => finish('timeout');
    pc.onicecandidate = (e) => { if (e.candidate) sig.send({ type: 'CANDIDATE', dst: hostId, payload: e.candidate.toJSON() }); };
    sig.onmsg = async (m) => {
      if (m.type === 'ANSWER') { try { await pc.setRemoteDescription(m.payload); ice.flush(); } catch { finish('timeout'); } }
      else if (m.type === 'CANDIDATE') ice.add(m.payload);
      else if (m.type === 'EXPIRE' || m.type === 'LEAVE') finish('nohost');
    };
    if (useBC()) {
      let here = false;
      const prev = sig.onmsg;
      sig.onmsg = (m) => { if (m.type === 'HERE') here = true; else prev(m); };
      sig.send({ type: 'WHO', dst: hostId });
      setTimeout(() => { if (!here) finish('nohost'); }, 600);
    }
    await pc.setLocalDescription(await pc.createOffer());
    sig.send({ type: 'OFFER', dst: hostId, payload: pc.localDescription.toJSON() });
  });
}
