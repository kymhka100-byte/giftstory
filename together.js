/* 빨간 우체통 together.js - 노래 같이 듣기 · 영화(유튜브) 같이 보기 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* ----- 노래 같이 듣기 · 영화 같이 보기 (방 친구와 같은 곳을 같이) ----- */
const BASE_SONGS = [{ type: 'mp3', src: BGM_FILE, title: '빨간 우체통 테마곡' }];
const ytId = t => { const m = String(t || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(String(t || '').trim()) ? String(t).trim() : null); };
let YTready = null;
function loadYT(){
  if (!YTready) YTready = new Promise((ok, no) => {
    if (window.YT && YT.Player) return ok();
    window.onYouTubeIframeAPIReady = ok;
    loadScript('https://www.youtube.com/iframe_api').catch(e => { YTready = null; no(e); });
  });
  return YTready;
}
function makeYT(el, onState){
  return loadYT().then(() => new Promise(ok => {
    const pl = new YT.Player(el, { width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onReady: () => ok(pl), onStateChange: e => onState && onState(e.data), onError: () => toast('이 영상은 다른 앱에서 재생이 막혀 있어요') } });
  }));
}
const tgRef = (kind, id) => FB ? FB.D.ref(FB.db, 'giftstory/rooms/' + (id || room) + '/together/' + kind) : null;
/* 25번: 메인 화면에서 혼자 영화 보기 (서버에 안 보내고 내 폰에서만) */
let vSolo = false;
function soloVideo(){
  vSolo = true; V = null; applyVideo(null);
  showPanel('musicPanel', false); showPanel('videoPanel', true); syncVideo();
  toast('🎬 혼자 보기 · 친구와 보려면 대화방에서 열어 주세요');
}
function tgWrite(kind, st){
  if ((kind === 'video' && vSolo) || homeOn) { (kind === 'music' ? applyMusic : applyVideo)(st); return; }   // 26번: 메인 화면에서는 내 폰에서만
  if (FB) FB.D.set(tgRef(kind), st).catch(() => toast('같이 듣기 연결 실패 - 인터넷을 확인해 주세요'));
  else (kind === 'music' ? applyMusic : applyVideo)(st);
}
const posNow = st => st ? (st.pos || 0) + (st.playing ? Math.max(0, (Date.now() - (st.at || Date.now())) / 1000) : 0) : 0;
document.querySelectorAll('[data-tclose]').forEach(b => b.onclick = () => {
  click(); showPanel(b.dataset.tclose, false);
  if (b.dataset.tclose === 'videoPanel' && vPlayer) { vApplying(); vPlayer.pauseVideo(); tgVideoOn = false; }   // 나만 닫기 (친구는 계속)
});

