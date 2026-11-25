/* 빨간 우체통 videocall.js - 📹 영상통화 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* ----- 📹 영상통화 (카메라 영상은 친구 폰으로 바로 · 저장 안 함) ----- */
let call = null;   // { id, room, pc, stream, mine, un, facing }
const callRef = id => FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/call');
const ringing = {};
function watchCall(id){
  return FB.D.onValue(callRef(id), s => {
    const v = s.val();
    if (call && call.room === id) { onCallState(v); return; }
    if (v && v.state === 'ring' && v.from !== me.uid && !me.ids.includes(v.from) && Date.now() - (v.at || 0) < 45000 && !call) showRing(id, v);
    else if (ringing.id === id && (!v || v.state !== 'ring')) hideRing();
  });
}
function showRing(id, v){
  ringing.id = id; ringing.v = v;
  $('ringTitle').textContent = `${v.fromName || '친구'}님이 ${v.kind === 'audio' ? '📞 음성 통화' : '영상통화'}를 걸었어요${v.cap ? ' (자막)' : ''}`;
  showOv('ringOv');
  clearInterval(ringing.t); dingdong(); ringing.t = setInterval(dingdong, 2500);
  if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
}
function hideRing(){ clearInterval(ringing.t); ringing.id = null; hideOv('ringOv'); }
async function getCam(facing, kind){
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: kind === 'audio' ? false : { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } });
}
function showCall(text){
  $('callInfo').textContent = text || ''; $('callOv').classList.add('show');
  $('callOv').classList.toggle('audio', !!(call && call.kind === 'audio'));
  drawCallCap();
  stopAllMusic();
  ['cMic', 'cCam'].forEach(id => $(id).classList.remove('off'));
}
function newPc(){
  const pc = new RTCPeerConnection(ICE);
  call.stream.getTracks().forEach(t => pc.addTrack(t, call.stream));
  pc.ontrack = e => {
    $('rVid').srcObject = e.streams[0] || new MediaStream([e.track]);
    $('callInfo').textContent = call && call.kind === 'audio' ? '📞 ' + (roomName(call.room) || '통화 중') : '';
    if (call && call.cap && !capOn) capStart();   // 31번: 통화하면서 말이 글씨로도
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') { toast('연결이 안 됐어요 (와이파이를 바꿔 보세요)'); endCall(true); }
  };
  return pc;
}
$('camBtn').onclick = () => {
  click();
  if (homeOn) { toast('친구를 골라 대화방에서 눌러 주세요'); return; }
  startCall('video', false);
};
async function startCall(kind, cap){
  if (!FB) { toast('통화는 서버 연결이 필요해요'); return; }
  if (!window.RTCPeerConnection || !navigator.mediaDevices) { toast('이 화면에서는 영상통화가 안 돼요 (크롬으로 열어 주세요)'); return; }
  if (call) return;
  const id = room;
  try {
    call = { id: rid(), room: id, mine: true, facing: 'user', kind, cap: !!cap, t0: Date.now() };
    call.stream = await getCam('user', kind);
    $('lVid').srcObject = call.stream; $('lVid').classList.remove('back');
    showCall(`${kind === 'audio' ? '📞' : '📹'} ${roomName(id) || '친구'}님을 부르는 중…`);
    const pc = call.pc = newPc();
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    if (!call) return;
    await FB.D.set(callRef(id), { id: call.id, from: me.uid, fromName: me.name, kind, cap: !!cap, state: 'ring', at: Date.now(), offer: { type: 'offer', sdp: pc.localDescription.sdp } });
    call.sent = true;
    call.timeout = setTimeout(() => { if (call && call.mine && !call.on) { toast('친구가 받지 않았어요'); endCall(true); } }, 45000);
  } catch (e) { toast(e && e.name === 'NotAllowedError' ? '카메라·마이크를 허용해 주세요' : '카메라·마이크를 켤 수 없어요'); endCall(false); }
}
async function onCallState(v){
  if (!call || (call.mine && !call.sent)) return;
  if (!v || v.id !== call.id || v.state === 'end') { toast(v && v.reason === 'reject' ? '친구가 거절했어요' : '통화가 끝났어요'); endCall(false); return; }
  if (call.mine && v.state === 'on' && v.answer && !call.on) {
    call.on = true; clearTimeout(call.timeout);
    try { await call.pc.setRemoteDescription(v.answer); $('callInfo').textContent = '연결하는 중…'; } catch (e) { endCall(true); }
  }
}
$('ringYes').onclick = async () => {
  const id = ringing.id, v = ringing.v; hideRing(); click();
  if (!id || !v) return;
  if (id !== room) openRoom(id);
  try {
    call = { id: v.id, room: id, mine: false, facing: 'user', on: true, kind: v.kind || 'video', cap: !!v.cap, t0: Date.now() };
    call.stream = await getCam('user', call.kind);
    $('lVid').srcObject = call.stream; $('lVid').classList.remove('back');
    showCall('연결하는 중…');
    const pc = call.pc = newPc();
    await pc.setRemoteDescription(v.offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    await FB.D.update(callRef(id), { state: 'on', by: me.uid, answer: { type: 'answer', sdp: pc.localDescription.sdp } });
  } catch (e) { toast(e && e.name === 'NotAllowedError' ? '카메라·마이크를 허용해 주세요' : '카메라를 켤 수 없어요'); endCall(true); }
};
$('ringNo').onclick = () => {
  const id = ringing.id; hideRing(); click();
  if (id && FB) FB.D.update(callRef(id), { state: 'end', reason: 'reject' }).catch(() => {});
};
function endCall(tell){
  const c = call; call = null;
  capStop();
  hideRing();
  $('callOv').classList.remove('show', 'audio'); $('callCap').classList.remove('show');
  if (!c) return;
  clearTimeout(c.timeout);
  try { c.pc && c.pc.close(); } catch (e) {}
  if (c.stream) c.stream.getTracks().forEach(t => t.stop());
  $('rVid').srcObject = null; $('lVid').srcObject = null;
  if (tell && FB) {
    FB.D.update(callRef(c.room), { state: 'end' }).catch(() => {});
    setTimeout(() => FB.D.remove(callRef(c.room)).catch(() => {}), 3000);
  }
}
$('cEnd').onclick = () => { click(); endCall(true); };
$('cMic').onclick = () => { if (!call) return; const t = call.stream.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; $('cMic').classList.toggle('off', !t.enabled); toast(t.enabled ? '🎤 마이크 켰어요' : '🎤 마이크 껐어요'); } };
$('cCam').onclick = () => { if (!call) return; const t = call.stream.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; $('cCam').classList.toggle('off', !t.enabled); } };
$('cFlip').onclick = async () => {
  if (!call) return;
  const facing = call.facing === 'user' ? 'environment' : 'user';
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    const nt = ns.getVideoTracks()[0], old = call.stream.getVideoTracks()[0];
    const snd = call.pc.getSenders().find(x => x.track && x.track.kind === 'video');
    if (snd) await snd.replaceTrack(nt);
    if (old) { call.stream.removeTrack(old); old.stop(); }
    call.stream.addTrack(nt); call.facing = facing;
    $('lVid').srcObject = call.stream; $('lVid').classList.toggle('back', facing !== 'user');
  } catch (e) { toast('카메라를 바꿀 수 없어요'); }
};

