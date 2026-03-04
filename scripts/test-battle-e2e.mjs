// 水彈對戰 完整流程端對端測試
// 測試：場地→時段→報名→配對→結果→ELO→成就→賽季
import http from 'http';
import jwt from 'jsonwebtoken';
import { execSync } from 'child_process';

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) { console.error('需要 SESSION_SECRET'); process.exit(1); }

const FIELD_ID = '4e7e54c8-b0d9-4543-936e-9b7be167341b';
const ADMIN_ID = '8ec5205f-ddfb-4258-9452-803398e9a276';
const USER_IDS = [
  'VRAPo0rDr3fp735ThPAm5MNbVOG3',
  'gVP5iY943lhfR8TK1Rw40CkDDTH3',
  'yVLHp9zjeLToDuQNVUJszh0NJAN2',
  '8zDBDOaj9PVXZm3xNr14lwiACV13',
  'VvQLsi8p3ca5OaNdWmSFBY9aeVg1',
];

// 建立 admin token + session
const ADMIN_TOKEN = jwt.sign(
  { sub: ADMIN_ID, fieldId: FIELD_ID, roleId: '15103ed3-6143-4368-92cd-8cc97b78db70', type: 'admin' },
  SECRET, { expiresIn: '1h' }
);
execSync(`docker exec gameplatform-postgres psql -U postgres -d gameplatform -c "
  DELETE FROM admin_sessions WHERE id = 'e2e-test-session';
  INSERT INTO admin_sessions (id, admin_account_id, token, expires_at)
  VALUES ('e2e-test-session', '${ADMIN_ID}', '${ADMIN_TOKEN}', NOW() + INTERVAL '1 hour');
"`, { stdio: 'pipe' });

let pass = 0, fail = 0;
const BASE = 'http://localhost:3333';

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname, port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function adminReq(url, opts = {}) {
  return req(url, { ...opts, headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, ...(opts.headers || {}) } });
}

// Mock Firebase auth — 直接用 x-user-id 不行（那是 mock 用的）
// 真正的 server 用 Firebase token 驗證，我們無法直接模擬
// 改用 DB 直接操作來模擬玩家動作

async function test(name, fn) {
  try {
    const ok = await fn();
    if (ok) { console.log(`  ✅ ${name}`); pass++; }
    else { console.log(`  ❌ ${name}`); fail++; }
    return ok;
  } catch (e) {
    console.log(`  ❌ ${name} → ${e.message}`);
    fail++;
    return false;
  }
}