/* --- 노래 --- */
const PLAY_SVG = '<svg class="pico" viewBox="0 0 30 30"><path d="M8 4.5Q8 3 9.4 3.8L26 13.6q1.4.9 0 1.8L9.4 25.2Q8 26 8 24.5z" fill="currentColor"/></svg>';
const PAUSE_SVG = '<svg class="pico" viewBox="0 0 30 30"><rect x="7" y="5" width="5.5" height="20" rx="1.5" fill="currentColor"/><rect x="17.5" y="5" width="5.5" height="20" rx="1.5" fill="currentColor"/></svg>';
const NEXT_SVG = '<svg class="nico" viewBox="0 0 24 24"><path d="M4 5.5Q4 4.3 5.1 5L15 11.2q1 .8 0 1.6L5.1 19Q4 19.7 4 18.5z" fill="currentColor"/><rect x="16.5" y="5" width="3" height="14" rx="1" fill="currentColor"/></svg>';
let M = null, mPlayer = null, mPinned = false, mCollapseT = 0, tgVideoOn = false;
const tAudio = new Audio(); tAudio.preload = 'auto'; tAudio.crossOrigin = 'anonymous';
tAudio.addEventListener('error', () => {   // 미리보기·저장공간에서 열면 GitHub 파일로
  if (tAudio.src && tAudio.src.startsWith('file:')) { const f = tAudio.src.split('/').pop(); tAudio.src = MEDIA_HOME + f; tAudio.load(); }
});
const rAudio = new Audio(); rAudio.autoplay = true;   // 친구 폰에서 흘려보내 주는 노래
const localFiles = {};   // 내 폰에서 고른 노래 (재생 주소)
/* 내 폰에서 고른 노래는 휴대폰 안(IndexedDB)에 보관 → 앱을 나갔다 와도 목록·노래가 그대로 */
const MY_SONGS_MAX = 40;
const mySongs = () => LS.get('rp_mysongs', []);
let idbP = null;
function idb(){
  if (!idbP) idbP = new Promise((ok, no) => {
    if (!window.indexedDB) return no();
    const q = indexedDB.open('redpost', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('songs');
    q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error);
  });
  return idbP;
}
const idbDo = (mode, fn) => idb().then(db => new Promise((ok, no) => { const tx = db.transaction('songs', mode), r = fn(tx.objectStore('songs')); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); }));
const idbPut = (k, v) => idbDo('readwrite', st => st.put(v, k));
const idbGet = k => idbDo('readonly', st => st.get(k));
const idbDel = k => idbDo('readwrite', st => st.delete(k));
const mList = () => (M && M.list) || [...BASE_SONGS, ...mySongs()];
const curItem = () => M && mList()[M.idx];
const mOn = () => !!(M && M.playing);
function drawMusic(){
  const list = mList(), i = M ? M.idx : -1, q = $('mFind').value.trim().toLowerCase();
  $('mList').innerHTML = list.map((x, k) => ({ x, k })).filter(({ x }) => !q || (x.title || '').toLowerCase().includes(q))
    .map(({ x, k }) => `<div class="${k === i ? 'on' : ''}" data-k="${k}">${x.type === 'yt' ? '▶ ' : x.type === 'local' ? '📱 ' : '♪ '}${esc(x.title || '유튜브 노래')}${x.type === 'local' && x.hostName ? ` <small style="color:#999">(${esc(x.hostName)} 폰)</small>` : ''}</div>`).join('')
    || '<div style="color:#888">찾는 노래가 없어요</div>';
  const it = curItem(), title = it ? (it.title || '유튜브 노래') : '노래를 골라 주세요';
  $('mTitle').textContent = title;
  $('mbTitle').textContent = (mOn() ? '♪ ' : '⏸ ') + title;
  $('mBy').textContent = M && M.by ? `${M.by}님이 ${M.playing ? '틀었어요' : '멈췄어요'}` : '';
  const pl = mOn() && !mBlocked;
  $('mPlay').innerHTML = $('mbPlay').innerHTML = pl ? PAUSE_SVG : PLAY_SVG;
  $('mPlay').classList.toggle('on', pl); $('mbPlay').classList.toggle('on', pl);
  $('mbar').classList.toggle('show', !!M);
  try { svMusicDraw(); } catch (e) {}
}
function openMusicPanel(){ mPinned = true; clearTimeout(mCollapseT); showPanel('musicPanel', true); drawMusic(); }
/* 노래가 시작되면: 가운데에 잠깐(1초) 보였다가 위쪽 막대로 */
function flashMusicPanel(){
  if (tgVideoOn) return;
  mPinned = false; showPanel('musicPanel', true); drawMusic();
  clearTimeout(mCollapseT); mCollapseT = setTimeout(() => { if (!mPinned) showPanel('musicPanel', false); }, 1200);
}
function mCurPos(){
  const it = curItem(); if (!it) return 0;
  if (it.type === 'yt') return mPlayer && mPlayer.getCurrentTime ? mPlayer.getCurrentTime() : posNow(M);
  if (it.type === 'local' && it.host !== me.uid) return posNow(M);
  return tAudio.currentTime || posNow(M);
}
function mSet(ch){ tgWrite('music', { list: mList(), idx: 0, pos: 0, playing: false, ...M, ...ch, at: Date.now(), by: me.name }); }
function applyMusic(st){
  const prev = M; M = st && st.list ? st : null;
  const started = M && M.playing && (!prev || !prev.playing || prev.idx !== M.idx);
  drawMusic();
  if (started) flashMusicPanel();
  syncMusic();
}
function stopAllMusic(){ tAudio.pause(); rAudio.pause(); try { if (mPlayer && mPlayer.pauseVideo) mPlayer.pauseVideo(); } catch (e) {} }
function syncMusic(){
  const it = curItem();
  $('mYTbox').classList.toggle('show', !!(it && it.type === 'yt'));
  hostStream(it && it.type === 'local' && it.host === me.uid);
  if (!it || !M.playing) { stopAllMusic(); drawMusic(); return; }
  const at = posNow(M);
  if (it.type !== 'yt') { try { if (mPlayer && mPlayer.pauseVideo) mPlayer.pauseVideo(); } catch (e) {} }
  if (it.type !== 'local' || it.host === me.uid) rAudio.pause();
  if (it.type === 'mp3' || (it.type === 'local' && it.host === me.uid)) {
    let src;
    if (it.type === 'local') {
      src = localFiles[it.src];
      if (!src) {   // 휴대폰 안 보관함에서 다시 꺼내기
        const want = it.src;
        idbGet(want).then(b => { if (b) { localFiles[want] = URL.createObjectURL(b); const c = curItem(); if (c && c.src === want) syncMusic(); } else toast('📱 이 노래는 다시 골라 주세요'); }).catch(() => toast('📱 이 노래는 다시 골라 주세요'));
        return;
      }
    }
    else src = new URL(it.src, location.href).href;
    const go = () => { if (Math.abs(tAudio.currentTime - at) > 2) { try { tAudio.currentTime = at; } catch (e) {} } mTry(tAudio.play()); };
    if (tAudio.src !== src && !(tAudio.src.startsWith(MEDIA_HOME) && src.endsWith(it.src))) { tAudio.src = src; tAudio.addEventListener('loadedmetadata', go, { once: true }); tAudio.load(); } else go();
  } else if (it.type === 'local') {   // 친구 폰 노래 → 흘려받기
    tAudio.pause(); listenStream(it.host);
  } else {
    tAudio.pause();
    const run = pl => {
      const cur = pl.getVideoData && pl.getVideoData().video_id;
      if (cur !== it.src) pl.loadVideoById(it.src, at);
      else { if (Math.abs(pl.getCurrentTime() - at) > 2) pl.seekTo(at, true); pl.playVideo(); }
      setTimeout(() => { if (mOn() && curItem() && curItem().type === 'yt' && pl.getPlayerState && pl.getPlayerState() !== 1 && pl.getPlayerState() !== 3) mTry(Promise.reject()); }, 2500);
    };
    if (mPlayer) run(mPlayer);
    else makeYT('mYT', st => {
      if (st === 0) mEnded();
      const c = curItem();
      if (st === 1 && c && c.type === 'yt' && !c.title && M.by === me.name) {   // 제목 채우기
        const t = mPlayer.getVideoData().title; if (t) { const l = mList().map(x => ({ ...x })); l[M.idx].title = t; mSet({ list: l, pos: mCurPos(), playing: true }); }
      }
    }).then(pl => { mPlayer = pl; run(pl); }).catch(() => toast('유튜브를 불러오지 못했어요'));
  }
  drawMusic();
}
/* 곡이 끝나면 다음 곡, 마지막 곡이 끝나면 3초 뒤 플레이어가 사라져요 */
let mEndT = 0;
function mEnded(){
  if (!M || M.by !== me.name) return;
  if (M.idx < mList().length - 1) { mSet({ idx: M.idx + 1, pos: 0, playing: true }); return; }
  mSet({ pos: 0, playing: false });
  clearTimeout(mEndT);   // 42번: 노래가 끝나도 플레이어는 그대로 (✕로만 닫기)
}
tAudio.onended = mEnded;
/* 앱을 나갔다 들어오면(또는 새로 열면) 휴대폰이 소리를 막아요 → 다시 틀기 / 화면을 한 번 누르면 다시 나와요 */
let mBlocked = false;
function mTry(p){
  Promise.resolve(p).then(() => { if (mBlocked) { mBlocked = false; drawMusic(); } }).catch(e => {
    if (e && e.name && e.name !== 'NotAllowedError') return;   // 휴대폰이 막은 경우만
    if (!mBlocked) { mBlocked = true; drawMusic(); }
    showBanner('🎵 화면을 한 번 누르면 노래가 다시 나와요'); bannerAct = () => musicResume();
  });
}
function musicResume(){
  if (!M || !M.playing) return;
  mBlocked = false;
  if (actx && actx.state !== 'running') actx.resume().catch(() => {});
  syncMusic();
}
document.addEventListener('pointerdown', () => { if (mBlocked && mOn()) musicResume(); }, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(musicResume, 400); });
addEventListener('pageshow', e => { if (e.persisted) setTimeout(musicResume, 400); });
const mPlayToggle = () => { click(); clearTimeout(mEndT); if (mOn() && mBlocked) { mBlocked = false; syncMusic(); return; } if (mOn()) mSet({ pos: mCurPos(), playing: false }); else mSet({ idx: M ? M.idx : 0, pos: M ? mCurPos() : 0, playing: true }); };
const mStep = d => { click(); const n = mList().length; mSet({ idx: ((M ? M.idx : (d > 0 ? -1 : 1)) + d + n) % n, pos: 0, playing: true }); };
$('mPlay').onclick = mPlayToggle;
$('mbPlay').onclick = () => { if (!mbDragged) mPlayToggle(); };
$('mNext').onclick = $('mbNext').onclick = () => mStep(1);
$('mNext').innerHTML = $('mbNext').innerHTML = NEXT_SVG; $('mPlay').innerHTML = $('mbPlay').innerHTML = PLAY_SVG;
$('mPrev').onclick = $('mbPrev').onclick = () => mStep(-1);
$('mbList').onclick = $('mbTitle').onclick = () => { if (mbDragged) return; click(); if ($('musicPanel').classList.contains('show')) showPanel('musicPanel', false); else openMusicPanel(); };
/* 플레이어 옮기기: 꾹 누르고 끌기 (놓은 자리 기억) */
let mbDragged = false;
(() => {
  const bar = $('mbar'), pos = LS.get('rp_mbpos', null);
  const place = (x, y) => { const w = bar.offsetWidth || 150, h = bar.offsetHeight || 50; x = Math.max(4, Math.min(innerWidth - w - 4, x)); y = Math.max(4, Math.min(innerHeight - h - 4, y)); bar.style.left = x + 'px'; bar.style.top = y + 'px'; bar.style.right = 'auto'; return { x, y }; };
  if (pos) requestAnimationFrame(() => place(pos.x, pos.y));
  let st = null;
  bar.addEventListener('pointerdown', e => { const r = bar.getBoundingClientRect(); st = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false }; mbDragged = false; });
  addEventListener('pointermove', e => {
    if (!st) return;
    const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    if (!st.moved && Math.hypot(dx, dy) < 10) return;
    st.moved = true; bar.classList.add('drag'); place(st.ox + dx, st.oy + dy);
  });
  const end = () => {
    if (!st) return;
    if (st.moved) { mbDragged = true; const r = bar.getBoundingClientRect(); LS.set('rp_mbpos', { x: r.left, y: r.top }); setTimeout(() => mbDragged = false, 50); }
    bar.classList.remove('drag'); st = null;
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
})();
$('mStop').onclick = $('mbClose').onclick = () => { if (mbDragged) return; click(); tgWrite('music', null); showPanel('musicPanel', false); };
$('mFind').oninput = drawMusic;
$('mList').addEventListener('click', e => { const d = e.target.closest('[data-k]'); if (!d) return; click(); mSet({ idx: +d.dataset.k, pos: 0, playing: true }); });
function addSongs(items){
  if (!items.length) return;
  const l = [...mList(), ...items];
  mSet({ list: l, idx: l.length - items.length, pos: 0, playing: true });
}
$('mAdd').onclick = () => {
  const id = ytId($('mUrl').value); if (!id) { toast('유튜브 주소를 붙여 넣어 주세요'); return; }
  $('mUrl').value = ''; click(); addSongs([{ type: 'yt', src: id, title: '' }]);
};
$('mYTfind').onclick = () => { click(); window.open('https://m.youtube.com/', '_blank'); toast('노래에서 공유 → 빨간 우체통을 누르거나, 링크 복사 후 여기 붙여 넣으세요'); };
$('mPhone').onclick = () => { click(); $('mFiles').click(); };
$('mFiles').onchange = () => {
  const fs = [...$('mFiles').files]; $('mFiles').value = ''; if (!fs.length) return;
  const items = fs.map(f => { const id = rid(); localFiles[id] = URL.createObjectURL(f); idbPut(id, f).catch(() => {}); return { type: 'local', src: id, title: f.name.replace(/\.[^.]+$/, ''), host: realMe.uid, hostName: realMe.name }; });
  let keep = [...mySongs(), ...items];
  keep.slice(0, Math.max(0, keep.length - MY_SONGS_MAX)).forEach(x => idbDel(x.src).catch(() => {}));
  LS.set('rp_mysongs', keep.slice(-MY_SONGS_MAX));
  addSongs(items); toast(`📱 ${items.length}곡을 넣었어요 · 친구 폰으로 흘려보내요`);
};

