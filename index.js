// 빨간 우체통 알림 서버 (34번)
//  - 새 대화나 편지가 오면 앱이 닫혀 있어도 휴대폰에 알림을 보내요
//  - 34번: 보낼 때마다 기록(로그)을 남겨서 어디서 막히는지 볼 수 있어요
//  - 34번: '화면 끄고 시험' (2분 30초 뒤 알림)
//  - 34번: 카카오 로그인
const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');
initializeApp();

const SITE = 'https://giftwav.com/';
const DB = { instance: 'giftwav-9ab6b-default-rtdb', region: 'asia-southeast1' };
const KAKAO_REST = 'bccde8316aaa759eeec3370b1277ae46';

/* 한 사람(또는 여러 사람)의 휴대폰 주소(토큰)를 모아서 알림 보내기 */
async function sendTo(uids, data, why){
  const db = getDatabase(), list = [];   // [uid, key, token]
  for (const u of uids) {
    const t = (await db.ref(`giftstory/tokens/${u}`).get()).val() || {};
    for (const [k, v] of Object.entries(t)) if (v && v.token && !list.some(x => x[2] === v.token)) list.push([u, k, v.token]);   // 75번: 같은 휴대폰에 두 번 안 가게
  }
  if (!list.length) { console.log(`[알림] ${why}: 받을 휴대폰 주소가 없어요 (대상 ${uids.length}명)`); return; }
  const res = await getMessaging().sendEachForMulticast({
    tokens: list.map(x => x[2]),
    data,
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    android: { priority: 'high' }
  });
  console.log(`[알림] ${why}: 대상 ${uids.length}명 · 주소 ${list.length}개 · 성공 ${res.successCount} · 실패 ${res.failureCount}`);
  await Promise.all(res.responses.map((r, i) => {
    const code = (r.error && r.error.code) || '';
    if (!r.success) console.log(`[알림] 실패 ${list[i][0]}: ${code}`);
    if (!r.success && /not-registered|invalid-registration|invalid-argument/.test(code)) {
      return db.ref(`giftstory/tokens/${list[i][0]}/${list[i][1]}`).remove();   // 더 이상 안 쓰는 주소는 지우기
    }
    return null;
  }));
}

exports.redpostNotify = onValueCreated(
  { ref: '/giftstory/rooms/{room}/msgs/{id}', ...DB },
  async (event) => {
    const m = event.data.val();
    const room = event.params.room;
    if (!m) return;
    const L = m.letter || null;
    if (L && L.deliverAt && L.deliverAt > Date.now()) return;   // 내일 아침 편지는 지금 알리지 않음
    const members = (await getDatabase().ref(`giftstory/rooms/${room}/members`).get()).val() || {};
    let targets = Object.keys(members).filter(u => u !== m.from);
    if (L && L.toUid) targets = targets.filter(u => u === L.toUid);   // 편지는 받는 사람에게만
    if (!targets.length) return;
    const body = L ? '💌 편지가 도착했어요' : m.type === 'voice' ? '🎤 목소리 메시지' : m.type === 'file' ? '📁 파일이 왔어요' : String(m.text || '새 메시지').slice(0, 100);
    await sendTo(targets, { title: String(m.name || '빨간 우체통'), body, room, at: String(m.at || Date.now()), url: `${SITE}?room=${room}` }, '방 ' + room);
  }
);

/* 34번: 화면 끄고 시험 - 앱에서 누르면 2분 30초 기다렸다가 알림 */
exports.pingTest = onValueWritten(
  { ref: '/giftstory/users/{uid}/my/ping', ...DB, timeoutSeconds: 300 },
  async (event) => {
    const v = event.data.after.val();
    if (!v || !v.u) return;
    await new Promise(r => setTimeout(r, 150000));
    await sendTo([v.u], { title: '빨간 우체통', body: '🔔 시험 알림이에요 · 화면이 꺼져 있어도 잘 와요!', room: '', at: String(Date.now()), url: SITE }, '시험');
  }
);

/* 34번: 카카오 로그인 - 카카오가 준 번호(code)로 카카오 회원을 확인하고, 파이어베이스 로그인 열쇠를 만들어 줘요 */
exports.kakaoLogin = onRequest({ region: 'asia-southeast1', cors: true }, async (req, res) => {
  try {
    const { code, redirect } = req.body || {};
    if (!code) { res.status(400).json({ error: '카카오 번호가 없어요' }); return; }
    const tr = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: KAKAO_REST, redirect_uri: redirect || SITE, code })
    });
    const t = await tr.json();
    if (!t.access_token) { console.log('[카카오] 토큰 실패', JSON.stringify(t)); res.status(401).json({ error: '카카오 확인 실패 ' + (t.error_code || t.error || '') }); return; }
    const ur = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: 'Bearer ' + t.access_token } });
    const u = await ur.json();
    if (!u.id) { res.status(401).json({ error: '카카오 회원 정보 없음' }); return; }
    const name = (u.kakao_account && u.kakao_account.profile && u.kakao_account.profile.nickname) || (u.properties && u.properties.nickname) || '';
    const token = await getAuth().createCustomToken('kakao:' + u.id, { provider: 'kakao' });
    console.log('[카카오] 로그인', u.id);
    res.json({ token, name });
  } catch (e) {
    console.error('[카카오] 오류', e);
    res.status(500).json({ error: String((e && e.message) || e).slice(0, 120) });
  }
});
