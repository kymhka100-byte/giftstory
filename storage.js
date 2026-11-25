/* 빨간 우체통 storage.js - 📁 내 보관함(사진·문서) · 앨범 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* 65번: 📁 내 보관함 - 🖼 사진 · 📄 문서 따로 · 서버에 계속 남아요(친구에게 보낸 파일처럼 지워지지 않아요) · 사람마다 30MB · 사진은 줄여서 올려요 · 사진은 공개/비공개 */
const ST_MAX = 30 * 1048576;
let stTab = 'image', stList = {};
const stBase = () => 'giftstory/store/' + authUid;
const IC_DN = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v10.5M8.5 11.5l3.5 3.5 3.5-3.5M6.5 19.5h11"/></svg>`;
const IC_UP = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4.5M8.5 8l3.5-3.5L15.5 8M6.5 12.5v7h11v-7"/></svg>`;
async function stLoad(){
  if (!FB || !authUid) return stList = {};
  try { stList = (await FB.D.get(FB.D.ref(FB.db, stBase()))).val() || {}; } catch (e) { stList = {}; toast('보관함을 못 불러왔어요 (인터넷·서버 규칙 확인)'); }
  return stList;
}
const stUsed = () => Object.values(stList).reduce((a, x) => a + (x && x.size || 0), 0);
const stMax = () => isDev ? 10240 * 1048576 : ST_MAX;
function boxDraw(){
  $('stTabImg').classList.toggle('on', stTab === 'image'); $('stTabDoc').classList.toggle('on', stTab !== 'image');
  $('boxFile').accept = stTab === 'image' ? 'image/*' : '';
  $('boxUp').textContent = stTab === 'image' ? '⬆ 사진 올리기' : '⬆ 문서 올리기 (한글·엑셀·PDF 등)';
  const u = stUsed(), mx = stMax();
  $('stUse').innerHTML = `사용 ${fmtSize(u)} / ${Math.round(mx / 1048576)}MB <small>(사진·문서 합쳐서)</small><i><b style="width:${Math.min(100, u / mx * 100).toFixed(1)}%"></b></i>`;
  const L = Object.entries(stList).filter(([, x]) => x && (stTab === 'image' ? x.kind === 'image' : x.kind !== 'image')).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  $('boxList').innerHTML = L.length ? L.map(([id, x]) => {
    const d = new Date(x.at || 0), ds = `${d.getMonth() + 1}/${d.getDate()}`;
    const pic = x.kind === 'image' ? `<img class="bth" src="${esc(x.thumb || '')}" alt="" data-stopen="${id}">` : `<span class="bic" data-stopen="${id}">📄</span>`;
    const pub = x.kind === 'image' ? `<button class="stb ${x.pub ? 'pub' : ''}" data-stpub="${id}" title="공개/비공개">${x.pub ? '🔓 공개' : '🔒'}</button>` : '';
    return `<div class="boxrow">${pic}<span class="bn" data-stopen="${id}">${esc(x.fname || '파일')}<small>${ds} · ${fmtSize(x.size || 0)}</small></span>${pub}<button class="fsv" data-stsave="${id}" title="내 폰에 저장">${IC_DN}</button><button class="fsv" data-stshare="${id}" title="공유">${IC_UP}</button><button class="stb" data-stdel="${id}" title="지우기">🗑</button></div>`;
  }).join('') : `<div class="empty">아직 올린 ${stTab === 'image' ? '사진' : '문서'}이 없어요</div>`;
}
async function stOpen(kind){
  if (!needLogin()) return;
  stTab = kind || 'image'; boxDraw(); showOv('storeOv');
  $('boxList').innerHTML = '<div class="empty">불러오는 중…</div>';
  await stLoad(); boxDraw();
}
async function stUpload(files){
  if (!FB || !authUid) { toast('로그인한 뒤에 쓸 수 있어요'); return; }
  await stLoad(); let used = stUsed(), n = 0;
  for (const f of files) {
    let blob = f, thumb = '', mime = f.type || 'application/octet-stream', name = f.name || '파일';
    if (stTab === 'image') {
      if (!/^image\//.test(mime)) { toast('사진만 올릴 수 있어요 · 문서는 📄 문서에'); continue; }
      const sh = /gif|svg/.test(mime) ? null : await shrinkImg(f, 1600, .82, 240);   // 사진은 줄여서
      if (sh) { thumb = sh.thumb; if (sh.blob.size < f.size) { blob = sh.blob; mime = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; } }
    }
    if (used + blob.size > stMax()) { toast(`📦 보관함이 꽉 찼어요 (${Math.round(stMax() / 1048576)}MB) · 안 쓰는 파일을 지워 주세요`); break; }
    const id = rid(), sp = stBase() + '/' + id;
    try { await stgUpload(sp, blob, mime); } catch (e) { toast('못 올렸어요 (인터넷·서버 규칙 확인)'); continue; }
    const x = { kind: stTab === 'image' ? 'image' : 'doc', fname: name.slice(0, 80), mime, size: blob.size, at: Date.now(), sp, thumb, pub: 0 };
    try { await FB.D.set(FB.D.ref(FB.db, stBase() + '/' + id), x); } catch (e) { toast('못 올렸어요 (서버 규칙 확인)'); continue; }
    stList[id] = x; used += blob.size; n++; boxDraw();
  }
  if (n) toast(`✓ 보관함에 ${n}개 올렸어요`);
}
async function stURL(sp){
  const { SM, st } = await stg(), ref = SM.ref(st, sp);
  try { const b = await Promise.race([SM.getBlob(ref), new Promise((_, no) => setTimeout(no, 8000))]); return URL.createObjectURL(b); }
  catch (e) { return SM.getDownloadURL(ref); }
}
const stoMsg = x => ({ kind: x.kind === 'image' ? 'image' : /^audio\//.test(x.mime || '') ? 'video' : /^video\//.test(x.mime || '') ? 'video' : 'doc', fname: x.fname, mime: x.mime, size: x.size });
$('sbBox').onclick = () => { click(); stOpen('image'); };
$('sbDoc').onclick = () => { click(); stOpen('doc'); };
$('stTabImg').onclick = () => { click(); stTab = 'image'; boxDraw(); };
$('stTabDoc').onclick = () => { click(); stTab = 'doc'; boxDraw(); };
$('boxUp').onclick = () => { click(); $('boxFile').click(); };
$('boxFile').onchange = () => { const f = [...$('boxFile').files]; $('boxFile').value = ''; if (f.length) stUpload(f); };
$('boxList').addEventListener('click', async e => {
  const g = k => { const b = e.target.closest('[data-' + k + ']'); return b ? b.dataset[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())] : null; };
  let id;
  if ((id = g('stpub'))) {
    const x = stList[id]; if (!x) return; click(); x.pub = x.pub ? 0 : 1;
    FB.D.update(FB.D.ref(FB.db, stBase() + '/' + id), { pub: x.pub }).catch(() => {});
    const ar = FB.D.ref(FB.db, 'giftstory/album/' + authUid + '/' + id);
    (x.pub ? FB.D.set(ar, { sp: x.sp, thumb: x.thumb || '', fname: x.fname, at: x.at }) : FB.D.remove(ar)).catch(() => toast('앨범에 못 넣었어요 (서버 규칙 확인)'));
    toast(x.pub ? '🔓 공개 · 친구가 내 앨범에서 볼 수 있어요' : '🔒 비공개 · 나만 봐요'); boxDraw(); return;
  }
  if ((id = g('stdel'))) {
    const x = stList[id]; if (!x || !confirm('🗑 보관함에서 지울까요?\n(되돌릴 수 없어요)')) return; click();
    stg().then(({ SM, st }) => SM.deleteObject(SM.ref(st, x.sp))).catch(() => {});
    FB.D.remove(FB.D.ref(FB.db, stBase() + '/' + id)).catch(() => {});
    if (x.pub) FB.D.remove(FB.D.ref(FB.db, 'giftstory/album/' + authUid + '/' + id)).catch(() => {});
    delete stList[id]; boxDraw(); toast('🗑 지웠어요'); return;
  }
  const sv = g('stsave'), sh = g('stshare'), op = g('stopen'); id = sv || sh || op;
  const x = id && stList[id]; if (!x) return;
  click(); toast('⏳ 여는 중…');
  try {
    const u = await stURL(x.sp), m = stoMsg(x);
    if (sv) fileSave(u, x.fname, m); else if (sh) fileShare(u, m); else fileOpen(m, u);
  } catch (e) { toast('파일을 못 열었어요'); }
});
/* 65번: 🖼 OO의 앨범 - 그 사람이 보관함에서 '공개'로 한 사진만 */
async function albumOpen(name){
  const mv = memOf(room, name);
  $('albTitle').textContent = '🖼 ' + iga(name) + ' 앨범'; $('albGrid').innerHTML = '<div class="empty" style="grid-column:1/-1">불러오는 중…</div>'; showOv('albOv');
  if (!FB || !mv || !mv.au) { $('albGrid').innerHTML = '<div class="empty" style="grid-column:1/-1">아직 공개한 사진이 없어요</div>'; return; }
  let L = {};
  try { L = (await FB.D.get(FB.D.ref(FB.db, 'giftstory/album/' + mv.au))).val() || {}; } catch (e) {}
  const arr = Object.values(L).filter(x => x && x.sp).sort((a, b) => (b.at || 0) - (a.at || 0));
  albumOpen.list = arr;
  $('albGrid').innerHTML = arr.length ? arr.map((x, i) => `<img src="${esc(x.thumb || '')}" alt="" data-albi="${i}">`).join('') : '<div class="empty" style="grid-column:1/-1">아직 공개한 사진이 없어요</div>';
}
$('albGrid').addEventListener('click', async e => {
  const b = e.target.closest('[data-albi]'); if (!b) return;
  const x = (albumOpen.list || [])[+b.dataset.albi]; if (!x) return;
  click(); try { fileOpen({ kind: 'image', fname: x.fname || 'photo.jpg', mime: 'image/jpeg' }, await stURL(x.sp)); } catch (e) { toast('사진을 못 열었어요'); }
});
