/* 빨간 우체통 silver.js - 👵 실버 모드 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* ===== 👵 실버 모드 (어르신용) =====
   · 숨김: 맨 위 작은 우체통을 길게 누르면 열려요
   · 화면은 늘 큰 글씨 + 어두운 화면 (바꿀 수 없음 → 다시 열어도 그대로)
   · 실버 모드 제목을 길게 누르면 테스트 메시지가 와요 (진짜로 보내지 않음) */
const SV_GROUPS = [['kids', '자식'], ['grand', '손주'], ['inlaw', '사위'], ['friend', '친구']];
const svData = () => LS.get('rp_silver', { elder: null, fam: [] });
const svSave = d => LS.set('rp_silver', d);
const S = { on: false, view: 'home', room: null, fam: null, test: false, edit: null, gen: 'f' };
/* 어르신이 자기를 부르는 말: 자식에게 엄마, 손주에게 할머니 … */
function svCall(g){
  const e = svData().elder || { gen: 'f', name: '' }, f = e.gen !== 'm';
  return { kids: f ? '엄마' : '아빠', grand: f ? '할머니' : '할아버지', inlaw: f ? '장모' : '장인', friend: '나' }[g] || (f ? '엄마' : '아빠');
}
/* 부르는 이름: 민지 → 민지야, 지영 → 지영아, 아들 → 아들 */
function svVoc(name){
  const n = String(name || '').trim(); if (!n) return '';
  if (/(아들|딸|사위|며느리|손자|손녀|손주|형|언니|오빠|누나|동생)\d*$/.test(n)) return n;
  const c = n.charCodeAt(n.length - 1) - 0xAC00;
  return c >= 0 && c < 11172 ? n + (c % 28 ? '아' : '야') : n;
}
const SV_REPLIES = [
  (v, c) => `그래 ${v}, ${c} 밥 먹었다. 너는 밥 먹었니?`,
  (v, c) => `그래 ${v}, ${c}도 너를 사랑해`,
  v => `${v}, 아직 안 먹었다`,
  v => `오냐 ${v}, 잘 있다`,
  v => `${v}, 보고 싶다`,
  v => `${v}, 언제 오냐?`,
  v => `그래 ${v}, 오거라`,
  v => `${v}, 고맙다`,
  v => `${v}, 몸조심해라`,
  v => `${v}, 전화해라`
];
const svFamOf = id => svData().fam.find(f => f.room === id);
const svShown = o => $(o).classList.contains('show');
const svLayer = () => S.on && (S.view !== 'home' || ['svSheet', 'svVoice', 'svEdit'].some(svShown));
function svOv(id, on){ $(id).classList.toggle('show', on); syncLayer(); }

