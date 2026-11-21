import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(function () {
  "use strict";

  const ALLOWED_HOSTS = ["gekosnake.github.io", "zinfty.com", "www.zinfty.com", "admin.zinfty.com"];
  const currentHost = (window.location.hostname || "").toLowerCase();

  function lockConsole(reason) {
    try {
      window.stop();
      document.documentElement.innerHTML =
        "<head><title>403 Unauthorized</title></head>" +
        "<body style='margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#f87171;font-family:sans-serif;text-align:center;'>" +
        "<div><h2>🔒 보안 관리자 콘솔 접근 차단</h2><p style='color:#94a3b8;font-size:14px;'>" + reason + "</p></div></body>";
    } catch (_) {}
    throw new Error("ADMIN_SECURITY_BLOCK");
  }

  if (!ALLOWED_HOSTS.includes(currentHost)) {
    lockConsole("허가되지 않은 도메인에서의 관리자 콘솔 실행이 차단되었습니다.");
  }

  document.addEventListener("contextmenu", e => e.preventDefault(), true);
  document.addEventListener("keydown", e => {
    const k = (e.key || "").toUpperCase();
    if (
      e.keyCode === 123 ||
      (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(k)) ||
      (e.metaKey && e.altKey && ["I", "J", "C", "U"].includes(k)) ||
      ((e.ctrlKey || e.metaKey) && ["U", "S", "P"].includes(k))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  setInterval(() => {
    if (window.outerWidth - window.innerWidth > 180 || window.outerHeight - window.innerHeight > 180) {
      lockConsole("개발자 도구 실행이 감지되어 관리자 세션이 즉시 잠겼습니다.");
    }
  }, 1500);

  if (window.location.search.includes("oobCode") || window.location.search.includes("mode=")) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const favImg = new Image();
  favImg.crossOrigin = "anonymous";
  favImg.onload = () => {
    const s = 64, c = document.createElement("canvas");
    c.width = s; c.height = s;
    const m = Math.min(favImg.width, favImg.height);
    c.getContext("2d").drawImage(favImg, (favImg.width - m) / 2, (favImg.height - m) / 2, m, m, 0, 0, s, s);
    const link = document.getElementById("dynamicFavicon");
    if (link) link.href = c.toDataURL("image/png");
  };
  favImg.src = "./logo.png";

  // 로그인 화면 스타일만 먼저 주입 (대시보드 CSS/HTML은 인증 성공 후 주입)
  const baseStyle = document.createElement("style");
  baseStyle.textContent = `
    :root{--bg-page:#f0f9ff;--sky-primary:#0ea5e9;--sky-dark:#0284c7;--sky-soft:#e0f2fe;--border:#bae6fd;--border-gray:#e2e8f0;--text-main:#0f172a;--text-sub:#475569;--danger:#ef4444;--danger-soft:#fee2e2}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif;background:var(--bg-page);color:var(--text-main);min-height:100vh}
    .auth-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#e0f2fe 0%,#fff 100%)}
    .auth-card{background:#fff;border:1px solid var(--border);border-radius:24px;padding:44px 36px;max-width:440px;width:100%;text-align:center;box-shadow:0 20px 40px rgba(14,165,233,.12)}
    .auth-square-logo{width:84px;height:84px;border-radius:22px;object-fit:cover;border:1.5px solid var(--border);margin:0 auto 18px;display:block}
    .auth-card h1{font-size:1.5rem;margin-bottom:8px}.auth-card p{color:var(--text-sub);font-size:.92rem;margin-bottom:24px}
    .google-btn{width:100%;padding:14px 20px;border-radius:12px;border:1.5px solid var(--border);background:#fff;color:var(--text-main);font-size:.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:.2s;margin-bottom:10px}
    .google-btn:hover{background:var(--sky-soft);border-color:var(--sky-primary)}
    .redirect-btn{width:100%;padding:10px 16px;border-radius:10px;border:1px solid var(--border-gray);background:#f8fafc;color:var(--text-sub);font-size:.82rem;font-weight:600;cursor:pointer;transition:.2s}
    .redirect-btn:hover{border-color:var(--sky-primary);color:var(--sky-dark)}
    .error-box{margin-top:16px;padding:14px;border-radius:12px;background:var(--danger-soft);color:#b91c1c;font-size:.84rem;font-weight:600;display:none;text-align:left;line-height:1.5;word-break:break-word}
  `;
  document.head.appendChild(baseStyle);

  const root = document.getElementById("adminRoot");

  function mountLoginScreen() {
    root.innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <img src="./logo.png" alt="Zinfty Logo" class="auth-square-logo" />
          <h1>Zinfty Admin</h1>
          <p>인가된 화이트리스트 구글 계정만 접근할 수 있는<br>최고 보안 관리자 콘솔입니다.</p>
          <button id="loginBtn" class="google-btn"><span>🔐</span> Google 계정으로 보안 로그인 (팝업)</button>
          <button id="loginRedirectBtn" class="redirect-btn">🔄 팝업이 안 열릴 때: 전체 화면 리디렉션으로 로그인</button>
          <div id="authError" class="error-box"></div>
        </div>
      </div>
    `;

    document.getElementById("loginBtn").addEventListener("click", async () => {
      document.getElementById("authError").style.display = "none";
      try { await signInWithPopup(auth, provider); } catch (err) { showAuthError(err); }
    });

    document.getElementById("loginRedirectBtn").addEventListener("click", async () => {
      document.getElementById("authError").style.display = "none";
      try { await signInWithRedirect(auth, provider); } catch (err) { showAuthError(err); }
    });
  }

  function showAuthError(errOrMsg) {
    const box = document.getElementById("authError");
    if (!box) return;
    const raw = typeof errOrMsg === "string" ? errOrMsg : `${errOrMsg.code || ""} ${errOrMsg.message || errOrMsg}`;
    box.innerText = `로그인 오류: ${raw}`;
    box.style.display = "block";
  }

  const firebaseConfig = {
    apiKey: "AIzaSyACPThFj93lZ__x6OjIsNQaifL9LAEleGw",
    authDomain: "zinfty.firebaseapp.com",
    projectId: "zinfty",
    storageBucket: "zinfty.firebasestorage.app",
    messagingSenderId: "858644844927",
    appId: "1:858644844927:web:43427e13c7c01a8f288a4a",
    measurementId: "G-04QXTF2YYQ"
  };

  const MASTER_EMAIL = "leemyungsu486@gmail.com";
  const app = initializeApp(firebaseConfig);
  getAnalytics(app);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  getRedirectResult(auth).catch(err => { if (err) showAuthError(err); });

  let currentUserEmail = null;
  let unsubServices = null, unsubAdmins = null, unsubVisitors = null, unsubBlockedIps = null;
  let allVisitors = [], ipGroupsList = [], blockedIpMap = new Map();
  let currentPage = 1, uploadedIconDataUrl = "";

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const ipToDocId = ip => String(ip || "").trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const toMillis = ts => !ts ? 0 : (ts.toMillis ? ts.toMillis() : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime() || 0));
  const formatTime = ts => !ts ? "-" : (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formatDuration = sec => { const s = Number(sec) || 0; return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`; };

  // 화이트리스트 인증 통과 시에만 대시보드 UI 전체를 메모리에 조립
  function mountDashboardUI(email) {
    const dashStyle = document.createElement("style");
    dashStyle.textContent = `
      header{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:40}
      .header-inner{max-width:1340px;margin:0 auto;padding:0 24px;height:70px;display:flex;justify-content:space-between;align-items:center}
      .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.15rem}
      .brand img{width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid var(--border)}
      .brand span.tag{font-size:.75rem;padding:3px 9px;border-radius:999px;background:var(--sky-soft);color:var(--sky-dark);font-family:monospace}
      .user-area{display:flex;align-items:center;gap:12px;font-size:.85rem}
      .btn{padding:9px 16px;border-radius:10px;border:1px solid transparent;font-size:.85rem;font-weight:700;cursor:pointer;transition:.18s;text-decoration:none;display:inline-flex;align-items:center;gap:5px}
      .btn-primary{background:var(--sky-primary);color:#fff}.btn-primary:hover{background:var(--sky-dark)}
      .btn-outline{background:#fff;border-color:var(--border-gray);color:var(--text-sub)}.btn-outline:hover{border-color:var(--sky-primary);color:var(--sky-dark)}
      .btn-danger{background:var(--danger-soft);color:#b91c1c}.btn-danger:hover{background:#fecaca}
      .btn-sm{padding:6px 11px;font-size:.78rem;border-radius:8px}
      .main-wrap{max-width:1340px;margin:28px auto;padding:0 24px 80px}
      .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
      .kpi-card{background:#fff;border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:0 4px 14px rgba(14,165,233,.05)}
      .kpi-label{font-size:.82rem;font-weight:700;color:var(--text-sub);margin-bottom:6px}
      .kpi-val{font-size:1.7rem;font-weight:800;color:var(--sky-dark)}
      .tabs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
      .tab-btn{padding:12px 18px;border-radius:12px;border:1px solid var(--border);background:#fff;color:var(--text-sub);font-weight:700;cursor:pointer}
      .tab-btn.active{background:var(--sky-primary);color:#fff;border-color:var(--sky-primary)}
      .panel{background:#fff;border:1px solid var(--border);border-radius:20px;padding:26px;box-shadow:0 8px 24px rgba(14,165,233,.06);margin-bottom:24px}
      .panel h2{font-size:1.12rem;margin-bottom:18px;color:var(--text-main);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
      .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:16px}
      .field label{display:block;font-size:.8rem;font-weight:700;color:var(--text-sub);margin-bottom:6px}
      .field input,.field select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border-gray);font-size:.9rem;outline:none}
      .logo-upload-box{display:flex;align-items:center;gap:16px;padding:14px;border:1.5px dashed var(--border);border-radius:14px;background:#f8fbff;margin-bottom:16px;flex-wrap:wrap}
      .logo-preview-thumb{width:64px;height:64px;aspect-ratio:1/1;border-radius:14px;border:1px solid var(--border);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
      .logo-preview-thumb img,.svc-table-thumb{width:100%;height:100%;object-fit:cover;display:block}
      .svc-table-thumb{width:42px;height:42px;border-radius:10px;border:1px solid var(--border-gray);flex-shrink:0}
      table{width:100%;border-collapse:collapse;font-size:.86rem}
      th,td{text-align:left;padding:13px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
      th{color:var(--text-sub);font-weight:700;background:#f8fafc;white-space:nowrap}
      .status-tag{padding:4px 9px;border-radius:999px;font-size:.74rem;font-weight:800;display:inline-block}
      .st-live{background:#dcfce7;color:#15803d}.st-beta{background:#e0f2fe;color:#0369a1}.st-soon{background:#f1f5f9;color:#475569}.st-blocked{background:#fee2e2;color:#b91c1c}
      .actions{display:flex;flex-wrap:wrap;gap:6px}
      .pagination-bar{display:flex;justify-content:space-between;align-items:center;margin-top:18px;flex-wrap:wrap;gap:10px;font-size:.85rem;color:var(--text-sub)}
      .modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:20px;z-index:100}
      .modal-card{background:#fff;border-radius:20px;max-width:820px;width:100%;max-height:88vh;overflow-y:auto;padding:28px;box-shadow:0 25px 50px rgba(0,0,0,.25)}
      .detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:16px}
      .detail-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px}
      .detail-item small{display:block;color:var(--text-sub);font-size:.75rem;font-weight:700;margin-bottom:3px}
      .detail-item div{font-size:.86rem;word-break:break-all;font-family:monospace}
      .timeline-list{margin-top:18px;border-left:3px solid var(--sky-primary);padding-left:18px;display:flex;flex-direction:column;gap:14px}
      .timeline-item{background:#f8fafc;border:1px solid var(--border-gray);border-radius:12px;padding:14px;position:relative}
      .timeline-item::before{content:"";width:11px;height:11px;border-radius:50%;background:var(--sky-primary);border:2px solid #fff;position:absolute;left:-25px;top:18px}
    `;
    document.head.appendChild(dashStyle);

    root.innerHTML = `
      <header>
        <div class="header-inner">
          <div class="brand"><img src="./logo.png" alt="Zinfty" /><span>Zinfty Control Center</span><span class="tag">PROTECTED</span></div>
          <div class="user-area">
            <span style="font-weight:600;color:var(--sky-dark);">${esc(email)}</span>
            <a href="./index.html" target="_blank" class="btn btn-outline btn-sm">허브 보기 ↗</a>
            <button id="logoutBtn" class="btn btn-danger btn-sm">로그아웃</button>
          </div>
        </div>
      </header>
      <div class="main-wrap">
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">전체 누적 방문 로그</div><div class="kpi-val" id="kpiTotalVisitors">0</div></div>
          <div class="kpi-card"><div class="kpi-label">고유 IP 사용자 수</div><div class="kpi-val" id="kpiUniqueIps">0</div></div>
          <div class="kpi-card"><div class="kpi-label">차단된 IP 수</div><div class="kpi-val" id="kpiBlockedIps" style="color:#ef4444;">0</div></div>
          <div class="kpi-card"><div class="kpi-label">등록된 서비스 수</div><div class="kpi-val" id="kpiTotalServices">0</div></div>
          <div class="kpi-card"><div class="kpi-label">전체 서비스 누적 클릭</div><div class="kpi-val" id="kpiTotalClicks">0</div></div>
        </div>
        <div class="tabs">
          <button class="tab-btn active" data-tab="visitorsTab">👁️ 전체 방문자 로그</button>
          <button class="tab-btn" data-tab="ipTrackerTab">👤 IP·사용자별 행적 추적</button>
          <button class="tab-btn" data-tab="blockedIpsTab">🚫 IP 차단 관리</button>
          <button class="tab-btn" data-tab="servicesTab">🌐 서브도메인 서비스 & 공지 관리</button>
          <button class="tab-btn" data-tab="whitelistTab">🛡️ 관리자 화이트리스트</button>
        </div>

        <div id="visitorsTab">
          <div class="panel">
            <h2>
              <span>전체 접속자 상세 트래킹 (<span id="filteredLogCount">0</span>건)</span>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <input type="text" id="visitorSearchInput" placeholder="IP, 국가, 도시, ISP, OS, 브라우저, 클릭서비스 검색..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--border-gray);font-size:.84rem;min-width:250px;" />
                <select id="pageSizeSelect" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border-gray);font-size:.84rem;">
                  <option value="50">50건씩 보기</option><option value="200">200건씩 보기</option><option value="all" selected>전체 한 번에 보기</option>
                </select>
                <button id="exportLogsCsvBtn" class="btn btn-outline btn-sm">📥 CSV 다운로드</button>
                <button id="clearVisitorsBtn" class="btn btn-danger btn-sm">전체 로그 초기화</button>
              </div>
            </h2>
            <div style="overflow-x:auto;"><table><thead><tr><th>접속 시각</th><th>IP 주소 & 위치/ISP</th><th>기기 / OS / 브라우저</th><th>해상도 / 하드웨어</th><th>유입 경로 & 클릭 서비스</th><th>추적 / IP 차단</th></tr></thead><tbody id="visitorsTableBody"></tbody></table></div>
            <div class="pagination-bar" id="paginationBar"></div>
          </div>
        </div>

        <div id="ipTrackerTab" style="display:none;">
          <div class="panel">
            <h2>
              <span>IP 기준 사용자별 누적 행적 추적 (<span id="ipGroupCount">0</span>명)</span>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <input type="text" id="ipSearchInput" placeholder="IP, 통신사, 도시, 기기, 방문서비스 검색..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--border-gray);font-size:.84rem;min-width:240px;" />
                <select id="ipSortSelect" style="padding:7px 10px;border-radius:8px;border:1px solid var(--border-gray);font-size:.84rem;">
                  <option value="recent">최근 접속순</option><option value="visits">방문 횟수 많은순</option><option value="duration">총 체류시간 긴순</option><option value="clicks">클릭 많은순</option>
                </select>
                <button id="exportIpCsvBtn" class="btn btn-outline btn-sm">📥 IP별 요약 CSV</button>
              </div>
            </h2>
            <div style="overflow-x:auto;"><table><thead><tr><th>IP 주소 & 위치/통신사</th><th>총 방문 / 누적 체류</th><th>최초 접속 ~ 최근 접속</th><th>사용한 기기 / OS / 브라우저</th><th>관심/클릭한 서비스 이력</th><th>정밀 추적 / 차단</th></tr></thead><tbody id="ipTrackerTableBody"></tbody></table></div>
          </div>
        </div>

        <div id="blockedIpsTab" style="display:none;">
          <div class="panel">
            <h2>🚫 신규 IP 수동 차단 등록</h2>
            <form id="blockIpForm" style="display:flex;gap:12px;flex-wrap:wrap;">
              <input type="text" id="manualBlockIp" placeholder="차단할 IP 주소 (예: 123.45.67.89)" required style="width:240px;padding:11px 14px;border-radius:10px;border:1px solid var(--border-gray);font-family:monospace;" />
              <input type="text" id="manualBlockReason" placeholder="차단 사유" style="flex:1;min-width:240px;padding:11px 14px;border-radius:10px;border:1px solid var(--border-gray);" />
              <button type="submit" class="btn btn-danger">🚫 즉시 IP 차단</button>
            </form>
          </div>
          <div class="panel">
            <h2>차단된 IP 블랙리스트 목록 (<span id="blockedIpListCount">0</span>건)</h2>
            <div style="overflow-x:auto;"><table><thead><tr><th>차단된 IP</th><th>차단 사유</th><th>차단 시각</th><th>처리 관리자</th><th>관리</th></tr></thead><tbody id="blockedIpsTableBody"></tbody></table></div>
          </div>
        </div>

        <div id="servicesTab" style="display:none;">
          <div class="panel">
            <h2>📢 허브 상단 실시간 공지 배너 설정</h2>
            <form id="noticeForm" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
              <input type="text" id="hubNoticeText" placeholder="공지 내용 입력" style="flex:1;min-width:260px;padding:10px 14px;border-radius:10px;border:1px solid var(--border-gray);" />
              <label style="display:flex;align-items:center;gap:6px;font-size:.88rem;font-weight:700;cursor:pointer;"><input type="checkbox" id="hubNoticeActive" /> 배너 노출 활성화</label>
              <button type="submit" class="btn btn-primary">공지 적용</button>
            </form>
          </div>
          <div class="panel">
            <h2><span id="formTitle">새 서브도메인 서비스 등록</span><button id="cancelEditBtn" class="btn btn-outline btn-sm" style="display:none;">수정 취소</button></h2>
            <form id="serviceForm">
              <input type="hidden" id="editServiceId" />
              <div class="logo-upload-box">
                <div class="logo-preview-thumb" id="logoPreviewThumb"><img src="./logo.png" alt="기본 로고" /></div>
                <div style="flex:1;min-width:220px;">
                  <label style="display:block;font-size:.84rem;font-weight:700;margin-bottom:6px;">🖼️ 서비스 로고 이미지 첨부 (자동 1:1 정사각형 크롭)</label>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <input type="file" id="svcLogoFile" accept="image/*" style="font-size:.84rem;" />
                    <button type="button" id="clearLogoBtn" class="btn btn-outline btn-sm" style="display:none;">이미지 제거</button>
                  </div>
                </div>
              </div>
              <div class="form-grid">
                <div class="field"><label>서비스 이름 *</label><input type="text" id="svcName" maxlength="50" required /></div>
                <div class="field"><label>서브도메인 표기 *</label><input type="text" id="svcSubdomain" maxlength="100" required /></div>
                <div class="field"><label>연결 URL (https:// 필수) *</label><input type="url" id="svcUrl" maxlength="300" required /></div>
                <div class="field"><label>카테고리</label><select id="svcCategory"><option value="social">소셜 & 채팅 (social)</option><option value="entertainment">게임 & 엔터 (entertainment)</option><option value="tools">유틸리티 & AI (tools)</option></select></div>
                <div class="field"><label>상태 및 노출 제어</label><select id="svcStatus"><option value="live">LIVE (정상 운영)</option><option value="beta">BETA (베타 운영)</option><option value="soon">SOON (준비중)</option><option value="blocked">BLOCKED (차단)</option></select></div>
                <div class="field"><label>정렬 순서</label><input type="number" id="svcOrder" value="10" /></div>
              </div>
              <div class="field" style="margin-bottom:16px;"><label>서비스 설명 *</label><input type="text" id="svcDesc" maxlength="200" required /></div>
              <button type="submit" class="btn btn-primary">서버에 안전하게 저장</button>
            </form>
          </div>
          <div class="panel">
            <h2>등록된 전체 서비스 목록</h2>
            <div style="overflow-x:auto;"><table><thead><tr><th>순서</th><th>로고 & 서비스</th><th>서브도메인 / 링크</th><th>카테고리</th><th>상태 / 클릭</th><th>제어</th></tr></thead><tbody id="servicesTableBody"></tbody></table></div>
          </div>
        </div>

        <div id="whitelistTab" style="display:none;">
          <div class="panel">
            <h2>화이트리스트 구글 계정 추가</h2>
            <form id="whitelistForm" style="display:flex;gap:12px;flex-wrap:wrap;">
              <input type="email" id="newAdminEmail" placeholder="구글 이메일" required style="flex:1;min-width:240px;padding:11px 14px;border-radius:10px;border:1px solid var(--border-gray);" />
              <input type="text" id="newAdminMemo" placeholder="메모" style="width:200px;padding:11px 14px;border-radius:10px;border:1px solid var(--border-gray);" />
              <button type="submit" class="btn btn-primary">화이트리스트 등록</button>
            </form>
          </div>
          <div class="panel">
            <h2>화이트리스트 관리자 목록</h2>
            <div style="overflow-x:auto;"><table><thead><tr><th>구글 이메일</th><th>메모</th><th>권한 상태</th><th>관리</th></tr></thead><tbody id="whitelistTableBody"></tbody></table></div>
          </div>
        </div>
      </div>

      <div id="visitorModal" class="modal-backdrop"><div class="modal-card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3>🔍 방문자 상세 로그</h3><button id="closeVisitorModal" class="btn btn-outline btn-sm">닫기 ✕</button></div><div id="visitorModalBody" class="detail-grid"></div></div></div>
      <div id="ipTimelineModal" class="modal-backdrop"><div class="modal-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><div><h3>🕵️ IP 정밀 행적 추적: <span id="timelineIpTitle" style="color:var(--sky-dark);font-family:monospace;"></span></h3><p id="timelineIpSummary" style="font-size:.84rem;color:var(--text-sub);margin-top:4px;"></p></div><button id="closeTimelineModal" class="btn btn-outline btn-sm">닫기 ✕</button></div><div id="ipTimelineBody" class="timeline-list"></div></div></div>
    `;

    bindDashboardEvents();
    startRealtimeListeners();
  }

  function bindDashboardEvents() {
    document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));
    document.getElementById("svcLogoFile").addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = 160; c.height = 160;
          const m = Math.min(img.width, img.height);
          c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 160, 160);
          uploadedIconDataUrl = c.toDataURL("image/webp", 0.9);
          document.getElementById("logoPreviewThumb").innerHTML = `<img src="${esc(uploadedIconDataUrl)}" alt="로고" />`;
          document.getElementById("clearLogoBtn").style.display = "inline-flex";
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("clearLogoBtn").addEventListener("click", () => {
      uploadedIconDataUrl = "";
      document.getElementById("svcLogoFile").value = "";
      document.getElementById("logoPreviewThumb").innerHTML = `<img src="./logo.png" alt="기본 로고" />`;
      document.getElementById("clearLogoBtn").style.display = "none";
    });

    document.getElementById("blockIpForm").addEventListener("submit", async e => {
      e.preventDefault();
      const ip = document.getElementById("manualBlockIp").value.trim();
      const reason = document.getElementById("manualBlockReason").value.trim() || "관리자 수동 차단";
      if (!ip) return;
      await setDoc(doc(db, "blocked_ips", ipToDocId(ip)), { ip, blocked: true, reason, blockedBy: currentUserEmail, blockedAt: serverTimestamp() });
      e.target.reset();
    });

    document.getElementById("noticeForm").addEventListener("submit", async e => {
      e.preventDefault();
      await setDoc(doc(db, "settings", "hub"), {
        noticeText: document.getElementById("hubNoticeText").value.trim(),
        noticeActive: document.getElementById("hubNoticeActive").checked,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
      });
      alert("공지사항이 적용되었습니다.");
    });

    const serviceForm = document.getElementById("serviceForm");
    serviceForm.addEventListener("submit", async e => {
      e.preventDefault();
      const editId = document.getElementById("editServiceId").value;
      const payload = {
        name: document.getElementById("svcName").value.trim(),
        subdomain: document.getElementById("svcSubdomain").value.trim(),
        url: document.getElementById("svcUrl").value.trim(),
        iconImage: uploadedIconDataUrl || "",
        category: document.getElementById("svcCategory").value,
        status: document.getElementById("svcStatus").value,
        order: Number(document.getElementById("svcOrder").value) || 10,
        description: document.getElementById("svcDesc").value.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
      };
      try {
        if (editId) await updateDoc(doc(db, "services", editId), payload);
        else { payload.clicks = 0; payload.createdAt = serverTimestamp(); await addDoc(collection(db, "services"), payload); }
        serviceForm.reset(); uploadedIconDataUrl = "";
        document.getElementById("logoPreviewThumb").innerHTML = `<img src="./logo.png" alt="기본 로고" />`;
        document.getElementById("clearLogoBtn").style.display = "none";
        document.getElementById("editServiceId").value = "";
        document.getElementById("formTitle").textContent = "새 서브도메인 서비스 등록";
        document.getElementById("cancelEditBtn").style.display = "none";
      } catch (err) { alert("서버 저장 거부됨: " + err.message); }
    });

    document.getElementById("cancelEditBtn").addEventListener("click", () => {
      serviceForm.reset(); uploadedIconDataUrl = "";
      document.getElementById("logoPreviewThumb").innerHTML = `<img src="./logo.png" alt="기본 로고" />`;
      document.getElementById("clearLogoBtn").style.display = "none";
      document.getElementById("editServiceId").value = "";
      document.getElementById("formTitle").textContent = "새 서브도메인 서비스 등록";
      document.getElementById("cancelEditBtn").style.display = "none";
    });

    document.getElementById("whitelistForm").addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("newAdminEmail").value.trim().toLowerCase();
      const memo = document.getElementById("newAdminMemo").value.trim();
      await setDoc(doc(db, "admins", email), { email, memo, active: true, addedBy: currentUserEmail, createdAt: serverTimestamp() });
      e.target.reset();
    });

    document.getElementById("visitorSearchInput").addEventListener("input", () => { currentPage = 1; renderVisitors(); });
    document.getElementById("pageSizeSelect").addEventListener("change", () => { currentPage = 1; renderVisitors(); });
    document.getElementById("ipSearchInput").addEventListener("input", renderIpTracker);
    document.getElementById("ipSortSelect").addEventListener("change", renderIpTracker);
    document.getElementById("closeVisitorModal").addEventListener("click", () => { document.getElementById("visitorModal").style.display = "none"; });
    document.getElementById("closeTimelineModal").addEventListener("click", () => { document.getElementById("ipTimelineModal").style.display = "none"; });

    document.getElementById("clearVisitorsBtn").addEventListener("click", async () => {
      if (!confirm("전체 방문자 로그를 모두 삭제하시겠습니까?")) return;
      const snap = await getDocs(collection(db, "visitors"));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.dataset.tab;
        ["visitorsTab", "ipTrackerTab", "blockedIpsTab", "servicesTab", "whitelistTab"].forEach(id => {
          document.getElementById(id).style.display = (id === target) ? "block" : "none";
        });
      });
    });
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      currentUserEmail = null;
      if (unsubServices) unsubServices();
      if (unsubAdmins) unsubAdmins();
      if (unsubVisitors) unsubVisitors();
      if (unsubBlockedIps) unsubBlockedIps();
      mountLoginScreen();
      return;
    }

    try {
      const adminRef = doc(db, "admins", user.email);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        if (user.email === MASTER_EMAIL) {
          await setDoc(adminRef, { email: user.email, memo: "Master Admin", active: true, createdAt: serverTimestamp() });
        } else throw new Error("화이트리스트 미등록");
      } else if (adminSnap.data().active === false && user.email !== MASTER_EMAIL) {
        throw new Error("차단된 계정");
      }
      currentUserEmail = user.email;
      mountDashboardUI(user.email);
    } catch (err) {
      await signOut(auth);
      mountLoginScreen();
      showAuthError(`접근 거부 (${user.email}): ${err.message}`);
    }
  });

  function startRealtimeListeners() {
    unsubBlockedIps = onSnapshot(collection(db, "blocked_ips"), snap => {
      blockedIpMap.clear();
      snap.docs.forEach(d => { if (d.data().blocked !== false) blockedIpMap.set(d.data().ip || d.id, { docId: d.id, ...d.data() }); });
      document.getElementById("kpiBlockedIps").textContent = blockedIpMap.size + "개";
      renderBlockedIpsTable(); renderVisitors(); renderIpTracker();
    });

    unsubVisitors = onSnapshot(query(collection(db, "visitors"), orderBy("visitedAt", "desc")), snap => {
      allVisitors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      document.getElementById("kpiTotalVisitors").textContent = allVisitors.length.toLocaleString() + "건";
      buildIpGroups(); renderVisitors(); renderIpTracker();
    });

    unsubServices = onSnapshot(query(collection(db, "services"), orderBy("order", "asc")), snap => {
      document.getElementById("kpiTotalServices").textContent = snap.size;
      let totalClicks = 0;
      document.getElementById("servicesTableBody").innerHTML = snap.docs.map(d => {
        const s = d.data(); totalClicks += Number(s.clicks) || 0;
        const thumb = s.iconImage ? `<img src="${esc(s.iconImage)}" class="svc-table-thumb" />` : `<img src="./logo.png" class="svc-table-thumb" />`;
        return `<tr><td>${Number(s.order) || 0}</td><td><div style="display:flex;align-items:center;gap:10px;">${thumb}<div><strong>${esc(s.name)}</strong><br><small style="color:#64748b;">${esc(s.description)}</small></div></div></td><td><code>${esc(s.subdomain)}</code><br><a href="${esc(s.url)}" target="_blank" style="font-size:.78rem;color:#0284c7;">${esc(s.url)}</a></td><td>${esc(s.category)}</td><td><span class="status-tag st-${s.status || "soon"}">${esc((s.status || "").toUpperCase())}</span><div style="font-size:.76rem;color:#64748b;margin-top:4px;">클릭: ${(Number(s.clicks) || 0).toLocaleString()}회</div></td><td><div class="actions"><button class="btn btn-outline btn-sm" onclick="window._edSvc('${d.id}')">수정</button><button class="btn btn-outline btn-sm" onclick="window._tgSvc('${d.id}','${s.status}')">${s.status === "blocked" ? "해제" : "차단"}</button><button class="btn btn-danger btn-sm" onclick="window._dlSvc('${d.id}')">삭제</button></div></td></tr>`;
      }).join("");
      document.getElementById("kpiTotalClicks").textContent = totalClicks.toLocaleString();
    });

    getDoc(doc(db, "settings", "hub")).then(snap => {
      if (snap.exists()) {
        document.getElementById("hubNoticeText").value = snap.data().noticeText || "";
        document.getElementById("hubNoticeActive").checked = !!snap.data().noticeActive;
      }
    }).catch(() => {});

    unsubAdmins = onSnapshot(collection(db, "admins"), snap => {
      document.getElementById("whitelistTableBody").innerHTML = snap.docs.map(d => {
        const a = d.data(), email = d.id, prot = email === currentUserEmail || email === MASTER_EMAIL;
        return `<tr><td><strong>${esc(email)}</strong></td><td>${esc(a.memo || "-")}</td><td><span class="status-tag ${a.active ? "st-live" : "st-blocked"}">${a.active ? "ACTIVE" : "BLOCKED"}</span></td><td>${prot ? "<small style='color:#94a3b8;'>보호됨</small>" : `<button class="btn btn-outline btn-sm" onclick="window._tgAdm('${esc(email)}',${!!a.active})">${a.active ? "차단" : "해제"}</button> <button class="btn btn-danger btn-sm" onclick="window._rmAdm('${esc(email)}')">삭제</button>`}</td></tr>`;
      }).join("");
    });
  }

  function renderBlockedIpsTable() {
    const list = Array.from(blockedIpMap.values()).sort((a, b) => toMillis(b.blockedAt) - toMillis(a.blockedAt));
    document.getElementById("blockedIpListCount").textContent = list.length;
    document.getElementById("blockedIpsTableBody").innerHTML = list.length ? list.map(i => `<tr><td><code style="font-weight:800;color:#b91c1c;">${esc(i.ip)}</code></td><td>${esc(i.reason || "-")}</td><td>${formatTime(i.blockedAt)}</td><td><small>${esc(i.blockedBy || "-")}</small></td><td><button class="btn btn-outline btn-sm" onclick="window._ubIp('${esc(i.ip)}')">✅ 해제</button></td></tr>`).join("") : `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">차단된 IP가 없습니다.</td></tr>`;
  }

  function buildIpGroups() {
    const map = new Map();
    allVisitors.forEach(v => {
      const ip = v.ip || "Unknown IP";
      if (!map.has(ip)) map.set(ip, { ip, country: v.country || "-", region: v.region || "-", city: v.city || "-", isp: v.isp || "-", logs: [], devices: new Set(), oses: new Set(), browsers: new Set(), clickedServices: new Set(), totalDurationSec: 0, firstSeenMs: toMillis(v.visitedAt), lastSeenMs: toMillis(v.visitedAt), firstSeenTs: v.visitedAt, lastSeenTs: v.visitedAt });
      const g = map.get(ip); g.logs.push(v);
      if (v.deviceType) g.devices.add(v.deviceType); if (v.os) g.oses.add(v.os); if (v.browser) g.browsers.add(v.browser);
      (v.clickedServices || []).forEach(s => g.clickedServices.add(s));
      g.totalDurationSec += Number(v.durationSec) || 0;
      const ms = toMillis(v.visitedAt);
      if (ms > 0 && (g.firstSeenMs === 0 || ms < g.firstSeenMs)) { g.firstSeenMs = ms; g.firstSeenTs = v.visitedAt; }
      if (ms > g.lastSeenMs) { g.lastSeenMs = ms; g.lastSeenTs = v.visitedAt; }
    });
    ipGroupsList = Array.from(map.values());
    document.getElementById("kpiUniqueIps").textContent = ipGroupsList.length + "명";
  }

  function renderIpTracker() {
    const kw = (document.getElementById("ipSearchInput")?.value || "").trim().toLowerCase();
    const sortMode = document.getElementById("ipSortSelect")?.value || "recent";
    let filtered = ipGroupsList.filter(g => !kw || [g.ip, g.country, g.city, g.isp, ...g.devices, ...g.oses, ...g.clickedServices].join(" ").toLowerCase().includes(kw));
    filtered.sort((a, b) => sortMode === "visits" ? b.logs.length - a.logs.length : (sortMode === "duration" ? b.totalDurationSec - a.totalDurationSec : (sortMode === "clicks" ? b.clickedServices.size - a.clickedServices.size : b.lastSeenMs - a.lastSeenMs)));
    document.getElementById("ipGroupCount").textContent = filtered.length;
    document.getElementById("ipTrackerTableBody").innerHTML = filtered.map(g => {
      const blk = blockedIpMap.has(g.ip);
      return `<tr style="${blk ? "background:#fff1f2;" : ""}"><td><code style="font-weight:800;color:${blk ? "#b91c1c" : "#0284c7"};">${esc(g.ip)}</code><br><small>${esc(g.country)} ${esc(g.city)} (${esc(g.isp)})</small></td><td><span class="status-tag st-beta">${g.logs.length}회</span><br><small>${formatDuration(g.totalDurationSec)}</small></td><td><small>최초: ${formatTime(g.firstSeenTs)}</small><br><strong style="font-size:.82rem;">최근: ${formatTime(g.lastSeenTs)}</strong></td><td><small>${esc(Array.from(g.devices).join(", "))} / ${esc(Array.from(g.oses).join(", "))}</small></td><td>${Array.from(g.clickedServices).map(c => `<span class="status-tag st-live">${esc(c)}</span>`).join(" ") || "-"}</td><td><button class="btn btn-primary btn-sm" onclick="window._opTl('${esc(g.ip)}')">타임라인</button> ${blk ? `<button class="btn btn-outline btn-sm" onclick="window._ubIp('${esc(g.ip)}')">해제</button>` : `<button class="btn btn-danger btn-sm" onclick="window._bkIp('${esc(g.ip)}')">차단</button>`}</td></tr>`;
    }).join("");
  }

  function renderVisitors() {
    const kw = (document.getElementById("visitorSearchInput")?.value || "").trim().toLowerCase();
    const filtered = allVisitors.filter(v => !kw || [v.ip, v.country, v.city, v.isp, v.os, v.browser, ...(v.clickedServices || [])].join(" ").toLowerCase().includes(kw));
    document.getElementById("filteredLogCount").textContent = filtered.length;
    document.getElementById("visitorsTableBody").innerHTML = filtered.map(v => {
      const blk = blockedIpMap.has(v.ip);
      return `<tr style="${blk ? "background:#fff1f2;" : ""}"><td><strong>${formatTime(v.visitedAt)}</strong><br><small>${v.visitCount || 1}회 · ${formatDuration(v.durationSec)}</small></td><td><code style="font-weight:700;color:${blk ? "#b91c1c" : "#0284c7"};">${esc(v.ip)}</code><br><small>${esc(v.country)} ${esc(v.city)} / ${esc(v.isp)}</small></td><td><span class="status-tag st-beta">${esc(v.deviceType)}</span> <strong>${esc(v.os)}</strong><br><small>${esc(v.browser)}</small></td><td><small>${esc(v.screenResolution)} / CPU ${v.cpuCores || "?"}코어</small></td><td><small>${esc(v.referrer)}</small><br><small style="color:#15803d;font-weight:700;">${esc((v.clickedServices || []).join(", "))}</small></td><td><button class="btn btn-outline btn-sm" onclick="window._opVd('${v.id}')">상세</button> ${blk ? `<button class="btn btn-outline btn-sm" onclick="window._ubIp('${esc(v.ip)}')">해제</button>` : `<button class="btn btn-danger btn-sm" onclick="window._bkIp('${esc(v.ip)}')">차단</button>`}</td></tr>`;
    }).join("");
  }

  window._bkIp = async ip => { const r = prompt(`[${ip}] 차단 사유:`, "관리자 차단"); if (r !== null) await setDoc(doc(db, "blocked_ips", ipToDocId(ip)), { ip, blocked: true, reason: r || "관리자 차단", blockedBy: currentUserEmail, blockedAt: serverTimestamp() }); };
  window._ubIp = async ip => { if (confirm(`[${ip}] 차단 해제?`)) await deleteDoc(doc(db, "blocked_ips", ipToDocId(ip))); };
  window._opVd = id => { const v = allVisitors.find(i => i.id === id); if (!v) return; document.getElementById("visitorModalBody").innerHTML = Object.entries(v).map(([k, val]) => `<div class="detail-item"><small>${esc(k)}</small><div>${esc(typeof val === "object" ? JSON.stringify(val) : val)}</div></div>`).join(""); document.getElementById("visitorModal").style.display = "flex"; };
  window._opTl = ip => { const g = ipGroupsList.find(i => i.ip === ip); if (!g) return; document.getElementById("timelineIpTitle").textContent = ip; document.getElementById("ipTimelineBody").innerHTML = g.logs.map(v => `<div class="timeline-item"><strong>${formatTime(v.visitedAt)}</strong> (${formatDuration(v.durationSec)}) — ${esc(v.deviceType)}/${esc(v.os)}/${esc(v.browser)}<br><small>클릭: ${esc((v.clickedServices || []).join(" → ") || "없음")}</small></div>`).join(""); document.getElementById("ipTimelineModal").style.display = "flex"; };
  window._edSvc = async id => { const s = (await getDoc(doc(db, "services", id))).data(); if (!s) return; document.getElementById("editServiceId").value = id; document.getElementById("svcName").value = s.name; document.getElementById("svcSubdomain").value = s.subdomain; document.getElementById("svcUrl").value = s.url; uploadedIconDataUrl = s.iconImage || ""; document.getElementById("svcCategory").value = s.category; document.getElementById("svcStatus").value = s.status; document.getElementById("svcOrder").value = s.order; document.getElementById("svcDesc").value = s.description; document.getElementById("formTitle").textContent = "서비스 수정 중"; document.getElementById("cancelEditBtn").style.display = "inline-block"; window.scrollTo({ top: 0, behavior: "smooth" }); };
  window._tgSvc = async (id, st) => updateDoc(doc(db, "services", id), { status: st === "blocked" ? "live" : "blocked" });
  window._dlSvc = async id => { if (confirm("삭제하시겠습니까?")) await deleteDoc(doc(db, "services", id)); };
  window._tgAdm = async (em, ac) => updateDoc(doc(db, "admins", em), { active: !ac });
  window._rmAdm = async em => { if (confirm("삭제하시겠습니까?")) await deleteDoc(doc(db, "admins", em)); };
})();
