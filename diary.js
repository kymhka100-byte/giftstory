/* 빨간 우체통 diary.js - 📒 일기장 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* --- 📒 일기장: 암호 4자리 · 날짜 · 날씨·기분 · 제목 · 내용 · 사진 1장 · 달력 --- */
const dyAll = () => LS.get('rp_diary', {});
const dKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dLabel = k => { const [y, m, d] = k.split('-').map(Number); return `${y}년 ${m}월 ${d}일 ${WEEK[new Date(y, m - 1, d).getDay()]}요일`; };
const DY_WEATHER = ['☀️', '⛅', '☁️', '🌧️', '❄️'], DY_MOOD = ['😄', '🙂', '😐', '😢', '😠'];
let dyKey = null, dyPhoto = '', dyTouched = false, dyW = '', dyM = '', dyMon = null, dySel = null;
async function dyUp(k){   // 서버에 올리기 (사진도 같이)
  if (!FB || !authUid) return;
  const e = dyAll()[k]; if (!e) return;
  const photo = e.ph ? (await idbGet('d_' + k).catch(() => '')) || '' : '';
  myPut('diary/' + k, { ...e, ph: null, photo });
}
async function diaryOpen(){
  click();
  if (!(await lockCheck())) return;
  dyShowDay(dKey(new Date())); $('diary').classList.add('show'); syncLayer();
}
function dyShowDay(k){
  dyKey = k; const e = dyAll()[k] || {}, ok = !e.del;
  $('dyDate').textContent = dLabel(k) + (k === dKey(new Date()) ? ' · 오늘' : '');
  $('dyTitle').value = ok && !e.auto ? e.title || '' : ''; $('dyText').value = ok ? e.body || '' : '';
  dyW = ok ? e.w || '' : ''; dyM = ok ? e.m || '' : ''; dyFoldSet(!!(dyW && dyM)); dyPickDraw();
  dyPhoto = ''; dyTouched = false; dyPicDraw();
  if (ok && e.ph) idbGet('d_' + k).then(p => { if (dyKey === k && p && !dyTouched) { dyPhoto = p; dyPicDraw(); } }).catch(() => {});
  dyView('write');
}
function dyView(v){
  const w = v === 'write';
  $('dyWrite').style.display = w ? '' : 'none'; $('dyCal').style.display = w ? 'none' : ''; $('dyTools').style.display = w ? '' : 'none';
  $('dySum').style.visibility = w ? '' : 'hidden';
  $('dyCalBtn').textContent = w ? '📅' : '✏'; $('dyHead').textContent = w ? '📒 일기장' : '📅 일기 달력';
  if (!w) { dyMicOff(); dySpeakOff(); dyCalDraw(); }
}
const DY_PAPER = { '😄': ['#2a2616', '#fff6cc'], '🙂': ['#2a1c24', '#ffe8ef'], '😐': ['#18241c', '#e9f6e4'], '😢': ['#141f2c', '#e3f1fc'], '😠': ['#2c1e14', '#ffead8'] };
function dyFoldSet(f){ $('diary').classList.toggle('fold', f); dySumBar(); }
function dySumBar(){
  const [y, m, d] = (dyKey || dKey(new Date())).split('-').map(Number);
  $('dySum').innerHTML = `<span class="dsw">${dyW}${dyM}</span> ${m}.${d} ${$('diary').classList.contains('fold') ? '▾' : '▴'}`;
  const c = DY_PAPER[dyM], pp = $('dyPaper');
  if (c) pp.style.setProperty('--dyp', document.body.classList.contains('dark') ? c[0] : c[1]); else pp.style.removeProperty('--dyp');
}
$('dySum').onclick = () => { click(); dyFoldSet(!$('diary').classList.contains('fold')); };
(() => { let h = ''; for (let a = 0; a < 360; a += 20) { const r = a * Math.PI / 180; h += `<path d="M${72 + 4 * Math.cos(r)} ${80 + 4 * Math.sin(r)} L${(72 + 22 * Math.cos(r)).toFixed(1)} ${(80 + 22 * Math.sin(r)).toFixed(1)}"/><circle cx="${(72 + 24 * Math.cos(r)).toFixed(1)}" cy="${(80 + 24 * Math.sin(r)).toFixed(1)}" r="1.6"/>`; } $('dySeeds').innerHTML = h; })();
if (LS.get('rp_dybig', false)) { $('diary').classList.add('dbig'); $('dyBig').classList.add('on'); }
$('dyBig').onclick = () => { click(); const on = $('diary').classList.toggle('dbig'); $('dyBig').classList.toggle('on', on); LS.set('rp_dybig', on); };
/* 🔊 읽어 주기 */
/* 65번: 폰은 긴 글을 한 번에 읽으면 중간에 멈춰요 → 문장마다 잘라서 차례로 */
function speakAll(t, rate, done){
  const parts = [];
  String(t).split(/(?<=[.!?。…\n])\s*/).forEach(x => { x = x.trim(); while (x.length > 120) { let k = x.lastIndexOf(' ', 120); if (k < 40) k = 120; parts.push(x.slice(0, k)); x = x.slice(k).trim(); } if (x) parts.push(x); });
  if (!parts.length) { done && done(); return; }
  const v = typeof koVoice === 'function' ? koVoice() : null;
  parts.forEach((x, i) => {
    const u = new SpeechSynthesisUtterance(x); u.lang = 'ko-KR'; u.rate = rate || 1; if (v) u.voice = v;
    if (i === parts.length - 1) u.onend = () => done && done();
    u.onerror = e => { if (e && e.error !== 'interrupted' && e.error !== 'canceled') done && done(); };
    speechSynthesis.speak(u);
  });
}
function dySpeakOff(){ try { speechSynthesis.cancel(); } catch (e) {} $('dyRead').classList.remove('on'); }
$('dyRead').onclick = () => {
  click();
  if (!window.speechSynthesis) { toast('이 폰에서는 읽어 주기가 안 돼요'); return; }
  if ($('dyRead').classList.contains('on')) { dySpeakOff(); return; }
  const t = [$('dyTitle').value.trim(), $('dyText').value.trim()].filter(Boolean).join('. ');
  if (!t) { toast('읽을 일기가 없어요'); return; }
  dyMicOff(); speechSynthesis.cancel();
  $('dyRead').classList.add('on');
  speakAll(t, .9, () => $('dyRead').classList.remove('on'));   // 65번: 긴 일기도 끝까지 (조각조각 이어서)
};
/* 🎤 일기 마이크 하나: 누른 칸에 써져요 · 제목 말하면 본문으로 · 73번: 1초 조용하면 다음 줄 · 3초 조용하면 꺼짐 */
let dyTgt = 'dyTitle', dyRec = null, dyQuiet = 0, dyNl = 0;
$('dyTitle').addEventListener('focus', () => { dyTgt = 'dyTitle'; });
$('dyText').addEventListener('focus', () => { dyTgt = 'dyText'; });
function dyMicOff(){ const r = dyRec; dyRec = null; clearTimeout(dyQuiet); clearTimeout(dyNl); if (r) { try { r.abort(); } catch (e) {} musicDuck(false); } $('dyMic').classList.remove('on'); }
function dyToBody(){ dyTgt = 'dyText'; const t = $('dyText'); t.placeholder = '🎤 이제 오늘 있었던 일을 말해 보세요'; }
function dyNewLine(){
  const t = $('dyText'); dyToBody();
  const p = t.selectionStart ?? t.value.length; t.value = t.value.slice(0, p) + '\n' + t.value.slice(t.selectionEnd ?? p);
  t.selectionStart = t.selectionEnd = p + 1; t.focus(); t.dispatchEvent(new Event('input'));
}
$('dyEnt').onclick = () => { click(); dyNewLine(); };
$('dyMic').onclick = () => {
  const R0 = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (dyRec) { click(); dyMicOff(); return; }
  if (!R0) { toast('이 화면에서는 말로 쓰기가 안 돼요 (크롬으로 열어 주세요)'); return; }
  click(); dySpeakOff(); if (dictR) dictOff();
  const r = dyRec = new R0(); r.lang = 'ko-KR'; r.continuous = true; r.interimResults = true;
  let el = $(dyTgt), base = el.value, pend = false;
  const hush = () => {
    clearTimeout(dyQuiet); dyQuiet = setTimeout(() => { if (dyRec === r) dyMicOff(); }, 3000);
    clearTimeout(dyNl); dyNl = setTimeout(() => { if (dyRec !== r || pend || el.id !== 'dyText' || !base || base.endsWith('\n')) return; base = el.value = base + '\n'; el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('input')); }, 1000);   // 73번: 1초 조용하면 줄 바꿈
  };
  const put = (t, fin) => {
    const sep = base && !/\s$/.test(base) ? ' ' : '';
    pend = !fin;
    if (!fin) { el.value = base + sep + t; return; }
    if (el.id === 'dyTitle') { el.value = (base + sep + t).slice(0, 30); dyToBody(); el = $('dyText'); base = el.value; if (base && !base.endsWith('\n')) base += '\n'; el.value = base; }
    else { base = el.value = base + sep + t; el.scrollTop = el.scrollHeight; }
    el.dispatchEvent(new Event('input'));
  };
  r.onresult = e => {
    let tmp = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript.trim(); if (!t) continue; if (e.results[i].isFinal) put(t, true); else tmp += t; }
    if (tmp) put(tmp, false);
    hush();
  };
  r.onerror = e => { if (/not-allowed/.test(e.error || '')) toast('마이크를 허용해 주세요 (주소창 왼쪽 → 권한)'); };
  r.onend = () => { if (dyRec === r) dyMicOff(); };
  try { r.start(); $('dyMic').classList.add('on'); musicDuck(true); hush(); toast('🎤 말씀하세요 · 3초 조용하면 꺼져요'); } catch (e) { dyMicOff(); }
};
function dyPickDraw(){
  $('dyPick').innerHTML = '<i>날씨</i>' + DY_WEATHER.map(x => `<button data-dw="${x}" class="${dyW === x ? 'on' : ''}">${x}</button>`).join('')
    + '<i>기분</i>' + DY_MOOD.map(x => `<button data-dm="${x}" class="${dyM === x ? 'on' : ''}">${x}</button>`).join('');
}
$('dyPick').addEventListener('click', e => { const b = e.target.closest('[data-dw],[data-dm]'); if (!b) return; click(); if (b.dataset.dw) dyW = dyW === b.dataset.dw ? '' : b.dataset.dw; else dyM = dyM === b.dataset.dm ? '' : b.dataset.dm; dyPickDraw(); dyFoldSet(!!(dyW && dyM)); });
function dyPicDraw(){ $('dyPic').innerHTML = dyPhoto ? `<img src="${dyPhoto}" alt="">` : ''; $('dyPicDel').style.display = dyPhoto ? '' : 'none'; $('dyPicBtn').textContent = dyPhoto ? '🖼 사진 바꾸기' : '🖼 오늘 사진 넣기'; }
$('dyPicBtn').onclick = () => { click(); $('dyPicFile').click(); };
$('dyPicDel').onclick = () => { click(); dyPhoto = ''; dyTouched = true; dyPicDraw(); };
$('dyPicFile').onchange = async () => {
  const f = $('dyPicFile').files[0]; $('dyPicFile').value = ''; if (!f) return;
  const r = await shrinkImg(f, 900, .72, 60); if (!r) { toast('사진을 열 수 없어요'); return; }
  dyPhoto = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(''); fr.readAsDataURL(r.blob); });
  dyTouched = true; dyPicDraw();
};
function dyDirty(){
  if (!dyKey || $('dyWrite').style.display === 'none') return false;
  const e = dyAll()[dyKey] || {}, s = e.del ? {} : e;
  return $('dyTitle').value.trim() !== (s.auto ? '' : s.title || '') || $('dyText').value.trim() !== (s.body || '') || dyW !== (s.w || '') || dyM !== (s.m || '') || dyTouched;
}
function dySaveNow(){
  const title = $('dyTitle').value.trim(), body = $('dyText').value.trim(), k = dyKey, all = dyAll(), prev = all[k] || {};
  const ph = dyTouched ? (dyPhoto ? 1 : 0) : (prev.del ? 0 : prev.ph || 0);
  if (!title && !body && !ph) {
    if (prev.title || prev.body || prev.ph) { all[k] = { del: 1, up: Date.now() }; LS.set('rp_diary', all); idbDel('d_' + k).catch(() => {}); myPut('diary/' + k, all[k]); toast('이날 일기를 비웠어요'); return true; }
    toast('일기를 적어 주세요'); return false;
  }
  all[k] = { title: title || body.replace(/\s+/g, ' ').slice(0, 14) || '사진', auto: title ? 0 : 1, body, w: dyW, m: dyM, ph, up: Date.now() };
  LS.set('rp_diary', all);
  const p = dyTouched ? (dyPhoto ? idbPut('d_' + k, dyPhoto) : idbDel('d_' + k)) : Promise.resolve();
  p.catch(() => {}).finally(() => dyUp(k));
  dyTouched = false;
  sentFx(); toast('📒 일기를 저장했어요 · 달력에 표시돼요');
  return true;
}
$('dySave').onclick = () => {
  dyMicOff(); dySpeakOff();
  if (!dySaveNow()) return;
  dySel = dyKey; const [y, m] = dyKey.split('-').map(Number); dyMon = new Date(y, m - 1, 1); dyView('cal');
};
function diaryClose(){
  if (dictR) { try { dictR.stop(); } catch (e) {} }
  dyMicOff(); dySpeakOff();
  if (dyDirty()) dySaveNow();   // 고친 게 있으면 저절로 저장
  $('diary').classList.remove('show'); syncLayer();
}
$('dyCalBtn').onclick = () => {
  click();
  if ($('dyCal').style.display === 'none') {
    if (dyDirty()) dySaveNow();
    dySel = dySel || dyKey; const [y, m] = (dySel || dKey(new Date())).split('-').map(Number); dyMon = new Date(y, m - 1, 1); dyView('cal');
  } else dyShowDay(dySel || dKey(new Date()));
};
/* 달력: 날짜 밑에 짧은 제목 → 날짜를 누르면 아래에 요약 → 요약을 누르면 일기 전체 */
function dyCalDraw(){
  if (!dyMon) { const n = new Date(); dyMon = new Date(n.getFullYear(), n.getMonth(), 1); }
  const y = dyMon.getFullYear(), m = dyMon.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), all = dyAll(), today = dKey(new Date());
  $('calTitle').textContent = `${y}년 ${m + 1}월`;
  let h = WEEK.map(w => `<div class="w">${w}</div>`).join('') + '<div class="c x"></div>'.repeat(first);
  for (let d = 1; d <= days; d++) {
    const k = dKey(new Date(y, m, d)), e = all[k], has = e && !e.del;
    h += `<div class="c ${has ? 'has' : ''} ${k === today ? 'today' : ''} ${k === dySel ? 'sel' : ''}" data-dk="${k}">${d}${has ? `<small>${esc([...(e.title || '')].slice(0, 4).join(''))}</small>` : ''}</div>`;
  }
  $('calGrid').innerHTML = h;
  dySumDraw();
}
function dySumDraw(){
  const box = $('calSum');
  if (!dySel) { box.innerHTML = '<div class="tdempty">날짜를 누르면 그날 일기가 보여요</div>'; return; }
  const e = dyAll()[dySel];
  if (!e || e.del) { box.innerHTML = `<div class="dsum" data-dopen="${dySel}"><b>${dLabel(dySel)}</b><p>이날은 일기가 없어요</p><small>✏ 눌러서 이날 일기 쓰기</small></div>`; return; }
  box.innerHTML = `<div class="dsum" data-dopen="${dySel}"><span id="dsImg"></span><b>${esc((e.w || '') + (e.m || ''))} ${esc(e.title)}</b><p>${esc(e.body)}</p><small>${dLabel(dySel)} · 눌러서 일기 전체 보기 ›</small></div>`;
  if (e.ph) idbGet('d_' + dySel).then(p => { const s = $('dsImg'); if (p && s) s.innerHTML = `<img src="${p}" alt="">`; }).catch(() => {});
}
$('calGrid').addEventListener('click', e => { const c = e.target.closest('[data-dk]'); if (!c) return; click(); dySel = c.dataset.dk; dyCalDraw(); });
$('calSum').addEventListener('click', e => { const s = e.target.closest('[data-dopen]'); if (s) { click(); dyShowDay(s.dataset.dopen); } });
$('calPrev').onclick = () => { click(); dyMon = new Date(dyMon.getFullYear(), dyMon.getMonth() - 1, 1); dyCalDraw(); };
$('calNext').onclick = () => { click(); dyMon = new Date(dyMon.getFullYear(), dyMon.getMonth() + 1, 1); dyCalDraw(); };