/* 22번: 가족 초대 링크로 들어오면 그 가족 버튼을 저절로 만들어요 */
function svApplyInvite(inv){
  inv = inv || LS.get('rp_sv_pend', null); if (!inv || !inv.room) return;
  const d = svData();
  if (!d.elder) d.elder = { name: me.name, gen: inv.g === 'm' ? 'm' : 'f' };
  const f = d.fam.find(x => x.room === inv.room);
  if (!f) d.fam.push({ id: rid(), g: relGroup(inv.r || ''), name: inv.r || inv.n || inv.k || '가족', rn: inv.r ? inv.n : '', phone: inv.p || '', room: inv.room, nick: inv.k || inv.n || '대화방', photo: inv.ph || '' });
  else {   // 24번: 이미 있는 버튼인데 비어 있으면 채워요
    if (!f.phone && inv.p) f.phone = inv.p;
    if (!f.rn && inv.r && inv.n) f.rn = inv.n;
    if ((!f.nick || f.nick === '대화방') && inv.k) f.nick = inv.k;
    if (!f.photo && inv.ph) f.photo = inv.ph;   // 26번: 보낸 사람 사진
  }
  svSave(d); LS.set('rp_silver_on', 1); LS.set('rp_sv_pend', null);
  if (S.on) svHome(true);
}
/* 24번: 링크에 정보가 없어도 서버에 적어 둔 초대 정보로 가족 버튼을 채워요 */
async function svFetchInvite(id){
  if (!FB || !id) return;
  try { const v = (await FB.D.get(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/svinv'))).val(); if (v && v.k !== me.name) svApplyInvite({ ...v, room: id }); } catch (e) {}
}
function svPutInvite(id, inv){
  if (!FB || !id) return;
  const put = () => FB.D.set(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/svinv'), inv);
  put().catch(() => setTimeout(() => put().catch(() => {}), 2500));
}
/* 열기 · 닫기 */
function svOpen(){
  S.on = true; S.view = 'home'; LS.set('rp_silver_on', 1);
  $('silver').classList.add('show');
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  grpList().forEach(g => grpSilver(g.id));
  svHome(true); requestAnimationFrame(svFit);
  if (!svData().elder) svSetupShow();
}
function svExit(){
  svStopListen(); svHush();
  ['svSheet', 'svVoice', 'svEdit', 'svSetup'].forEach(o => $(o).classList.remove('show'));
  S.on = false; S.view = 'home'; LS.set('rp_silver_on', 0);
  $('silver').classList.remove('show'); syncLayer(); render();
  toast('일반 화면으로 돌아왔어요');
}
/* 뒤로 가기 버튼 */
function svBackLayer(){
  if (!S.on) return;
  if (svShown('svVoice')) { svStopListen(); $('svVoice').classList.remove('show'); return; }
  ['svSheet', 'svEdit'].forEach(o => $(o).classList.remove('show'));
  svHush(); S.test = false;
  if (S.view === 'chat') svGoHome();
}

/* 어르신 정보 */
function svSetupShow(){
  const e = svData().elder || { name: me.name || '', gen: 'f' };
  $('svSName').value = e.name; S.gen = e.gen;
  document.querySelectorAll('[data-gen]').forEach(b => b.classList.toggle('on', b.dataset.gen === S.gen));
  svVoicesDraw();
  svOv('svSetup', true);
}
function svVoicesDraw(){
  const list = koVoices(), cur = koVoice();
  $('svVoices').innerHTML = list.length ? list.map((x, i) => `<button data-vi="${i}" class="${cur && cur.voiceURI === x.voiceURI ? 'on' : ''}">🔊 목소리 ${i + 1} <small style="opacity:.6">${esc(x.name)}</small></button>`).join('')
    : '<div style="font-size:17px;color:#8f96c0">한국어 목소리를 찾는 중이에요… (휴대폰 설정 → 텍스트 음성 변환에서 한국어를 받아 주세요)</div>';
}
$('svVoices').addEventListener('click', e => {
  const b = e.target.closest('[data-vi]'); if (!b) return;
  const x = koVoices()[+b.dataset.vi]; if (!x) return;
  LS.set('rp_voice', x.voiceURI); svVoicesDraw();
  svSpeak('안녕하세요. 이 목소리로 읽어 드릴게요.');
});
document.querySelectorAll('[data-gen]').forEach(b => b.onclick = () => { S.gen = b.dataset.gen; click(); document.querySelectorAll('[data-gen]').forEach(x => x.classList.toggle('on', x === b)); });
$('svSOk').onclick = () => {
  const n = $('svSName').value.trim(); if (!n) { toast('어르신 이름을 적어 주세요'); return; }
  const d = svData(); d.elder = { name: n, gen: S.gen }; svSave(d);
  if (!me.name) { me.name = n; saveMe(); }
  click(); svOv('svSetup', false); svHome(true);
};

/* 첫 화면: 자식 · 손주 · 사위 · 친구 줄, ＋로 늘리기 */
let svHomeHTML = '';
function svHome(force){
  const fam = svData().fam;
  const btn = f => `<button class="sv-btn ${svIsLive(f) ? 'live' : ''}" data-fam="${f.id}"><span class="top">${f.photo ? `<img src="${f.photo}" alt="">` : ''}<span class="nm">${esc(f.name)}</span></span>${f.rn ? `<span class="rn">${esc(f.rn)}</span>` : ''}${f.phone ? `<span class="ph">${f.phone.replace(/\D/g, '') ? `<i class="tel" data-tel="${esc(f.phone)}">📞</i>` : ''}${esc(f.phone)}</span>` : ''}<span class="nk">${f.room ? '💬 ' + esc(f.nick || '대화방') : '닉네임을 골라 주세요'}</span></button>`;
  const html = SV_GROUPS.map(([g, label]) => {
    const list = fam.filter(f => f.g === g);
    return `<div class="sv-grp"><h3>${label}</h3><div class="sv-row">${list.map(btn).join('')}<button class="sv-btn addb" data-new="${g}" aria-label="${label} 더하기"><span class="plus">＋</span>${list.length ? '' : '<span class="nk">눌러서 이름 적기</span>'}</button></div></div>`;   // 48번: ＋는 빈칸 가운데
  }).join('') + `<div class="sv-foot"><button id="svElder">👵 어르신 정보</button></div>`;
  if (S.view !== 'chat') $('svOutTop').classList.add('show');   // 48번: 일반 화면 버튼은 왼쪽 아래 작게
  if (S.view === 'home') svHeadHome();
  if (!force && html === svHomeHTML) return;
  svHomeHTML = html; $('svHome').innerHTML = (fam.length ? '' : `<button class="sv-back" id="svFirst">◀ 처음 화면으로</button>`) + html;   // 24번: 잘못 들어온 사람용 (가족이 없을 때만)
  if (!fam.length) $('svFirst').onclick = () => { click(); svExit(); nameScreen(); };
  $('svElder').onclick = () => { click(); svSetupShow(); };
  requestAnimationFrame(svFit);
}
/* 47번: 맨 위 제목 = 실버톡(이름 세 자) */
function svHeadHome(){ const n = String((svData().elder || {}).name || '').trim(); $('svTitle').textContent = '실버톡'; $('svWho').textContent = n ? '(' + [...n].slice(0, 3).join('') + ')' : ''; $('silver').classList.remove('chat'); }   // 48번: 이름은 작게
/* 47번: 이름이 길면 글씨를 줄여서 한 줄에 (버튼 크기는 모두 같아요) */
function svFit(){
  document.querySelectorAll('#svHome .sv-btn .nm').forEach(n => {
    let z = n.closest('.empty') ? 26 : 34; n.style.fontSize = z + 'px';
    while (n.clientWidth && n.scrollWidth > n.clientWidth && z > 14) { z -= 2; n.style.fontSize = z + 'px'; }
  });
}
/* 가족 버튼: 누르면 대화방, 길게 누르면 고치기 */
let svLpT = 0, svLpDone = false;
$('svHome').addEventListener('pointerdown', e => {
  if (e.target.closest('[data-tel]')) return;   // 47번: 📞 는 길게 누르기 없음
  const b = e.target.closest('[data-fam]'); if (!b) return;
  svLpDone = false; clearTimeout(svLpT);
  svLpT = setTimeout(() => { svLpDone = true; if (navigator.vibrate) navigator.vibrate(30); svEditShow(svData().fam.find(f => f.id === b.dataset.fam)); }, 700);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('svHome').addEventListener(t, () => clearTimeout(svLpT)));
$('svHome').addEventListener('contextmenu', e => e.preventDefault());
$('svHome').addEventListener('click', e => {
  const tl = e.target.closest('[data-tel]');   // 47번: 📞 누르면 전화 (전화 화면에서 통화 버튼 한 번 더)
  if (tl) { click(); svHush(); location.href = 'tel:' + tl.dataset.tel.replace(/[^\d+]/g, ''); return; }
  const n = e.target.closest('[data-new]');
  if (n) { click(); svEditShow({ id: rid(), g: n.dataset.new, name: '', phone: '', room: null, nick: '', isNew: true }); return; }
  const b = e.target.closest('[data-fam]'); if (!b) return;
  if (svLpDone) { svLpDone = false; return; }
  const f = svData().fam.find(x => x.id === b.dataset.fam); if (!f) return;
  click();
  if (!f.room) { svEditShow(f); toast('닉네임(대화방)을 골라 주세요'); return; }
  svEnter(f);
});

/* 고치기: 이름(크게) · 전화번호 · 닉네임(내 대화방 목록에서 고르기) */
function svEditShow(f){
  if (!f) return;
  S.edit = { ...f };
  $('svEditTitle').textContent = (SV_GROUPS.find(([g]) => g === f.g) || [, '가족'])[1] + (f.isNew ? ' 추가' : ' 고치기');
  $('svEName').value = f.name || ''; $('svEPhone').value = f.phone || '';
  $('svENick').textContent = f.room ? '💬 ' + (f.nick || '대화방') + '  (바꾸려면 누르기)' : '눌러서 고르기';
  $('svNicks').style.display = 'none';
  $('svEDel').style.display = f.isNew ? 'none' : '';
  svPicDraw();
  svOv('svEdit', true);
}
function svNickList(){
  const rooms = visibleRooms();
  $('svNicks').innerHTML = rooms.map(x => { const t = titleFor(x.id) || x.title || '새 방'; return `<button data-nick="${x.id}" class="${S.edit.room === x.id ? 'on' : ''}">💬 ${esc(t)}</button>`; }).join('')
    + `<div style="font-size:16px;color:#8f96c0;margin-top:6px">목록에 없으면 새로 초대하세요</div><div class="inv"><button data-inv="kakao">카톡으로 초대</button><button data-inv="sms">문자로 초대</button></div>`;
  $('svNicks').style.display = '';
}
$('svENick').onclick = () => { click(); if ($('svNicks').style.display === 'none') svNickList(); else $('svNicks').style.display = 'none'; };
$('svNicks').addEventListener('click', e => {
  const n = e.target.closest('[data-nick]');
  if (n) {
    click(); S.edit.room = n.dataset.nick; S.edit.nick = titleFor(n.dataset.nick) || (getRooms().find(x => x.id === n.dataset.nick) || {}).title || '대화방';
    if (!$('svEName').value.trim()) $('svEName').value = S.edit.nick;
    $('svENick').textContent = '💬 ' + S.edit.nick + '  (바꾸려면 누르기)'; $('svNicks').style.display = 'none'; return;
  }
  const v = e.target.closest('[data-inv]'); if (!v) return;
  const nm = $('svEName').value.trim() || (SV_GROUPS.find(([g]) => g === S.edit.g) || [, '가족'])[1];
  const id = rid(); saveRoom(id, nm);
  S.edit.room = id; S.edit.nick = nm;
  $('svENick').textContent = '💬 ' + nm + ' (초대 보냄)'; $('svNicks').style.display = 'none';
  shareTo(v.dataset.inv, roomURL(id), inviteText());
});
$('svESave').onclick = () => {
  const name = $('svEName').value.trim(); if (!name) { toast('이름을 적어 주세요'); return; }
  const d = svData(), f = { id: S.edit.id, g: S.edit.g, name, phone: $('svEPhone').value.trim(), room: S.edit.room || null, nick: S.edit.nick || '', photo: S.edit.photo || '', rn: S.edit.rn || '' };
  const i = d.fam.findIndex(x => x.id === f.id);
  if (i >= 0) d.fam[i] = f; else d.fam.push(f);
  svSave(d); click(); svOv('svEdit', false); svHome(true); render();
};
/* 가족 사진: 작게 줄여서 이 휴대폰에만 저장 */
function svPicDraw(){ const p = S.edit && S.edit.photo; $('svEPic').innerHTML = p ? `<img src="${p}" alt="">` : ''; $('svEPicDel').style.display = p ? '' : 'none'; }
$('svEPicBtn').onclick = () => { click(); $('svEPicFile').click(); };
$('svEPicDel').onclick = () => { click(); S.edit.photo = ''; svPicDraw(); };
$('svEPicFile').onchange = () => {
  const f = $('svEPicFile').files[0]; $('svEPicFile').value = ''; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const n = 220, c = document.createElement('canvas'), k = Math.max(n / img.width, n / img.height);
    c.width = c.height = n; const w = img.width * k, h = img.height * k;
    c.getContext('2d').drawImage(img, (n - w) / 2, (n - h) / 2, w, h);
    S.edit.photo = c.toDataURL('image/jpeg', .8); URL.revokeObjectURL(url); svPicDraw();
  };
  img.onerror = () => toast('사진을 열 수 없어요');
  img.src = url;
};
$('svEDel').onclick = () => {
  const d = svData(); d.fam = d.fam.filter(x => x.id !== S.edit.id); svSave(d);
  click(); svOv('svEdit', false); svHome(true); toast('버튼을 지웠어요');
};
document.querySelectorAll('[data-svclose]').forEach(b => b.onclick = () => { click(); svHush(); S.test = false; svOv(b.closest('.sv-ov').id, false); });

/* 들어와 있는 가족 = 노란 버튼 (1분마다 '보고 있음' 표시) */
const svLive = {}, svLiveUn = {};
const svOthers = id => Object.keys(roomMembers[id] || {}).filter(u => !me.ids.includes(u));
const svIsLive = f => !!f.room && svOthers(f.room).some(u => (svLive[u] || 0) > Date.now() - 150000);
function svWatchLive(){
  if (!FB || !authUid) return;
  svData().fam.forEach(f => { if (f.room) svOthers(f.room).forEach(u => {
    if (!svLiveUn[u]) svLiveUn[u] = FB.D.onValue(FB.D.ref(FB.db, 'giftstory/live/' + u), s => { svLive[u] = s.val() || 0; if (S.on && S.view === 'home') svHome(); });
  }); });
}
function svRefresh(){ svWatchLive(); svMusicDraw(); $('svMail').classList.toggle('has', unreadIn().length > 0); svLetter(); if (S.view === 'home') svHome(); else svChat(); }

/* 대화방: 들어가면 "아들, 엄마 들어왔다. 지금 뭐하니?" 저절로 보내요 (5분 안에 다시 들어가면 안 보냄) */
function svEnter(f, quiet){
  S.view = 'chat'; S.room = f.room; S.fam = f;
  $('svHome').style.display = 'none'; $('svChat').style.display = ''; $('svBar').style.display = ''; $('svBack').style.display = '';
  $('svTitle').textContent = f.name; $('svWho').textContent = ''; $('silver').classList.add('chat'); $('svOutTop').classList.remove('show');
  $('svPhone').classList.toggle('show', !!(f.phone && f.phone.replace(/\D/g, '')));
  if (room !== f.room || homeOn) openRoom(f.room);
  const hello = LS.get('rp_sv_hello', {});
  if (!quiet && Date.now() - (hello[f.room] || 0) > 300000) {
    hello[f.room] = Date.now(); LS.set('rp_sv_hello', hello);
    svSend(`${svVoc(f.name)}, ${svCall(f.g)} 들어왔다. 지금 뭐하니?`);
  }
  svChat(); svMusicDraw(); syncLayer();
}
function svGoHome(){
  S.view = 'home'; S.fam = null;
  $('svHome').style.display = ''; $('svChat').style.display = 'none'; $('svBar').style.display = 'none'; $('svBack').style.display = 'none';
  svHeadHome(); $('svPhone').classList.remove('show'); svHome(true); svMusicDraw(); syncLayer();
}
$('svBack').onclick = () => { click(); svHush(); svGoHome(); };
$('svOutTop').onclick = () => { click(); svExit(); };
/* 47번: 실버 편지 쓰기 · 편지함 = 일반 화면 편지 기능 그대로 (일반 화면을 바꾸면 같이 바뀌어요) */
$('svWrite').onclick = () => { click(); svHush(); openWriter(S.view === 'chat' && S.fam ? { to: S.fam.name, body: '', paper: 'tulip', font: 'pen', stickers: [], voice: null, draftId: null, align: '' } : undefined); };
/* 55번: 실버 모드에서도 편지가 오면 "편지가 왔어요" + 봉투 꿈틀 (일반 화면과 같게) */
function svLetter(){
  const o = $('svArrive'); if (!o) return;
  const un = unreadIn().filter(m => !(m.letter && m.letter.deliverAt > Date.now())), key = un.map(x => x.id).join(',');
  if (!un.length) { o._k = ''; if (o.classList.contains('show')) svOv('svArrive', false); return; }
  if (o._k === key) return; o._k = key;
  const m = un[0], L = m.letter || {}, e = $('svEnv'), cd = L.card;
  e.classList.toggle('card', !!cd);
  if (cd) { e._f = ''; e.style.backgroundImage = svgURI(envSVG({ ...cd, to: cd.to || me.name, from: cd.from || L.fromName, at: whenOf(m) })); } else lhImg(e, 'letter_invite.jpg');
  e.querySelector('.f').innerHTML = `당신의 벗<br>${esc(L.fromName || m.name || '')}`;
  e.querySelector('.t').innerHTML = `소중한 친구<br>${esc(me.name || L.to || '')}에게`;
  e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
  $('svArrHint').textContent = un.length > 1 ? `편지가 ${un.length}통 와 있어요 · 봉투를 누르세요` : '봉투를 누르면 편지가 열려요';
  svOv('svArrive', true); letterArriveSnd();
}
$('svEnv').onclick = () => { click(); svOv('svArrive', false); const un = unreadIn(); if (un.length) openBox(un); };
$('svArrLater').onclick = () => { click(); svOv('svArrive', false); };
$('svMail').onclick = () => { svHush(); const un = unreadIn(); if (un.length) { click(); openBox(un); } else $('pileBtn').click(); };   // 새 편지가 있으면 우체통, 없으면 편지함
$('tmSilver').onclick = () => { click(); closeMenus(); svOpen(); };
$('svChat').addEventListener('click', e => { const f = e.target.closest('[data-svfile]'); if (f) { const m = msgs[f.dataset.svfile]; if (m) { click(); fileOpenAny(room, m, f.querySelector('img')); } return; } const b = e.target.closest('[data-vid]'); if (b) { click(); Promise.resolve(playVoiceMsg(msgs[b.dataset.vid])).catch(() => toast('재생이 안 돼요')); } });
/* 같이 듣는 노래: 위쪽 큰 ▶/⏸ 버튼 */
function svMusicDraw(){
  const b = $('svMusic'), on = S.on && S.view === 'chat' && !!M;
  b.classList.toggle('show', on);
  if (on) b.textContent = mOn() && !mBlocked ? '🎵 ⏸' : '🎵 ▶';
}
$('svMusic').onclick = () => mPlayToggle();
/* 📞 전화: 등록한 번호로 전화 걸기 (웹에서는 전화 화면에 번호가 적힌 채로 열려요 → 초록 통화 버튼 한 번) */
$('svPhone').onclick = () => { if (!S.fam || !S.fam.phone) return; click(); svHush(); location.href = 'tel:' + S.fam.phone.replace(/[^\d+]/g, ''); };
let svChatHTML = '';
function svChat(){
  if (S.room !== room) return;
  const list = sorted().filter(m => m.type === 'text' || m.type === 'voice' || m.type === 'file').slice(-40);   // 52번: 실버 모드에서도 사진·파일 보이기
  let html = '', last = '';
  list.forEach(m => {
    const mine = isMine(m);
    if (!mine && m.name !== last) html += `<div class="sv-who">${esc(m.name)}</div>`;
    last = mine ? '' : m.name;
    if (m.type === 'file') { const u = fileUrls[m.fid] || m.thumb || ''; html += `<div class="sv-m ${mine ? 'me' : 'them'}" data-svfile="${m.id}" style="cursor:pointer">${m.kind === 'image' && u ? `<img src="${u}" alt="" style="max-width:100%;max-height:240px;border-radius:12px;display:block">` : fileLabel(m) + ' · 눌러서 보기'}</div>`; return; }
    html += m.type === 'voice' ? `<div class="sv-m voice ${mine ? 'me' : 'them'}" data-vid="${m.id}">🔊 목소리 듣기</div>` : `<div class="sv-m ${mine ? 'me' : 'them'}">${linky(m.text)}</div>`;
  });
  html = `<div class="sv-wrap">${html || '<div class="sv-empty">아직 대화가 없어요</div>'}</div>`;
  if (html === svChatHTML) return;
  svChatHTML = html; const box = $('svChat'); box.innerHTML = html; box.scrollTop = box.scrollHeight;
}
function svSend(text){
  if (S.test) { toast('🧪 테스트라서 보내지 않았어요: ' + text); return; }
  sentFx(); addMsg({ from: realMe.uid, name: me.name, type: 'text', text, at: Date.now() });
  render.jump = true;
}

/* 메시지가 오면: 큰 글씨로 보여 주고 소리로 읽은 다음 → 답장 목록 */
const svDone = new Set();
function svIncoming(id, m){
  if (m && isBlocked(m.from)) return;
  if (S.on && m && m.type === 'voice' && !isMine(m) && !svDone.has(m.id)) {   // 손주 목소리 → 바로 스피커로
    svDone.add(m.id); if (svShown('svVoice')) return;
    const f = svFamOf(id); if (f && (S.view !== 'chat' || S.room !== id)) svEnter(f, true);
    svHush(); Promise.resolve(playVoiceMsg(m)).catch(() => toast('🔊 화면을 누르면 목소리가 나와요'));
    return;
  }
  if (!S.on || !m || m.type !== 'text' || isMine(m) || svDone.has(m.id)) return;
  svDone.add(m.id);
  const f = svFamOf(id); if (!f) return;
  if (svShown('svVoice') || svShown('svEdit') || svShown('svSetup')) return;   // 말하는 중·고치는 중엔 방해 안 함
  if (S.view !== 'chat' || S.room !== id) svEnter(f, true);
  svShowMsg(m, f);
}
/* 27번: 답장 문구는 사람마다 따로 (추가 · 수정) */
const svRepAll = () => LS.get('rp_sv_reps', {});
function svReps(f){ const a = svRepAll()[f.id]; if (Array.isArray(a) && a.length) return a; const v = svVoc(f.name), c = svCall(f.g); return SV_REPLIES.map(r => r(v, c)); }
let svREdit = false, svRepF = null;
function svRepDraw(focusLast){
  const f = svRepF; if (!f) return;
  const list = svReps(f);
  $('svList').innerHTML = svREdit
    ? list.map(t => `<div class="sv-erow"><textarea maxlength="60">${esc(t)}</textarea><button data-rdel>✕</button></div>`).join('') + `<div class="sv-rtools"><button data-radd>＋ 추가</button><button class="ok" data-rsave>✓ 저장</button></div>`
    : `<div class="sv-rtools"><button data-radd>＋ 자주 하는 말 등록</button></div>` + list.map(t => `<button data-rep>${esc(t)}</button>`).join('') + `<div class="sv-rtools"><button data-radd>＋ 추가</button><button data-redit>✏ 수정</button></div>`;   // 70번: 맨 위에도 ＋ 등록
  if (focusLast) { const ts = $('svList').querySelectorAll('textarea'), t = ts[ts.length - 1]; if (t) { t.focus(); $('svList').scrollTop = $('svList').scrollHeight; } }
}
function svRepSave(){
  const f = svRepF; if (!f) return;
  const list = [...$('svList').querySelectorAll('textarea')].map(t => t.value.trim()).filter(Boolean);
  const all = svRepAll(); if (list.length) all[f.id] = list; else delete all[f.id];
  LS.set('rp_sv_reps', all);
}
const svGotHTML = (name, text) => `<small>${esc(name)}</small><div class="sv-gb">${esc(text)}</div>`;
function svShowMsg(m, f){
  $('svGot').innerHTML = svGotHTML(m.name || f.name, m.text);
  svRepF = f; svREdit = false; svRepDraw();
  $('svList').classList.add('wait');
  svOv('svSheet', true);
  svSpeak(`${f.name}, ${m.text}`, () => $('svList').classList.remove('wait'));
}
$('svList').addEventListener('click', e => {
  if (e.target.closest('[data-redit]')) { click(); svREdit = true; svRepDraw(); return; }
  if (e.target.closest('[data-rsave]')) { click(); svRepSave(); svREdit = false; svRepDraw(); toast('답장 문구를 저장했어요'); return; }
  if (e.target.closest('[data-radd]')) {
    click();
    if (svREdit) svRepSave();
    const f = svRepF; if (!f) return;
    const all = svRepAll(); all[f.id] = [...svReps(f), '']; LS.set('rp_sv_reps', all);
    svREdit = true; svRepDraw(true); return;
  }
  const d = e.target.closest('[data-rdel]'); if (d) { click(); d.closest('.sv-erow').remove(); return; }
  const b = e.target.closest('[data-rep]'); if (!b) return;
  click(); svHush(); svSend(b.textContent); svOv('svSheet', false); S.test = false;
});
$('svReplyBtn').onclick = () => {
  click(); S.test = false; if (!S.fam) return;
  const last = sorted().filter(m => m.type === 'text' && !isMine(m)).pop();
  $('svGot').innerHTML = last ? svGotHTML(last.name, last.text) : `<div class="sv-gq">${esc(S.fam.name)}에게 무슨 말을 보낼까요?</div>`;
  svRepF = S.fam; svREdit = false; svRepDraw();
  $('svList').classList.remove('wait'); svOv('svSheet', true);
};
/* 테스트: 실버 모드 제목을 길게 누르면 가족 메시지가 온 것처럼 (보내지 않음) */
let svTT = 0;
$('svTitle').addEventListener('pointerdown', () => { clearTimeout(svTT); svTT = setTimeout(svTest, 800); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('svTitle').addEventListener(t, () => clearTimeout(svTT)));
$('svTitle').addEventListener('contextmenu', e => e.preventDefault());
function svTest(){
  if (navigator.vibrate) navigator.vibrate(40);
  const fam = svData().fam;
  const f = S.fam || fam.find(x => x.room) || fam[0] || { id: 'test', g: 'grand', name: '민지', room: null };
  if (f.room && (S.view !== 'chat' || S.room !== f.room)) svEnter(f, true);
  S.test = true;
  svShowMsg({ id: 'test_' + rid(), name: f.name, text: `${svCall(f.g)} 밥 먹었어?` }, f);
  toast('🧪 테스트 메시지예요 (답장은 보내지 않아요)');
}

/* 소리로 읽어 주기 */
let svSpeakTok = 0;   // 26번: 읽기를 멈추면 '곧 읽을 것'도 같이 취소 (마이크와 부딪히지 않게)
function svHush(){ svSpeakTok++; if ('speechSynthesis' in window) speechSynthesis.cancel(); musicDuck(false); }
function svSpeak(t, done){
  const tok = ++svSpeakTok;
  let fin = false; const end = () => { if (fin) return; fin = true; musicDuck(false); if (done) done(); };
  if (!('speechSynthesis' in window)) { end(); return; }
  const ss = speechSynthesis; ss.cancel();
  t = String(t).replace(/[^\p{L}\p{N}\s.,!?~]/gu, ' ').replace(/\s+/g, ' ').trim();   // 그림 글자(이모지)는 읽지 않게
  const u = new SpeechSynthesisUtterance(t), v = koVoice();
  u.lang = 'ko-KR'; u.rate = .9; u.pitch = 1.0; if (v) u.voice = v;
  u.onend = end; u.onerror = end;
  musicDuck(true);
  const busy = ss.speaking || ss.pending;
  setTimeout(() => { if (tok !== svSpeakTok) return end(); ss.cancel(); ss.resume(); setTimeout(() => { if (tok === svSpeakTok) ss.speak(u); else end(); }, 150); }, busy ? 800 : 450);   // 21번: 앞 소리를 완전히 끈 뒤 읽기 ("임" 소리 막기)
  setTimeout(end, Math.min(15000, 2500 + t.length * 260));   // 읽기가 멈춰도 목록은 나오게
}

/* 🎤 음성 대화 (26번)
   · 한 번 말하기 방식(continuous 끔) → 마이크를 오래 붙잡지 않아요
   · 말이 멈추고 3.5초 동안 조용해야 보내요. 휴대폰이 중간에 먼저 끊으면 마이크를 다시 켜서 이어 들어요
   · 읽어 주기(목소리)가 완전히 끝난 뒤에 마이크를 켜요 */
const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const SV_QUIET = 3500, SV_MAX = 40000;
let svRec = null, svHeardT = 0, svMaxT = 0, svMicNow = null, svLastEnd = Promise.resolve(), svSes = null;
function svStopListen(){
  clearTimeout(svHeardT); clearTimeout(svMaxT);
  const r = svRec; svRec = null; svSes = null;
  if (r && r.stop) { r._stop = true; try { r.abort(); } catch (e) {} }
  musicDuck(false);
}
const svClose = (msg, hint, wait) => { $('svHeard').textContent = msg; $('svMicHint').textContent = hint || ''; setTimeout(() => { if (!svRec) svOv('svVoice', false); }, wait); };
const svSesText = s => (s.acc + ' ' + (s.part || '')).replace(/\s+/g, ' ').trim();
function svSesSend(){   // 3.5초 조용하면 (또는 너무 길면) 보내기
  const s = svSes; if (!s) return;
  const t = svSesText(s);
  clearTimeout(svHeardT); clearTimeout(svMaxT);
  const r = svRec; svRec = null; svSes = null;
  if (r) { r._stop = true; try { r.abort(); } catch (e) {} }
  musicDuck(false);
  if (!t) { svClose('잘 못 들었어요', '🎤 음성 대화를 다시 눌러 주세요', 2500); return; }
  svSend(t); S.test = false; svClose('✓ 보냈어요', '', 900);
}
function svQuietTimer(){ clearTimeout(svHeardT); if (svSes && svSesText(svSes)) svHeardT = setTimeout(svSesSend, SV_QUIET); }
function svListen(){
  if (!SRec) { toast('이 휴대폰에서는 말로 하기가 안 돼요 (크롬으로 열어 주세요)'); return; }
  svHush(); svStopListen(); svOv('svSheet', false);
  if (svMicNow) { try { svMicNow.abort(); } catch (e) {} }   // 앞의 마이크 완전히 끄기
  $('svHeard').textContent = '말씀하세요…';
  $('svMicHint').style.whiteSpace = 'pre-line';
  $('svMicHint').textContent = LS.get('rp_mic_ok', 0) ? '마이크 켜는 중…' : '휴대폰이 마이크를 물어보면\n[허용]을 눌러 주세요';
  svOv('svVoice', true);
  const ses = svSes = { acc: '', part: '', t0: Date.now() };
  const ttsIdle = new Promise(ok => { const t0 = Date.now(); (function w(){ if (!('speechSynthesis' in window) || (!speechSynthesis.speaking && !speechSynthesis.pending) || Date.now() - t0 > 2500) ok(); else setTimeout(w, 120); })(); });
  Promise.all([Promise.race([svLastEnd, new Promise(ok => setTimeout(ok, 2000))]), ttsIdle])   // 앞의 마이크 · 읽기가 끝날 때까지
    .then(() => setTimeout(() => { if (svSes === ses) { svMaxT = setTimeout(svSesSend, SV_MAX); svGo(0); } }, 350));
}
function svGo(n){
  const ses = svSes; if (!ses) return;
  const r = svRec = svMicNow = new SRec();
  let errCode = '', started = false, endOk;
  svLastEnd = new Promise(ok => { endOk = ok; });
  const t0 = Date.now();
  r.lang = 'ko-KR'; r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
  r.onstart = () => { started = true; LS.set('rp_mic_ok', 1); $('svMicHint').textContent = '천천히 말씀하세요\n다 말하고 잠깐 기다리면 저절로 보내져요'; };
  r.onresult = e => {
    if (svSes !== ses) return;
    ses.part = [...e.results].map(x => (x[0].transcript || '').trim()).filter(Boolean).join(' ');
    $('svHeard').textContent = svSesText(ses) || '말씀하세요…';
    svQuietTimer();   // 말할 때마다 3.5초 다시 세기
  };
  r.onerror = e => {
    errCode = e.error || '';
    if (errCode === 'not-allowed' || errCode === 'service-not-allowed') LS.set('rp_mic_ok', 0);
  };
  r.onend = () => {
    endOk();
    if (svMicNow === r) svMicNow = null;
    if (r._stop || svRec !== r || svSes !== ses) return;   // '그만'으로 끈 건 보내지 않음
    ses.acc = svSesText(ses); ses.part = '';
    if (/not-allowed/.test(errCode)) { svStopListen(); svClose('마이크가 막혀 있어요', '휴대폰 설정 → 앱 → 크롬 → 권한에서\n마이크를 허용해 주세요', 4000); return; }
    if (ses.acc) {   // 휴대폰이 먼저 끊었어도 3.5초가 안 지났으면 계속 들어요
      setTimeout(() => { if (svSes === ses && svRec === r) svGo(0); }, 200);
      return;
    }
    const quick = !started || Date.now() - t0 < 1500 || /aborted|audio-capture|network|busy/.test(errCode);
    if (quick && n < 2) { $('svHeard').textContent = '마이크 켜는 중…'; setTimeout(() => { if (svRec === r && svSes === ses) svGo(n + 1); }, 1200); return; }
    if (errCode === 'no-speech' && Date.now() - ses.t0 < 12000) { setTimeout(() => { if (svRec === r && svSes === ses) svGo(n); }, 200); return; }   // 아직 말을 안 하셨으면 조금 더 기다려요
    clearTimeout(svMaxT); svRec = null; svSes = null; musicDuck(false);
    svClose('잘 못 들었어요', '🎤 음성 대화를 다시 눌러 주세요' + (errCode && errCode !== 'no-speech' ? `\n(${errCode})` : ''), 2500);
  };
  musicDuck(true);
  try { r.start(); } catch (e) {
    endOk();
    if (n < 2) { setTimeout(() => { if (svRec === r && svSes === ses) svGo(n + 1); }, 1200); return; }
    if (ses.acc) { svSesSend(); return; }
    svStopListen(); toast('마이크를 켤 수 없어요 · 잠시 뒤 다시 눌러 주세요'); svOv('svVoice', false);
  }
}
$('svVoiceBtn').onclick = () => { click(); S.test = false; svListen(); };
$('svSheetVoice').onclick = () => { click(); svListen(); };
$('svVoiceStop').onclick = () => { click(); S.test = false; svStopListen(); svOv('svVoice', false); };

