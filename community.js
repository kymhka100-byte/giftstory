/* 빨간 우체통 community.js - 👥 우리 공동체 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* ===== 37번: 👥 우리 공동체 =====
   · 공동체 = 전체 대화방 하나 (방 번호가 grp로 시작) · 사람 목록은 그 방의 members
   · 초대 링크로 들어오면 공동체 사람들 이름이 저절로 생기고, 누르면 그 사람과 1:1 대화
   · 방장: 공지(회식 장소 등) · 모두에게 따로 보내기 · 사람 빼기 */
const isGroup = id => typeof id === 'string' && id.startsWith('grp');
const grpList = () => LS.get('rp_groups', []);
const grpMeta = {};   // 공동체 → { name, owner, notice, out }
let grpSel = null;
const pairInfo = {};   // 1:1 방 → { gid, uid, name, sent }
const grpName = id => (grpMeta[id] && grpMeta[id].name) || (grpList().find(g => g.id === id) || {}).name || '우리 공동체';
const pairId = u => 'gp' + [realMe.uid, u].sort().join('');
const grpIsOwner = id => { const o = (grpMeta[id] || {}).owner; return !!o && realMe.ids.includes(o); };
function grpPeople(id){
  const out = (grpMeta[id] || {}).out || {}, by = {};
  Object.entries(roomMembers[id] || {}).forEach(([u, v]) => {
    if (!v || !v.name || me.ids.includes(u) || v.name === me.name || out[u]) return;
    if (!by[v.name] || (v.at || 0) > (by[v.name].at || 0)) by[v.name] = { uid: u, name: v.name, at: v.at || 0, ph: v.ph || '' };
  });
  return Object.values(by).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
function grpSaveList(l){ LS.set('rp_groups', l); }
function grpAdd(id, name){
  const l = grpList(); const g = l.find(x => x.id === id);
  if (g) { if (name && g.name !== name) { g.name = name; grpSaveList(l); } } else { l.push({ id, name: name || '우리 공동체', at: Date.now() }); grpSaveList(l); }
  grpWatch(id);
}
function grpJoin(id, name){
  grpAdd(id, name);
  if (FB) { needKey(id); joinRoom(id); }
}
/* 공동체 정보 듣기 (이름 · 방장 · 공지 · 뺀 사람) + 나에게 온 1:1 대화 알림 */
const gwatch = {};
function grpWatch(id){
  if (!FB || gwatch[id]) return;
  needKey(id);
  const un = gwatch[id] = [];
  un.push(FB.D.onValue(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/group'), s => {
    const v = s.val() || {}; grpMeta[id] = v;
    if (v.name) grpAdd(id, v.name);
    if (v.out && realMe.ids.some(u => v.out[u])) { grpDrop(id); toast(`'${v.name || '공동체'}' 공동체에서 빠졌어요`); return; }
    grpSilver(id); queueRender();
  }));
  un.push(FB.D.onChildAdded(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/pings/' + realMe.uid), s => {
    const v = s.val() || {}, pid = s.key;
    if (!pid || getRooms().some(x => x.id === pid)) return;
    unRemove(pid); saveRoom(pid, v.n || ''); syncWatchers(); queueRender();
    reqAdd(pid, v.n || '', v.at || 0);   // 52번: 대화 신청 알림 창 · 말풍선 꿈틀
  }));
  un.push(FB.D.onValue(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/members'), s => {   // 51번: 사람이 들어오면 실버 화면에 바로
    const rm = roomMembers[id] || (roomMembers[id] = {});
    Object.entries(s.val() || {}).forEach(([u, v]) => { if (v) rm[u] = v; });
    grpSilver(id);
  }));
}
function grpDrop(id){
  (gwatch[id] || []).forEach(f => { try { f(); } catch (e) {} }); delete gwatch[id];
  stopWatch(id); grpSaveList(grpList().filter(g => g.id !== id));
  if (grpSel === id) grpSel = null;
  if (!homeOn && room === id) goHome(); else queueRender();
}
/* 공동체 사람과 1:1 대화방 열기 (두 사람에게 늘 같은 방 번호) */
function grpOpenPerson(gid, p){
  const pid = pairId(p.uid);
  pairInfo[pid] = { gid, uid: p.uid, name: p.name, sent: false };
  const pg = LS.get('rp_pairgid', {}); if (pg[pid] !== gid) { pg[pid] = gid; LS.set('rp_pairgid', pg); }   // 47번: 뒤로 가기 → 이 공동체 목록
  unRemove(pid); saveRoom(pid, p.name); openRoom(pid);
}
/* 처음 보낼 때: 상대도 그 방 사람으로 적어 두고(알림이 가게), 공동체에 '대화 왔어요' 표시 */
function grpPing(pid){
  const pi = pairInfo[pid]; if (!pi || pi.sent || !FB) return;
  pi.sent = true; needKey(pid);
  const mr = FB.D.ref(FB.db, 'giftstory/rooms/' + pid + '/members/' + pi.uid);
  FB.D.get(mr).then(s => { if (!s.exists()) return FB.D.set(mr, { name: pi.name, at: Date.now() }); }).catch(() => {});
  FB.D.set(FB.D.ref(FB.db, 'giftstory/rooms/' + pi.gid + '/pings/' + pi.uid + '/' + pid), { n: me.name, at: Date.now() }).catch(() => {});
}
/* 실버 모드 어르신: 공동체 사람이 가족 버튼으로 저절로 */
function grpSilver(gid){
  const d = svData(); if (!d.elder || !LS.get('rp_silver_on', 0)) return;
  let ch = false;
  grpPeople(gid).forEach(p => {
    const pid = pairId(p.uid);
    if (d.fam.some(f => f.room === pid || (f.nick === p.name && f.gid === gid))) return;
    d.fam.push({ id: rid(), g: 'kids', name: p.name, rn: '', phone: '', room: pid, nick: p.name, photo: '', gid });
    pairInfo[pid] = { gid, uid: p.uid, name: p.name, sent: false };
    saveRoom(pid, p.name); ch = true;
  });
  if (ch) { svSave(d); if (S.on && S.view === 'home') svHome(true); }
}
/* 위쪽 공동체 탭 줄 */
function grpDrawBar(){   // 40번: 공동체 줄 대신 맨 위 ＋공동체 버튼
  const b = $('grpBtn'), n = grpList().reduce((t, g) => t + unreadN(g.id), 0);
  const gl = grpList(), live = gl.some(g => grpPeople(g.id).length);   // 42번: 공동체 개수 · 사람이 들어오면 밝은 노랑
  b.classList.toggle('on', !!grpSel); b.classList.toggle('has', !!gl.length); b.classList.toggle('live', live);
  b.innerHTML = (gl.length ? '공동' + gl.length : '＋공동') + (n ? `<i class="cnt">${n > 99 ? '99+' : n}</i>` : '');
  document.body.classList.toggle('grpon', !!grpSel);
}
function grpDrawPanel(){
  if (!grpSel) return;
  const id = grpSel, own = grpIsOwner(id), meta = grpMeta[id] || {}, ppl = grpPeople(id), n = unreadN(id), L = lastMsg[id];
  const ini = t => esc([...String(t).replace(/\s+/g, '')].slice(0, 2).join(''));
  setHTML('hGroup', `<div class="ghead">👥 ${esc(grpName(id))} <small>${ppl.length + 1}명${own ? ' · 내가 방장' : ''}</small></div>`
    + (gnHas(meta.notice) ? `<div class="gnote" data-gview>📢 ${esc(gnLine(meta.notice))}</div>` : '')
    + (gtOf(id) ? `<div class="gtopic" data-gtopic>💬 오늘의 주제: ${esc(gtOf(id))}</div>` : '')
    + `<div class="hrow gall" data-gall><div class="hav">전체</div><div class="htx"><b>💬 ${esc(grpName(id))} 다 같이 대화하기</b><small>${esc(L ? L.t : '눌러서 공동체 사람 모두와 대화해요')}</small></div><div class="hside">${n ? `<i>${n > 99 ? '99+' : n}</i>` : ''}</div></div>`
    + (ppl.length ? ppl.map(p => { const pid = pairId(p.uid), m = unreadN(pid), pl = lastMsg[pid];
        return `<div class="hrow" data-gmem="${p.uid}"><div class="hav">${ini(p.name)}</div><div class="htx"><b>${esc(p.name)}</b><small>${esc(pl ? pl.t : '눌러서 바로 대화')}</small></div>${telBtn(p.ph || phoneOf(pid))}<div class="hside">${m ? `<i>${m > 99 ? '99+' : m}</i>` : ''}</div></div>`; }).join('')
      : '<div class="tdempty">아직 아무도 안 들어왔어요 · 아래 초대하기로 링크를 보내 주세요</div>')
    + `<div class="gtools"><button class="y" data-ginv>＋ 사람 초대하기</button><button data-gpick>📮 우체통 친구 초대</button>`
    + (own ? `<button data-gnote>📢 공지 쓰기</button><button data-gtopic>💬 오늘의 주제</button><button data-gsend>📨 모두에게 따로 보내기</button>` : `<button data-gleave>공동체 나가기</button>`)
    + `<button data-gsave>💾 저장하고 나가기</button></div>` + (own && ppl.length ? '<div class="tdempty" style="font-size:12px">사람을 길게 누르면 공동체에서 뺄 수 있어요</div>' : ''));
}
/* 대화방 위 공지 (공동체 전체방) */
/* 60번: 공동체 '오늘의 주제' - 공지와 따로, 방 맨 위에 늘 보여요 (방장이 정해요) */
const gtOf = id => (((grpMeta[id] || {}).notice || {}).topic || '');
function gtAsk(id){
  if (!grpIsOwner(id)) return;
  const v = prompt('💬 오늘의 주제 (예: 마케팅 전략)\n비우고 확인하면 주제를 내려요', gtOf(id));
  if (v === null || !FB) return;
  const t = v.trim().slice(0, 60);
  FB.D.update(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/group/notice'), { topic: t || null, tat: Date.now() })
    .then(() => toast(t ? '💬 오늘의 주제를 정했어요' : '주제를 내렸어요')).catch(() => toast('주제를 못 저장했어요 · 인터넷을 확인해 주세요'));
}
function grpRoomNote(){
  { const t = !homeOn && isGroup(room) ? gtOf(room) : ''; document.body.classList.toggle('gtopicon', !!t); const s0 = '💬 오늘의 주제: ' + t; if (t && $('gTopic').textContent !== s0) $('gTopic').textContent = s0; }   // 60번
  const on = !homeOn && isGroup(room) && grpMeta[room] && gnHas(grpMeta[room].notice);
  document.body.classList.toggle('gnoteon', !!on);   // 46번: .gnote(공지 칸) 모양이 화면 전체에 씌워져 아래 입력 줄이 잘리던 것 고침
  if (on) { const t = '📢 ' + gnLine(grpMeta[room].notice); if ($('gNote').textContent !== t) $('gNote').textContent = t; }
}
/* 47번: 공지는 위에 2줄만 (길어도 그대로) · 누르면 전체 보기 / 방장은 고치기 */
const gnHas = n => !!n && !!(n.text || n.img);
const gnLine = n => (n.text || '').replace(/\s*\n\s*/g, ' · ') + (n.img ? ' 🗺' : '');
let gnImg = '';
function gnOpen(id){
  if (!id) return;
  const n = (grpMeta[id] || {}).notice || {};
  click(); gnId = id;
  if (grpIsOwner(id)) {
    $('gnTxt').value = n.text || ''; gnImg = n.img || ''; gnPicDraw();
    $('gnDel').style.display = gnHas(n) ? '' : 'none';
    showOv('gnOv'); return;
  }
  if (!gnHas(n)) return;
  const tel = t => t.replace(/(0\d{1,2}[- .]?\d{3,4}[- .]?\d{4})/g, m => `<a href="tel:${m.replace(/\D/g, '')}">📞 ${m}</a>`);
  $('gnView').innerHTML = tel(esc(n.text || '')) + (n.img ? `<img src="${n.img}" alt="약도">` : '');
  showOv('gnViewOv');
}
$('gNote').onclick = () => { if (!homeOn && isGroup(room)) gnOpen(room); };
$('gTopic').onclick = () => { if (!homeOn && isGroup(room) && grpIsOwner(room)) { click(); gtAsk(room); } };   // 60번: 방장은 눌러서 주제 바꾸기
function gnPicDraw(){ $('gnPic').innerHTML = gnImg ? `<img src="${gnImg}" alt="">` : ''; $('gnPicDel').style.display = gnImg ? '' : 'none'; }
$('gnPicBtn').onclick = () => { click(); $('gnPicFile').click(); };
$('gnPicDel').onclick = () => { click(); gnImg = ''; gnPicDraw(); };
$('gnPicFile').onchange = () => {   // 약도 사진: 작게 줄여서 공지에 같이 저장
  const f = $('gnPicFile').files[0]; $('gnPicFile').value = ''; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const k = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    gnImg = c.toDataURL('image/jpeg', .7); URL.revokeObjectURL(url); gnPicDraw();
  };
  img.onerror = () => toast('사진을 열 수 없어요');
  img.src = url;
};
$('grpMake').onclick = () => {
  const n = $('grpName').value.trim(); if (!n) { toast('공동체 이름을 적어 주세요'); $('grpName').focus(); return; }
  if (!FB) { toast('서버 연결이 안 됐어요'); return; }
  click();
  const id = 'grp' + rid();
  needKey(id);
  FB.D.set(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/group'), { name: n, owner: realMe.uid, at: Date.now() })
    .then(() => { grpJoin(id, n); grpSel = id; hideOv('grpNewOv'); drawHome(); grpInvite(id); toast(`👥 '${n}' 공동체를 만들었어요 · 초대 링크를 보내 주세요`); })
    .catch(() => toast('공동체를 못 만들었어요 · 데이터베이스 규칙을 확인해 주세요'));
};
$('grpName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('grpMake').click(); } });
let grpInvId = null;
function grpInvite(id){
  grpInvId = id; $('grpInvTitle').textContent = `👥 '${grpName(id)}'에 초대하기`;
  document.querySelectorAll('#grpInvOv .shico').forEach(b => { b.innerHTML = (b.dataset.ginvk === 'kakao' ? ICON_KAKAO + '카카오톡' : ICON_SMS + '문자'); });
  showOv('grpInvOv');
}
document.querySelectorAll('[data-ginvk]').forEach(b => b.onclick = () => {
  if (!grpInvId) return; click();
  const url = location.origin + location.pathname + '?room=' + grpInvId;   // 51번: 짧은 주소 (공동체 이름은 서버에서)
  shareTo(b.dataset.ginvk, url, `👥 ${me.name}님이 '${grpName(grpInvId)}' 공동체에 초대했어요. 누르면 공동체 사람들 이름이 저절로 생겨요.`, { f: me.name, t: grpName(grpInvId) });
});
$('hGroup').addEventListener('click', e => {
  const id = grpSel; if (!id) return;
  if (glpDone) { glpDone = false; return; }
  if (e.target.closest('[data-gall]')) { click(); openRoom(id); return; }
  if (e.target.closest('[data-ginv]')) { click(); grpInvite(id); return; }
  if (e.target.closest('[data-gview]')) { gnOpen(id); return; }   // 47번: 위 공지 누르기
  if (e.target.closest('[data-gtopic]')) { if (!grpIsOwner(id)) return; click(); gtAsk(id); return; }   // 60번: 오늘의 주제
  if (e.target.closest('[data-gnote]')) { if (!grpIsOwner(id)) return; gnOpen(id); setTimeout(() => $('gnTxt').focus(), 300); return; }   // 41번: 공지 쓰기 창
  if (e.target.closest('[data-gsave]')) { click(); grpSel = null; drawHome(); syncLayer(); toast('💾 저장했어요'); return; }   // 41번: 저장하고 나가기
  if (e.target.closest('[data-gpick]')) {   // 41번: 빨간 우체통 친구 골라 초대
    click();
    pickFriend(`👥 '${grpName(id)}'에 누구를 초대할까요?`, r => grpInvSend(id, Array.isArray(r) ? r : [r]), { all: true }); return;
  }
  if (e.target.closest('[data-gsend]')) {
    const ppl = grpPeople(id); if (!ppl.length) { toast('아직 공동체에 들어온 사람이 없어요'); return; }
    click();
    const t = prompt(`공동체 사람 ${ppl.length}명에게 각자 따로 보낼 말`, ''); if (!t || !t.trim()) return;
    ppl.forEach(p => { const pid = pairId(p.uid); pairInfo[pid] = { gid: id, uid: p.uid, name: p.name, sent: false }; grpPing(pid); saveRoom(pid, p.name); pushTo(pid, { from: realMe.uid, name: me.name, type: 'text', text: nameFill(t.trim(), aliasOf(pid) || p.name), at: Date.now() }); });   // 52번: {이름} → 사람마다
    sentFx(); toast(`📨 ${ppl.length}명에게 따로 보냈어요`); return;
  }
  if (e.target.closest('[data-gleave]')) {
    if (!confirm(`'${grpName(id)}' 공동체에서 나갈까요?`)) return;
    click(); FB.D.remove(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/members/' + realMe.uid)).catch(() => {});
    grpDrop(id); toast('공동체에서 나왔어요'); return;
  }
  const r = e.target.closest('[data-gmem]'); if (!r) return;
  const p = grpPeople(id).find(x => x.uid === r.dataset.gmem); if (!p) return;
  click(); grpOpenPerson(id, p);
});
/* 41번: 공지 저장 (서버에 저장 → 공동체 사람 모두 같은 공지) */
let gnId = null;
function gnPut(v, img){   // 47번: 아래 대화 쪽에는 공지 말풍선을 안 보내요 (공지는 위에만)
  const id = gnId; if (!id || !FB) return;
  const on = !!(v || img), n = { text: v || '', by: me.name, at: Date.now() }; if (img) n.img = img;
  const tp = gtOf(id); if (tp) n.topic = tp;   // 60번: 공지를 고쳐도 오늘의 주제는 그대로
  FB.D.set(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/group/notice'), on || tp ? n : null)
    .then(() => { hideOv('gnOv'); toast(on ? '📢 공지를 저장했어요' : '공지를 내렸어요'); })
    .catch(() => toast('공지를 못 저장했어요 · 인터넷을 확인해 주세요'));
}
$('gnSave').onclick = () => { const v = $('gnTxt').value.trim().slice(0, 2000); if (!v && !gnImg) { toast('공지를 적어 주세요'); $('gnTxt').focus(); return; } click(); gnPut(v, gnImg); };
$('gnDel').onclick = () => { if (!confirm('공지를 내릴까요?')) return; click(); gnPut('', ''); };
/* 41번: 빨간 우체통 친구에게 공동체 초대장 보내기 (누르면 바로 공동체에 들어와요) */
function grpInvSend(gid, ids){
  ids = ids.filter(x => !isGroup(x) && !isSelf(x)); if (!ids.length) return;
  const gn = grpName(gid);
  ids.forEach(rid0 => pushTo(rid0, { from: realMe.uid, name: me.name, type: 'ginv', gid, gn, text: `👥 '${gn}' 공동체에 초대했어요`, at: Date.now() }));
  sentFx(); toast(`👥 ${ids.length}명에게 초대장을 보냈어요`);
}
/* 방장: 사람을 길게 누르면 빼기 */
let glpT = 0, glpDone = false, glpY = 0;
$('hGroup').addEventListener('pointerdown', e => {
  const r = e.target.closest('[data-gmem]'); if (!r || !grpIsOwner(grpSel)) return;
  glpDone = false; glpY = e.clientY; clearTimeout(glpT);
  glpT = setTimeout(() => {
    glpDone = true; if (navigator.vibrate) navigator.vibrate(30);
    const id = grpSel, p = grpPeople(id).find(x => x.uid === r.dataset.gmem); if (!p) return;
    if (!confirm(`'${p.name}'님을 공동체에서 뺄까요?`)) return;
    FB.D.set(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/group/out/' + p.uid), true).catch(() => toast('빼지 못했어요'));
    FB.D.remove(FB.D.ref(FB.db, 'giftstory/rooms/' + id + '/members/' + p.uid)).catch(() => {});
    if (roomMembers[id]) delete roomMembers[id][p.uid];
    toast(`${p.name}님을 공동체에서 뺐어요`); queueRender();
  }, 700);
});
$('hGroup').addEventListener('pointermove', e => { if (Math.abs(e.clientY - glpY) > 10) clearTimeout(glpT); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('hGroup').addEventListener(t, () => clearTimeout(glpT)));
$('hGroup').addEventListener('contextmenu', e => e.preventDefault());
/* 앱을 열면 내 공동체들 듣기 시작 */
(function grpBoot(){ const go = () => { if (FB && authUid) grpList().forEach(g => grpWatch(g.id)); else setTimeout(go, 1500); }; setTimeout(go, 1500); })();