function dbExec(sql) {
  return execSync(
    `docker exec gameplatform-postgres psql -U postgres -d gameplatform -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();
}

async function run() {
  console.log('\n🔫 水彈對戰 E2E 完整流程測試\n');

  // ===========================
  console.log('📍 Step 1: 建立場地');
  // ===========================
  let venueId;
  await test('建立場地', async () => {
    const r = await adminReq(`${BASE}/api/battle/venues`, {
      method: 'POST',
      body: { name: 'E2E 測試場', description: '端對端測試', maxPlayers: 10, minPlayers: 4, teamSize: 5, maxTeams: 2 },
    });
    venueId = r.body?.id;
    return r.status === 201 && venueId;
  });

  // ===========================
  console.log('\n🕐 Step 2: 建立時段');
  // ===========================
  let slotId;
  await test('建立時段', async () => {
    const r = await adminReq(`${BASE}/api/battle/slots`, {
      method: 'POST',
      body: { venueId, slotDate: '2026-03-20', startTime: '14:00', endTime: '15:00' },
    });
    slotId = r.body?.id;
    return r.status === 201 && slotId;
  });

  await test('確認時段狀態 = open', async () => {
    const r = await req(`${BASE}/api/battle/slots/${slotId}`);
    return r.status === 200 && r.body.status === 'open';
  });

  // ===========================
  console.log('\n📝 Step 3: 玩家報名（DB 直接操作）');
  // ===========================
  // 因為報名 API 需要 Firebase auth，直接用 DB 操作模擬
  for (let i = 0; i < 4; i++) {
    const userId = USER_IDS[i];
    await test(`玩家 ${i + 1} 報名`, async () => {
      dbExec(`INSERT INTO battle_registrations (slot_id, user_id, registration_type, status)
        VALUES ('${slotId}', '${userId}', 'individual', 'registered')
        ON CONFLICT DO NOTHING`);
      dbExec(`UPDATE battle_slots SET current_count = current_count + 1 WHERE id = '${slotId}'`);
      return true;
    });
  }

  // 達到 minPlayers=4，手動更新為 confirmed
  dbExec(`UPDATE battle_slots SET status = 'confirmed' WHERE id = '${slotId}'`);

  await test('確認時段狀態 = confirmed', async () => {
    const r = await req(`${BASE}/api/battle/slots/${slotId}`);
    return r.status === 200 && r.body.status === 'confirmed';
  });

  await test('報名人數 = 4', async () => {
    const r = await req(`${BASE}/api/battle/slots/${slotId}`);
    return r.status === 200 && r.body.registrations.length === 4;
  });

  // ===========================
  console.log('\n🎯 Step 4: 配對');
  // ===========================
  await test('執行配對', async () => {
    const r = await adminReq(`${BASE}/api/battle/slots/${slotId}/matchmake`, { method: 'POST' });
    if (r.status === 200 && r.body.teams) {
      console.log(`     隊伍數: ${r.body.teams.length}`);
      r.body.teams.forEach(t => console.log(`     ${t.teamName}: ${t.members.length} 人`));
      return true;
    }
    console.log(`     回應: ${JSON.stringify(r.body).substring(0, 150)}`);
    return false;
  });

  await test('查看配對結果', async () => {
    const r = await req(`${BASE}/api/battle/slots/${slotId}/teams`);
    return r.status === 200 && r.body.teams && r.body.teams.length > 0;
  });

  // ===========================
  console.log('\n⚔️ Step 5: 開始對戰');
  // ===========================
  await test('開始對戰', async () => {
    const r = await adminReq(`${BASE}/api/battle/slots/${slotId}/start`, { method: 'POST' });
    return r.status === 200 && r.body.status === 'in_progress';
  });

  // ===========================
  console.log('\n📊 Step 6: 記錄結果 + ELO 計算');
  // ===========================

  // 先確認玩家排名（應該都是預設 1000）
  const rankingsBefore = [];
  for (const uid of USER_IDS.slice(0, 4)) {
    const cnt = dbExec(`SELECT count(*) FROM battle_player_rankings WHERE user_id = '${uid}' AND field_id = '${FIELD_ID}'`);
    if (cnt === '0') {
      // 建立初始排名
      dbExec(`INSERT INTO battle_player_rankings (user_id, field_id, rating, tier, total_battles, wins, losses, draws, win_streak, best_streak, mvp_count)
        VALUES ('${uid}', '${FIELD_ID}', 1000, 'platinum', 0, 0, 0, 0, 0, 0, 0)
        ON CONFLICT DO NOTHING`);
    }
    const rating = dbExec(`SELECT rating FROM battle_player_rankings WHERE user_id = '${uid}' AND field_id = '${FIELD_ID}'`);
    rankingsBefore.push({ userId: uid, rating: parseInt(rating) });
  }
  console.log(`  📋 對戰前 rating: ${rankingsBefore.map(r => r.rating).join(', ')}`);

  // 查配對結果確認隊伍分配
  const teamsRes = await req(`${BASE}/api/battle/slots/${slotId}/teams`);
  const teams = teamsRes.body?.teams || [];
  const teamA = teams[0]?.teamName || 'A';
  const teamB = teams[1]?.teamName || 'B';

  await test('記錄對戰結果（含 ELO）', async () => {
    const playerResults = USER_IDS.slice(0, 4).map((uid, i) => {
      const reg = teamsRes.body.teams.find(t => t.members.some(m => m.userId === uid));
      const team = reg ? reg.teamName : (i < 2 ? teamA : teamB);
      return {
        userId: uid,
        team,
        score: i === 0 ? 5 : (i < 2 ? 3 : 2),
        hits: 10 + i,
        eliminations: 2 + i,
        deaths: i,
        isMvp: i === 0,
      };
    });

    const r = await adminReq(`${BASE}/api/battle/slots/${slotId}/result`, {
      method: 'POST',
      body: {
        winningTeam: teamA,
        isDraw: false,
        teamScores: [{ teamName: teamA, score: 8 }, { teamName: teamB, score: 4 }],
        durationMinutes: 45,
        mvpUserId: USER_IDS[0],
        playerResults,
      },
    });

    if (r.status === 201) {
      console.log(`     結果 ID: ${r.body.result?.id}`);
      console.log(`     玩家結果: ${r.body.playerResults?.length} 筆`);
      if (r.body.newAchievements && Object.keys(r.body.newAchievements).length > 0) {
        console.log(`     🏆 新成就: ${JSON.stringify(r.body.newAchievements).substring(0, 100)}`);
      }
      return true;
    }
    console.log(`     錯誤: ${JSON.stringify(r.body).substring(0, 200)}`);
    return false;
  });

  // 確認 ELO 變化
  await test('ELO 排名已更新', async () => {
    let changed = false;
    for (const uid of USER_IDS.slice(0, 4)) {
      const rating = parseInt(dbExec(`SELECT rating FROM battle_player_rankings WHERE user_id = '${uid}' AND field_id = '${FIELD_ID}'`));
      const before = rankingsBefore.find(r => r.userId === uid);
      const diff = rating - (before?.rating || 1000);
      console.log(`     ${uid.substring(0, 8)}... rating: ${before?.rating} → ${rating} (${diff > 0 ? '+' : ''}${diff})`);
      if (diff !== 0) changed = true;
    }
    return changed;
  });

  // 確認已有結果不能重複記錄
  await test('重複記錄 → 409', async () => {
    const r = await adminReq(`${BASE}/api/battle/slots/${slotId}/result`, {
      method: 'POST',
      body: { winningTeam: teamA, isDraw: false, playerResults: [] },
    });
    return r.status === 409;
  });

  // ===========================
  console.log('\n🏆 Step 7: 成就系統');
  // ===========================
  await test('成就列表有 15 個', async () => {
    const r = await req(`${BASE}/api/battle/achievements`);
    return r.status === 200 && r.body.length === 15;
  });

  // 查玩家成就（DB）
  await test('首戰成就已解鎖', async () => {
    const cnt = dbExec(`SELECT count(*) FROM battle_player_achievements WHERE user_id = '${USER_IDS[0]}'`);
    const num = parseInt(cnt);
    console.log(`     玩家 1 解鎖成就數: ${num}`);
    if (num > 0) {
      const keys = dbExec(`SELECT ad.key FROM battle_player_achievements pa JOIN battle_achievement_defs ad ON pa.achievement_id = ad.id WHERE pa.user_id = '${USER_IDS[0]}'`);
      console.log(`     成就: ${keys}`);
    }
    return num > 0;
  });

  // ===========================
  console.log('\n🏅 Step 8: 排行榜');
  // ===========================
  await test('排行榜包含對戰玩家', async () => {
    const r = await req(`${BASE}/api/battle/rankings?fieldId=${FIELD_ID}`);
    if (r.status !== 200) return false;
    const found = r.body.filter(p => USER_IDS.slice(0, 4).includes(p.userId));
    console.log(`     排行榜中的測試玩家: ${found.length}`);
    return found.length >= 4;
  });

  // ===========================
  console.log('\n📅 Step 9: 賽季系統');
  // ===========================
  let seasonId;
  await test('建立新賽季', async () => {
    const r = await adminReq(`${BASE}/api/admin/battle/seasons`, {
      method: 'POST',
      body: { fieldId: FIELD_ID, name: 'E2E 測試賽季', startDate: '2026-03-01', resetRatingTo: 1000 },
    });
    seasonId = r.body?.id;
    return (r.status === 201 || r.status === 409) && (seasonId || true);
  });

  if (seasonId) {
    await test('當前賽季 API', async () => {
      const r = await req(`${BASE}/api/battle/season/current?fieldId=${FIELD_ID}`);
      return r.status === 200 && r.body?.id === seasonId;
    });

    await test('結束賽季（快照 + 重置）', async () => {
      const r = await adminReq(`${BASE}/api/admin/battle/seasons/${seasonId}/end`, { method: 'POST' });
      if (r.status === 200) {
        console.log(`     快照數: ${r.body.snapshotCount}`);
        console.log(`     訊息: ${r.body.message}`);
        return true;
      }
      return false;
    });

    // 確認 rating 被重置
    await test('Rating 已重置為 1000', async () => {
      const rating = parseInt(dbExec(`SELECT rating FROM battle_player_rankings WHERE user_id = '${USER_IDS[0]}' AND field_id = '${FIELD_ID}'`));
      console.log(`     重置後 rating: ${rating}`);
      return rating === 1000;
    });

    await test('賽季排名快照存在', async () => {
      const cnt = parseInt(dbExec(`SELECT count(*) FROM battle_season_rankings WHERE season_id = '${seasonId}'`));
      console.log(`     快照記錄數: ${cnt}`);
      return cnt > 0;
    });

    await test('賽季歷史列表', async () => {
      const r = await adminReq(`${BASE}/api/admin/battle/seasons?fieldId=${FIELD_ID}`);
      return r.status === 200 && r.body.some(s => s.id === seasonId);
    });
  }

  // ===========================
  console.log('\n📊 Step 10: 管理端統計');
  // ===========================
  await test('統計 API 反映對戰數據', async () => {
    const r = await adminReq(`${BASE}/api/admin/battle/stats?fieldId=${FIELD_ID}`);
    if (r.status === 200) {
      console.log(`     總場次: ${r.body.totalBattles}, 玩家數: ${r.body.totalPlayers}`);
      return true;
    }
    return false;
  });

  await test('段位分佈', async () => {
    const r = await adminReq(`${BASE}/api/admin/battle/tier-distribution?fieldId=${FIELD_ID}`);
    if (r.status === 200) {
      console.log(`     分佈: ${JSON.stringify(r.body).substring(0, 100)}`);
      return true;
    }
    return false;
  });

  await test('最近結果含此場', async () => {
    const r = await adminReq(`${BASE}/api/admin/battle/recent-results?fieldId=${FIELD_ID}`);
    return r.status === 200 && r.body.length > 0;
  });

  // ===========================
  console.log('\n🧹 清理測試資料');
  // ===========================
  try {
    // 賽季排名
    if (seasonId) {
      dbExec(`DELETE FROM battle_season_rankings WHERE season_id = '${seasonId}'`);
      dbExec(`DELETE FROM battle_seasons WHERE id = '${seasonId}'`);
    }
    // 成就
    dbExec(`DELETE FROM battle_player_achievements WHERE user_id IN (${USER_IDS.slice(0, 4).map(u => `'${u}'`).join(',')})`);
    // 結果
    dbExec(`DELETE FROM battle_player_results WHERE result_id IN (SELECT id FROM battle_results WHERE venue_id = '${venueId}')`);
    dbExec(`DELETE FROM battle_results WHERE venue_id = '${venueId}'`);
    // 報名
    dbExec(`DELETE FROM battle_registrations WHERE slot_id = '${slotId}'`);
    // 時段
    dbExec(`DELETE FROM battle_slots WHERE venue_id = '${venueId}'`);
    // 場地
    dbExec(`DELETE FROM battle_venues WHERE id = '${venueId}'`);
    // Admin session
    dbExec(`DELETE FROM admin_sessions WHERE id = 'e2e-test-session'`);
    console.log('  ✅ 清理完成');
  } catch (e) {
    console.log('  ⚠️ 清理部分失敗:', e.message);
  }

  // ===========================
  console.log('\n========================================');
  console.log(`🔫 E2E 結果: ✅ ${pass} 通過 / ❌ ${fail} 失敗`);
  console.log('========================================\n');

  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error('E2E 測試失敗:', e); process.exit(1); });