/* --- 내 폰 노래를 친구 폰으로 흘려보내기 (저장 안 함 · 파이어베이스는 연결만) --- */
const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const rtcRef = p => FB.D.ref(FB.db, 'giftstory/rooms/' + room + '/rtc/' + p);
let hostOn = false, hostPeers = {}, hostUn = null, streamDest = null;
function waitIce(pc){ return new Promise(ok => { if (pc.iceGatheringState === 'complete') return ok(); const t = setTimeout(ok, 2500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); }); }
function hostStream(on){
  if (!FB || !window.RTCPeerConnection || on === hostOn) return;
  hostOn = on;
  if (!on) { if (hostUn) hostUn(); hostUn = null; Object.values(hostPeers).forEach(pc => pc.close()); hostPeers = {}; return; }
  const c = ac(); if (!c) return;
  if (!streamDest) {   // 내 노래 소리 → 스피커 + 친구에게 보낼 줄
    const src = c.createMediaElementSource(tAudio);
    streamDest = c.createMediaStreamDestination();
    src.connect(c.destination); src.connect(streamDest);
  }
  const reqs = rtcRef(me.uid + '/req');
  hostUn = FB.D.onChildAdded(reqs, async snap => {
    const v = snap.val(), who = snap.key; if (!v || !v.offer || Date.now() - (v.at || 0) > 60000) return;
    try {
      if (hostPeers[who]) hostPeers[who].close();
      const pc = hostPeers[who] = new RTCPeerConnection(ICE);
      streamDest.stream.getTracks().forEach(t => { const sd = pc.addTrack(t, streamDest.stream); try { const p = sd.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = 96000; sd.setParameters(p).catch(() => {}); } catch (x) {} });
      await pc.setRemoteDescription(v.offer);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc);
      await FB.D.set(rtcRef(me.uid + '/ans/' + who), { answer: { type: 'answer', sdp: pc.localDescription.sdp }, at: Date.now() });
      FB.D.remove(snap.ref);
    } catch (e) {}
  });
}
let listenPc = null, listenHost = null;
async function listenStream(host){
  if (!FB || !window.RTCPeerConnection) { toast('이 화면에서는 친구 폰 노래를 받을 수 없어요'); return; }
  if (listenPc && listenHost === host && ['connected', 'connecting', 'new'].includes(listenPc.connectionState)) { mTry(rAudio.play()); return; }
  if (listenPc) listenPc.close();
  listenHost = host;
  const pc = listenPc = new RTCPeerConnection(ICE);
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.ontrack = e => {   // 넉넉히 모아 두고 틀기 (끊김 줄이기)
    try { if ('jitterBufferTarget' in e.receiver) e.receiver.jitterBufferTarget = 1500; else e.receiver.playoutDelayHint = 1.5; } catch (x) {}
    rAudio.srcObject = e.streams[0] || new MediaStream([e.track]); mTry(rAudio.play()); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') toast('친구 폰과 연결이 안 됐어요 (와이파이를 바꿔 보세요)'); };
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    const ans = rtcRef(host + '/ans/' + me.uid);
    await FB.D.remove(ans); await FB.D.remove(rtcRef(host + '/req/' + me.uid));
    await FB.D.set(rtcRef(host + '/req/' + me.uid), { offer: { type: 'offer', sdp: pc.localDescription.sdp }, at: Date.now() });
    const un = FB.D.onValue(ans, async s => {
      const v = s.val(); if (!v || !v.answer || pc !== listenPc) return;
      un(); try { await pc.setRemoteDescription(v.answer); } catch (e) {}
      FB.D.remove(ans);
    });
    unsub.push(un);
  } catch (e) { toast('친구 폰 노래를 받지 못했어요'); }
}

