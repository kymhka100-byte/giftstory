/* 빨간 우체통 todo.js - ✅ 할 일 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* --- ✅ 할 일: 체크하면 줄이 그어지고, 다음에 열면 '다 한 일'로 숨어요 · ★ 중요는 맨 위 --- */
const tdAll = () => LS.get('rp_todos', {});
const tdList = () => Object.values(tdAll()).filter(x => x && x.id && !x.del);
const tdActive = () => tdList().filter(x => !x.done);
const tdSess = new Set();   // 이번에 체크한 일 (앱을 나갔다 오면 숨어요)
let tdShowDone = false, tdCur = null, tdHidAt = 0;
function tdInit(){
  if (LS.get('rp_td_init', 0)) return;
  LS.set('rp_td_init', 1);
  if (Object.keys(tdAll()).length) return;
  const all = {}, now = Date.now();
  [['이제 이 화면에서 할 일을 관리하세요', 0, 1], ['다한 할 일은 이렇게 지워집니다', 1, 0], ['할 일 내용은 걱정하지 마세요. 암호화된 Google 서버에 자동 저장됩니다', 0, 0]]
    .forEach(([t, done, star], i) => { const id = 'tds' + i; all[id] = { id, t, done, star, sample: 1, at: now + i, up: 0 }; });
  LS.set('rp_todos', all);
}
const fmtWhen = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(t)}`; };
function tdRow(x){
  const meta = [x.remind ? '⏰ ' + fmtWhen(x.remind) : '', x.place ? '📍 ' + x.place : '', x.room ? '💬 ' + roomName(x.room) : '', x.note ? '📝 메모' : ''].filter(Boolean).join(' · ');
  return `<div class="td ${x.done ? 'done' : ''} ${x.star ? 'star' : ''}" data-tid="${x.id}"><button class="tdck" data-tck>${x.done ? '✓' : ''}</button><div class="tdt" data-topen><span>${esc(x.t)}</span>${meta ? `<small>${esc(meta)}</small>` : ''}</div><button class="tdst" data-tstar>${x.star ? '★' : '☆'}</button></div>`;
}
function tdHTML(){
  const v = tdList().filter(x => !x.done || x.sample || tdSess.has(x.id) || tdShowDone)
    .sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0) || (b.at || 0) - (a.at || 0));   // 41번: 새로 넣은 할 일이 입력창 바로 밑에
  const hid = tdList().filter(x => x.done && !x.sample && !tdSess.has(x.id)).length;
  return (v.length ? v.map(tdRow).join('') : '<div class="tdempty">할 일이 없어요 · 아래에 적어 보세요</div>')
    + (hid ? `<div class="tdmore" data-tdone>${tdShowDone ? '다 한 일 숨기기' : `✓ 다 한 일 ${hid}개 보기`}</div>` : '');
}
/* 41번: 오늘 할 일(알림 시간이 오늘)이 있으면 맨 위 내 이름 버튼이 10분마다 흔들 + 띵동 · 한 번 들어가면 그날은 멈춤 */
var lastTouch = Date.now();   // 41번: 마지막으로 화면을 만진 때
function dayKey(t){ const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function todayKey(){ return dayKey(Date.now()); }
const tdToday = () => { const k = todayKey(); return tdActive().filter(x => x.remind && dayKey(x.remind) === k).length; };
function tdNudge(sound){
  const b = $('meBtn'); if (!b) return;
  const on = tdToday() > 0 && LS.get('rp_td_seen', '') !== todayKey();
  b.classList.toggle('today', on);
  if (!on || document.hidden) return;
  b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 1900);
  if (sound) dingdong();
}
setTimeout(() => tdNudge(true), 6000);
setInterval(() => tdNudge(true), 600000);
function tdDraw(){ const h = tdHTML(); setHTML('hTodoList', h); if ($('todoOv').classList.contains('show')) setHTML('tdList', h); }
function tdSave(x){
  x.up = Date.now(); const all = tdAll(); all[x.id] = x; LS.set('rp_todos', all);
  myPut('todos/' + x.id, x);
  if (homeOn) drawHome(); else tdDraw();
}
function tdAdd(inp){
  if (!needLogin()) return;   // 34번
  dictOff();   // 42번: ＋ 누르면 마이크 꺼지고 다음 말은 새로
  const t = inp.value.trim(); if (!t) { inp.focus(); toast('할 일을 적어 주세요'); return; }
  click(); inp.value = '';
  tdSave({ id: 'td' + rid(), t, done: 0, star: 0, at: Date.now() });
  toast('✅ 할 일을 넣었어요');
}
['hTdIn', 'tdIn'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tdAdd($(id)); } }));
function todoClick(e){
  if (e.target.closest('[data-tdone]')) { click(); tdShowDone = !tdShowDone; tdDraw(); return; }
  const r = e.target.closest('[data-tid]'); if (!r) return;
  const x = tdAll()[r.dataset.tid]; if (!x) return;
  if (e.target.closest('[data-tck]')) {
    x.done = x.done ? 0 : 1; x.doneAt = x.done ? Date.now() : 0;
    if (x.done) { tdSess.add(x.id); sentFx(); } else { tdSess.delete(x.id); click(); }
    tdSave(x); return;
  }
  if (e.target.closest('[data-tstar]')) { click(); x.star = x.star ? 0 : 1; tdSave(x); if (x.star) toast('★ 중요한 일 · 맨 위로 올렸어요'); return; }
  if (e.target.closest('[data-topen]')) { click(); tdOpen(x); }
}
$('hTodoList').addEventListener('click', todoClick);
$('tdList').addEventListener('click', todoClick);
/* 할 일 자세히: 알림 시간 · 장소 · 메모 · 대화방 연결 */
const toLocalInput = t => t ? new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
function tdOpen(x){
  tdCur = { ...x };
  $('tdT').value = x.t || ''; $('tdWhen').value = toLocalInput(x.remind); $('tdPlace').value = x.place || ''; $('tdNote').value = x.note || '';
  tdRoomDraw(); showOv('tdDet');
}
function tdRoomDraw(){ $('tdRoom').textContent = tdCur.room ? '💬 ' + roomName(tdCur.room) + ' (바꾸기)' : '💬 대화방 고르기'; $('tdRoomGo').style.display = tdCur.room ? '' : 'none'; }
$('tdRoom').onclick = () => { click(); pickFriend('💬 어느 대화방과 연결할까요?', id => { if (!tdCur || Array.isArray(id)) return; tdCur.room = id; tdRoomDraw(); }); };
$('tdRoomGo').onclick = () => { if (!tdCur || !tdCur.room) return; click(); const id = tdCur.room; hideOv('tdDet'); hideOv('todoOv'); openRoom(id); };
$('tdWhenX').onclick = () => { click(); $('tdWhen').value = ''; };
$('tdOk').onclick = () => {
  if (!tdCur) return;
  const t = $('tdT').value.trim(); if (!t) { toast('할 일을 적어 주세요'); return; }
  const w = $('tdWhen').value ? new Date($('tdWhen').value).getTime() || 0 : 0;
  const x = { ...tdCur, t, place: $('tdPlace').value.trim(), note: $('tdNote').value.trim(), remind: w };
  if (w !== (tdCur.remind || 0)) x.rdone = 0;
  delete x.sample;
  click(); tdSave(x); hideOv('tdDet');
  if (w > Date.now()) { toast(`⏰ ${fmtWhen(w)}에 띵동 알려 드려요`); askNoti(); } else toast('💾 저장했어요');
};
$('tdDel').onclick = () => { if (!tdCur || !confirm('이 할 일을 지울까요?')) return; click(); tdSave({ id: tdCur.id, del: 1 }); hideOv('tdDet'); toast('🗑 지웠어요'); };
/* 알림 시간이 되면 띵동 (앱이 켜져 있을 때 · 화면이 꺼져 있을 땐 폰 알림으로) */
function tdRemind(){
  const now = Date.now();
  tdList().forEach(x => {
    if (!x.remind || x.rdone || x.done || x.remind > now) return;
    x.rdone = 1; tdSave(x);
    if (now - x.remind > 6 * 3600000) return;   // 너무 지난 알림은 조용히
    showBanner('⏰ ' + x.t); dingdong(); if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opt = { body: x.t, tag: 'rp-td-' + x.id, renotify: true, vibrate: [300, 150, 300], data: { url: location.origin + location.pathname } };
    (swReg ? swReg.showNotification('⏰ 할 일 알림', opt) : Promise.reject()).catch(() => { try { new Notification('⏰ 할 일 알림', opt); } catch (e) {} });
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { tdHidAt = Date.now(); return; }
  if (tdHidAt && Date.now() - tdHidAt > 60000) { tdSess.clear(); tdShowDone = false; if (homeOn) drawHome(); else tdDraw(); }   // 다음에 열면 다 한 일은 숨어요
  tdRemind();
});
/* 나와의 대화방 위 버튼: 1 할 일 · 2 일기장 */
$('sbTodo').onclick = () => { click(); tdShowDone = false; showOv('todoOv'); tdDraw(); };
$('sbDiary').onclick = () => { if (needLogin()) diaryOpen(); };
