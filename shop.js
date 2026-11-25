/* 빨간 우체통 shop.js - 편지지 가게 · 나만의 편지지 (67번에서 index에서 떼어 냄 · index.html 다음에 읽어요) */
/* ----- 편지지 가게 ----- */
const thumbHTML = p => `<div class="pthumb ${pcls(p)}" style="${paperVars(p)}"></div>`;
function openShop(){
  const got = gotIds();
  $('shelf').innerHTML = SHOP.map(p => `<div class="item" data-shop="${p.id}">${thumbHTML(p)}<div class="nm">${esc(p.name)}</div><div class="mk">만든 사람 · ${esc(p.maker)}</div><div class="pr ${got.includes(p.id) ? 'got' : ''}">${got.includes(p.id) ? '받음 ✓' : p.price ? p.price + '원' : '무료'}</div></div>`).join('');
  const mine = myPapers();
  $('myShelf').innerHTML = mine.length ? mine.map(p => `<div class="drow"><div class="mythumb">${thumbHTML(p)}</div><div class="dt">${esc(p.name)}</div><button data-mydel="${p.id}">지우기</button></div>`).join('')
    : '<div class="empty" style="padding:10px 0">아직 없어요 · 편지지 고르기 맨 앞 ＋ 나만의 편지지 만들기</div>';
  showOv('shopOv');
}
let peekId = null;
$('shelf').addEventListener('click', e => {
  const it = e.target.closest('[data-shop]'); if (!it) return;
  click(); peekId = it.dataset.shop;
  const p = paperOf(peekId), f = fontOf('pen');
  $('peekPaper').innerHTML = `<div class="paperbox ${pcls(p)}" style="${paperVars(p)};font-family:${f.css}"><div class="ptop">To. 소중한 사람</div><div class="lined" style="font-size:${f.size}px;min-height:30vh">${esc('이 편지지에 못다한 그 말을\n적어 보세요.')}</div><div class="pfrom">From. ${esc(p.maker)}</div></div>`;
  const got = gotIds().includes(peekId);
  $('peekInfo').textContent = `${p.name} · 만든 사람 ${p.maker} · ${p.price ? p.price + '원' : '무료'}`;
  $('peekGet').textContent = got ? '이미 받았어요 ✓' : '받기 (무료)';
  showOv('peekOv');
});
$('peekGet').onclick = () => {
  if (!peekId) return;
  const g = gotIds(); if (!g.includes(peekId)) { g.push(peekId); LS.set('rp_got', g); }
  click(); hideOv('peekOv'); openShop();
  if (W) { W.paper = peekId; buildPick(); applyW(); }
  toast('🎁 편지지를 받았어요 · 편지지 고르기에 생겼어요');
};
$('myShelf').addEventListener('click', e => {
  const b = e.target.closest('[data-mydel]'); if (!b) return;
  LS.set('rp_mypapers', myPapers().filter(p => p.id !== b.dataset.mydel));
  if (W && W.paper === b.dataset.mydel) W.paper = 'pink';
  openShop(); if (W) { buildPick(); applyW(); }
});
$('shopSell').onclick = () => toast('💰 편지지 팔기는 곧 열려요!');

/* ----- 나만의 편지지 만들기 (내 사진으로) ----- */
const MK_LINES = [['분홍', 'rgba(236,140,165,.6)'], ['하늘', 'rgba(110,165,225,.6)'], ['갈색', 'rgba(150,110,60,.55)'], ['회색', 'rgba(120,120,120,.5)'], ['없음', 'transparent']];
let MK = null;
function openMaker(){
  MK = { photo: null, fade: .55, line: MK_LINES[0][1], env: '#f2e6e0' };
  $('mkName').value = ''; $('mkFade').value = .55;
  $('mkLines').innerHTML = MK_LINES.map(([n, c], i) => `<button class="chip ${i ? '' : 'sel'}" data-line="${c}">${n}</button>`).join('');
  drawMaker(); showOv('makeOv');
}
function mkPaper(){ return { id: 'my_preview', name: $('mkName').value.trim() || '나만의 편지지', cls: 'photo', bg: '#ffffff', ink: '#333333', line: MK.line, env: MK.env, photo: MK.photo, fade: MK.fade, maker: me.name }; }
function drawMaker(){
  if (!MK.photo) { $('mkPreview').innerHTML = '<div class="empty" style="padding:16px 0">사진을 고르면 여기에 편지지가 보여요</div>'; return; }
  const p = mkPaper(), f = fontOf('pen');
  $('mkPreview').innerHTML = `<div class="paperbox photo" style="${paperVars(p)};font-family:${f.css}"><div class="ptop">To. 소중한 사람</div><div class="lined" style="font-size:${f.size}px;min-height:170px">${esc('이렇게 보여요\n못다한 그 말')}</div></div>`;
}
$('mkPick').onclick = () => $('mkFile').click();
$('mkFile').onchange = () => {
  const f = $('mkFile').files[0]; $('mkFile').value = ''; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const k = Math.min(1, 720 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    MK.photo = cv.toDataURL('image/jpeg', .72);
    const d = g.getImageData(0, 0, w, h).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 400) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    const mix = c => Math.round((c / n) * .5 + 255 * .5);
    MK.env = `rgb(${mix(r)},${mix(gg)},${mix(b)})`;
    URL.revokeObjectURL(url); drawMaker();
  };
  img.onerror = () => toast('이 사진은 열 수 없어요');
  img.src = url;
};
$('mkFade').oninput = () => { MK.fade = +$('mkFade').value; drawMaker(); };
$('mkLines').addEventListener('click', e => {
  const c = e.target.closest('[data-line]'); if (!c) return;
  MK.line = c.dataset.line; [...$('mkLines').children].forEach(x => x.classList.toggle('sel', x === c)); click(); drawMaker();
});
$('mkName').oninput = () => MK.photo && drawMaker();
$('mkSave').onclick = () => {
  if (!MK.photo) { toast('먼저 사진을 골라 주세요'); return; }
  const p = { ...mkPaper(), id: 'my_' + rid() };
  LS.set('rp_mypapers', [...myPapers(), p]);
  click(); hideOv('makeOv');
  if (W) { W.paper = p.id; buildPick(); applyW(); }
  toast('✨ 나만의 편지지를 만들었어요');
};