/* --- 영화 (유튜브 · 스트림이라 저장 안 함) --- */
let V = null, vPlayer = null, vApplyT = 0;
const vApplying = () => { vApplyT = Date.now() + 1500; };
function vSet(ch){ tgWrite('video', { vid: V && V.vid, pos: 0, playing: false, ...ch, at: Date.now(), by: me.name }); }
function applyVideo(st){
  const prev = V; V = st && st.vid ? st : null;
  $('vBy').textContent = V ? `${V.by}님이 ${V.playing ? '틀었어요' : '멈췄어요'}` : '';
  $('vEmpty').style.display = V ? 'none' : '';
  if (V && V.playing && V.by !== me.name && !$('videoPanel').classList.contains('show') && (!prev || prev.vid !== V.vid || !prev.playing)) {
    if (!homeOn && !S.on && !$('writer').classList.contains('show')) { showPanel('musicPanel', false); showPanel('videoPanel', true); toast(`🎬 ${V.by}님이 영상을 틀었어요`); }   // 24번: 친구 화면에도 바로 열려요
    else { showBanner(`🎬 ${V.by}님이 영상을 틀었어요 · 눌러서 같이 보기`); bannerAct = () => { showPanel('musicPanel', false); showPanel('videoPanel', true); syncVideo(); }; }
  }
  if ($('videoPanel').classList.contains('show')) syncVideo();
}
function syncVideo(){
  tgVideoOn = true;
  $('vEmpty').style.display = V ? 'none' : '';
  if (!V) { if (vPlayer && vPlayer.stopVideo) { vApplying(); vPlayer.stopVideo(); } return; }
  const at = posNow(V);
  if (V.playing) stopAllMusic();   // 영화 볼 땐 노래 쉬기
  const run = pl => {
    vApplying();
    const cur = pl.getVideoData && pl.getVideoData().video_id;
    if (cur !== V.vid) { vApplyT = Date.now() + 5000; V.playing ? pl.loadVideoById(V.vid, at) : pl.cueVideoById(V.vid, at); }
    else { if (Math.abs(pl.getCurrentTime() - at) > 2) pl.seekTo(at, true); V.playing ? pl.playVideo() : pl.pauseVideo(); }
    /* 24번: 폰이 소리 있는 자동 재생을 막으면 → 소리 끄고 틀고 '소리 켜기' 버튼 */
    if (V.playing) setTimeout(() => {
      try { if (!V || !V.playing || pl.getPlayerState() === 1) return; vApplying(); pl.mute(); pl.playVideo(); $('vSound').style.display = 'block'; } catch (e) {}
    }, 2500);
  };
  if (vPlayer) run(vPlayer);
  else makeYT('vYT', st => {
    if (Date.now() < vApplyT || !V) return;   // 내가 맞춘 건 다시 보내지 않음
    if (st === 1) vSet({ vid: V.vid, pos: vPlayer.getCurrentTime(), playing: true });
    if (st === 2) vSet({ vid: V.vid, pos: vPlayer.getCurrentTime(), playing: false });
  }).then(pl => { vPlayer = pl; run(pl); }).catch(() => toast('유튜브를 불러오지 못했어요'));
}
/* 영화 보면서 대화: 최근 글만 작게 */
function drawVChat(){
  if (!document.body.classList.contains('watch')) return;
  const box = $('vChat'), list = sorted().filter(m => m.type !== 'letter').slice(-6);
  box.innerHTML = list.map(m => `<div class="${isMine(m) ? 'me' : ''}"><b>${esc(isMine(m) ? '나' : m.name)}</b> ${esc(m.text)}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}
$('vGo').onclick = () => {
  const q = $('vUrl').value.trim(), id = ytId(q);
  if (!id) { if (q) vGoYT(q); else toast('유튜브 주소를 붙여 넣어 주세요'); return; }
  $('vUrl').value = ''; click();
  vSet({ vid: id, pos: 0, playing: true });
};
$('vSound').onclick = () => { click(); try { vPlayer.unMute(); vPlayer.setVolume(100); vPlayer.playVideo(); } catch (e) {} $('vSound').style.display = 'none'; };
$('vFind').onclick = () => { click(); const q = $('vUrl').value.trim(); vGoYT(q && !ytId(q) ? q : ''); };
/* 유튜브에서 영상 고르기 → 돌아오면 그 영상을 같이 보기에 바로 넣어요 */
function vGoYT(q){
  LS.set('rp_vwant', Date.now());
  window.open('https://m.youtube.com/' + (q ? 'results?search_query=' + encodeURIComponent(q) : ''), '_blank');
  toast('영상에서 공유 → 링크 복사 → 빨간 우체통으로 돌아오세요');
}
const vWanted = () => Date.now() - LS.get('rp_vwant', 0) < 20 * 60000;
function vTakeClip(){
  if (!vWanted() || !navigator.clipboard || !navigator.clipboard.readText) return;
  navigator.clipboard.readText().then(t => {
    const id = ytId(t || ''); if (!id || (V && V.vid === id)) return;
    LS.set('rp_vwant', 0);
    showPanel('musicPanel', false); showPanel('videoPanel', true);
    vSet({ vid: id, pos: 0, playing: true }); toast('🎬 복사한 영상을 같이 보기로 틀었어요');
  }).catch(() => { $('vUrl').placeholder = '여기를 길게 눌러 붙여 넣기 → 틀기'; });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(vTakeClip, 600); });
$('vEnd').onclick = () => { click(); tgWrite('video', null); showPanel('videoPanel', false); tgVideoOn = false; };

/* 방이 바뀌면 같이 듣기·보기도 그 방 것으로 */
function tgListen(){
  vSolo = false;
  if (call && call.room !== room) endCall(true);
  M = null; mBlocked = false; V = null; stopAllMusic(); hostStream(false); if (listenPc) { listenPc.close(); listenPc = null; }
  if (vPlayer && vPlayer.stopVideo) { vApplying(); vPlayer.stopVideo(); }
  showPanel('musicPanel', false); showPanel('videoPanel', false); tgVideoOn = false;
  drawMusic(); applyVideo(null);
  if (!FB) return;
  unsub.push(FB.D.onValue(tgRef('music'), s => applyMusic(s.val())));
  unsub.push(FB.D.onValue(tgRef('video'), s => applyVideo(s.val())));
  unsub.push(watchCall(room));
}
/* 유튜브 앱에서 공유 → 빨간 우체통 으로 들어온 노래 */
const sharedYT = (() => { const q = new URLSearchParams(location.search); return ytId(q.get('url') || '') || ytId(q.get('text') || '') || ytId(q.get('title') || ''); })();
function takeShared(){
  if (!sharedYT) return;
  setTimeout(() => {
    if (vWanted()) {   // '영화 같이 보기'에서 유튜브로 갔다가 공유한 영상
      LS.set('rp_vwant', 0); showPanel('musicPanel', false); showPanel('videoPanel', true);
      vSet({ vid: sharedYT, pos: 0, playing: true }); toast('🎬 유튜브 영상을 같이 보기로 틀었어요'); return;
    }
    addSongs([{ type: 'yt', src: sharedYT, title: '' }]); toast('🎵 유튜브 노래를 같이 듣기에 넣었어요');
  }, 2500);
}