/* 31번: 통화 자막 - 말이 끝나면 저절로 대화방에 글씨로 남아요 (폰마다 안 될 수 있어요) */
let capRec = null, capOn = false, capFail = 0;
function capStart(){
  const R0 = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R0) { toast('이 폰에서는 자막이 안 돼요 (통화는 그대로 돼요)'); return; }
  capOn = true; capFail = 0; capGo();
}
function capGo(){
  if (!capOn || !call) return;
  const R0 = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = capRec = new R0();
  r.lang = 'ko-KR'; r.continuous = true; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal || !call) continue;
      const t = (e.results[i][0].transcript || '').trim(); if (!t) continue;
      capFail = 0;
      const m = { from: realMe.uid, name: me.name, type: 'text', text: t, cap: 1, at: Date.now() };
      if (call.room === room && !homeOn) addMsg(m); else pushTo(call.room, m);
    }
  };
  r.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') capFail++; };
  r.onend = () => {
    if (capRec !== r || !capOn || !call) return;
    if (capFail >= 4) { capOn = false; toast('이 폰에서는 통화 중 자막이 잘 안 돼요 (통화는 그대로 돼요)'); return; }
    setTimeout(capGo, 300);
  };
  try { r.start(); } catch (e) { capFail++; setTimeout(capGo, 800); }
}
function capStop(){ capOn = false; const r = capRec; capRec = null; if (r) { try { r.abort(); } catch (e) {} } }
function drawCallCap(){
  const box = $('callCap'), on = !!(call && call.cap);
  box.classList.toggle('show', on); if (!on) return;
  const list = Object.values(msgs).filter(m => m.type === 'text' && (m.at || 0) >= call.t0).sort((a, b) => a.at - b.at).slice(-4);
  const h = list.map(m => `<div class="${isMine(m) ? 'me' : ''}"><b>${esc(isMine(m) ? '나' : m.name)}</b>${esc(m.text)}</div>`).join('');
  if (box._h !== h) { box._h = h; box.innerHTML = h; }
}