/* --- 🔒 일기장 암호 (숫자 네 자리 · 잊으면 구글로 다시 로그인해서 새로 정하기) --- */
let lockBuf = '', lockMode = 'check', lockFirst = '', lockOk = null, lockAt = 0, lockChg = false;   // 54번: 암호 바꾸기
async function pinHash(p){
  const s = 'rp-diary|' + p;
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { return 'h' + hashN(s, 1e9); }
}
function lockCheck(){
  if (Date.now() - lockAt < 5 * 60000) return Promise.resolve(true);   // 5분 안에 다시 열면 그대로
  return new Promise(ok => {
    if (lockOk) lockOk(false);
    lockOk = ok; lockBuf = ''; lockFirst = ''; lockChg = false;
    lockMode = LS.get('rp_dpin', '') ? 'check' : 'new';
    lockDraw(); showOv('lockOv');
  });
}
function lockDraw(){
  $('lockTitle').textContent = lockMode === 'check' ? '🔒 일기장 암호' : lockMode === 'new' ? '🔒 일기장 암호 정하기' : '🔒 한 번 더 눌러 주세요';
  $('lockSub').textContent = lockMode === 'check' ? (lockChg ? '지금 쓰는 암호를 먼저 눌러 주세요' : '숫자 네 자리를 눌러 주세요') : lockMode === 'new' ? '일기장을 열 때 쓸 숫자 네 자리' : '확인을 위해 같은 숫자 네 자리';
  $('lockDots').innerHTML = [0, 1, 2, 3].map(i => `<i class="${i < lockBuf.length ? 'on' : ''}"></i>`).join('');
  $('lockForgot').style.display = lockMode === 'check' ? '' : 'none';
  $('lockChange').style.display = lockMode === 'check' && !lockChg ? '' : 'none';
}
$('lockKeys').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', ''].map(k => `<button data-k="${k}" class="${k ? '' : 'blank'}">${k}</button>`).join('');
function lockDone(v){ lockAt = v ? Date.now() : 0; const f = lockOk; lockOk = null; hideOv('lockOv'); if (f) f(v); }
$('lockKeys').addEventListener('click', e => {
  const b = e.target.closest('[data-k]'); if (!b || !b.dataset.k) return; click();
  if (b.dataset.k === '←') { lockBuf = lockBuf.slice(0, -1); lockDraw(); return; }
  if (lockBuf.length >= 4) return;
  lockBuf += b.dataset.k; lockDraw();
  if (lockBuf.length < 4) return;
  const p = lockBuf;
  setTimeout(async () => {
    if (lockMode === 'check') {
      if (await pinHash(p) === LS.get('rp_dpin', '')) { if (lockChg) { lockChg = false; lockMode = 'new'; lockBuf = ''; lockDraw(); } else lockDone(true); }
      else { lockBuf = ''; lockDraw(); toast('암호가 달라요'); if (navigator.vibrate) navigator.vibrate(200); }
    } else if (lockMode === 'new') { lockFirst = p; lockBuf = ''; lockMode = 'again'; lockDraw(); }
    else if (p === lockFirst) { const h = await pinHash(p); LS.set('rp_dpin', h); myPut('pin', h); toast('🔒 일기장 암호를 정했어요'); lockDone(true); }
    else { lockMode = 'new'; lockBuf = ''; lockFirst = ''; lockDraw(); toast('두 번 누른 숫자가 달라요 · 다시 정해 주세요'); }
  }, 150);
});
document.querySelector('#lockOv [data-close]').addEventListener('click', () => { const f = lockOk; lockOk = null; if (f) f(false); });
$('lockChange').onclick = () => { click(); lockChg = true; lockBuf = ''; lockDraw(); };
$('lockForgot').onclick = () => {
  click();
  const au0 = LS.get('rp_auth', null);
  if (au0 && au0.k === 'kakao') {   // 54번: 카카오로 가입한 사람은 카카오로 다시 로그인해서 새로 정해요
    if (!confirm('카카오로 다시 로그인하면 암호를 새로 정할 수 있어요.\n로그인할까요?')) return;
    LS.set('rp_pinreset', au0.uid); kakaoLogin(); return;
  }
  if (!confirm('구글로 다시 로그인하면 암호를 새로 정할 수 있어요.\n로그인할까요?')) return;
  if (!LG) { loginPrep().catch(() => {}); toast('로그인 준비 중이에요 · 잠깐 뒤 한 번 더 눌러 주세요'); return; }
  const { A, auth, prov } = LG;
  A.signInWithPopup(auth, prov).then(res => {
    const u = res && res.user; if (!u) return;
    const au = LS.get('rp_auth', null);
    if (au && au.uid !== u.uid) { toast('처음에 쓰던 구글 계정으로 로그인해 주세요'); return; }
    if (!au) { LS.set('rp_auth', { uid: u.uid, name: u.displayName || '' }); syncAccount(); }
    LS.set('rp_dpin', ''); FB.D.set(FB.D.ref(FB.db, 'giftstory/users/' + u.uid + '/my/pin'), null).catch(() => {});
    lockMode = 'new'; lockBuf = ''; lockFirst = ''; lockDraw(); toast('✓ 확인됐어요 · 새 암호를 정해 주세요');
  }).catch(e => { if (!/popup-closed|cancelled-popup/.test((e && e.code) || '')) toast('로그인이 안 됐어요'); });
};

