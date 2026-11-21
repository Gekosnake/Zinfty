import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, addDoc, updateDoc, onSnapshot,
  query, orderBy, increment, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(function () {
  "use strict";

  const ALLOWED_HOSTS = ["gekosnake.github.io", "zinfty.com", "www.zinfty.com"];
  const currentHost = (window.location.hostname || "").toLowerCase();

  function terminateSession(msg) {
    try {
      window.stop();
      document.documentElement.innerHTML =
        "<head><title>403 Forbidden</title></head>" +
        "<body style='margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;color:#f87171;font-family:sans-serif;text-align:center;'>" +
        "<div><h2>🚫 접근이 차단되었습니다</h2><p style='color:#94a3b8;font-size:14px;'>" + msg + "</p></div></body>";
    } catch (_) {}
    throw new Error("SECURITY_VIOLATION");
  }

  // 1. 도메인 검증 실패 시 UI 자체를 생성하지 않고 즉시 종료
  if (!ALLOWED_HOSTS.includes(currentHost)) {
    terminateSession("허가되지 않은 도메인 복제 실행이 차단되었습니다.");
  }

  // 2. 우클릭, 텍스트 드래그, F12/소스보기 단축키 차단
  document.addEventListener("contextmenu", e => e.preventDefault(), true);
  document.addEventListener("selectstart", e => e.preventDefault(), true);
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
      terminateSession("개발자 도구 감지로 세션이 보호 종료되었습니다.");
    }
  }, 1500);

  // 3. 정사각형 파비콘 적용
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

  // 4. CSS 스타일 동적 주입 (페이지 소스 보기에 노출 안 됨)
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    :root{--sky:#0ea5e9;--sky-d:#0284c7;--sky-s:#e0f2fe;--bd:#bae6fd;--txt:#0f172a;--sub:#475569}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif;background:linear-gradient(180deg,#e0f2fe 0%,#f8fafc 45%,#fff 100%);color:var(--txt);min-height:100vh;user-select:none;-webkit-user-select:none}
    .nb{display:none;background:linear-gradient(90deg,#0284c7,#0ea5e9);color:#fff;text-align:center;padding:10px 16px;font-size:.88rem;font-weight:700}
    header{background:rgba(255,255,255,.88);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:30}
    .hi{max-width:1160px;margin:0 auto;padding:0 20px;height:70px;display:flex;justify-content:space-between;align-items:center}
    .br{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--txt)}
    .br img{width:42px;height:42px;border-radius:12px;object-fit:cover;border:1.5px solid var(--bd)}
    .bt{font-size:1.25rem;font-weight:800;letter-spacing:-.02em}
    .ib{display:none;padding:9px 16px;border-radius:999px;border:none;background:var(--sky);color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;box-shadow:0 6px 16px rgba(14,165,233,.25);transition:.2s}
    .ib:hover{background:var(--sky-d);transform:translateY(-1px)}
    .hr{max-width:1160px;margin:44px auto 32px;padding:0 20px;text-align:center}
    .hl{width:84px;height:84px;border-radius:24px;object-fit:cover;border:2px solid var(--bd);box-shadow:0 14px 30px rgba(14,165,233,.16);margin-bottom:16px}
    .hr h1{font-size:2rem;font-weight:800;margin-bottom:8px}
    .hr p{color:var(--sub);font-size:.98rem;margin-bottom:24px}
    .fb{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-bottom:28px}
    .fbtn{padding:9px 18px;border-radius:999px;border:1px solid var(--bd);background:#fff;color:var(--sub);font-size:.86rem;font-weight:700;cursor:pointer;transition:.18s}
    .fbtn.on,.fbtn:hover{background:var(--sky);color:#fff;border-color:var(--sky)}
    .gw{max-width:1160px;margin:0 auto 80px;padding:0 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
    .sc{background:#fff;border:1px solid var(--bd);border-radius:22px;padding:24px;box-shadow:0 10px 26px rgba(14,165,233,.06);transition:.2s;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer}
    .sc:hover{transform:translateY(-4px);border-color:var(--sky);box-shadow:0 18px 36px rgba(14,165,233,.14)}
    .sc.sn{opacity:.72;cursor:not-allowed}
    .ct{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
    .sib{width:56px;height:56px;border-radius:16px;border:1px solid var(--bd);overflow:hidden;background:var(--sky-s);display:flex;align-items:center;justify-content:center;font-size:1.6rem}
    .sib img{width:100%;height:100%;object-fit:cover;display:block}
    .bg{padding:4px 10px;border-radius:999px;font-size:.72rem;font-weight:800}
    .bg-live{background:#dcfce7;color:#15803d}.bg-beta{background:#e0f2fe;color:#0369a1}.bg-soon{background:#f1f5f9;color:#475569}
    .st{font-size:1.15rem;font-weight:800;margin-bottom:6px}
    .sd{font-size:.88rem;color:var(--sub);line-height:1.55;margin-bottom:18px}
    .cf{display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid #f1f5f9;font-size:.8rem;color:var(--sky-d);font-weight:700;font-family:monospace}
    .blk{display:none;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px;background:#0f172a;color:#fff}
    footer{text-align:center;padding:28px 20px;color:#94a3b8;font-size:.82rem;border-top:1px solid #f1f5f9}
  `;
  document.head.appendChild(styleEl);

  // 5. 전체 DOM 동적 조립
  const root = document.getElementById("app");
  root.innerHTML = `
    <div id="blkOv" class="blk">
      <div><h1 style="font-size:2rem;color:#f87171;margin-bottom:10px;">🚫 접근이 제한된 IP입니다</h1>
      <p style="color:#94a3b8;">보안 정책에 의해 현재 네트워크에서의 서비스 이용이 차단되었습니다.</p></div>
    </div>
    <div id="hubWrap">
      <div id="ntcBar" class="nb"></div>
      <header>
        <div class="hi">
          <a href="./index.html" class="br"><img src="./logo.png" alt="Zinfty" /><span class="bt">Zinfty</span></a>
          <button id="pwaBtn" class="ib">📲 앱 설치</button>
        </div>
      </header>
      <section class="hr">
        <img src="./logo.png" alt="Zinfty Hub" class="hl" />
        <h1>Zinfty Service Hub</h1>
        <p>모든 Zinfty 웹 서비스와 AI 도구를 한곳에서 바로 실행하세요.</p>
        <div class="fb">
          <button class="fbtn on" data-cat="all">전체 보기</button>
          <button class="fbtn" data-cat="social">소셜 & 채팅</button>
          <button class="fbtn" data-cat="entertainment">게임 & 엔터</button>
          <button class="fbtn" data-cat="tools">유틸리티 & AI</button>
        </div>
      </section>
      <main class="gw" id="svcGrid">
        <div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:40px;">서비스 목록을 불러오는 중...</div>
      </main>
      <footer>© 2026 Zinfty. All rights reserved.</footer>
    </div>
  `;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  let deferredPrompt = null;
  const pwaBtn = document.getElementById("pwaBtn");
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    pwaBtn.style.display = "inline-block";
  });
  pwaBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    pwaBtn.style.display = "none";
  });

  const firebaseConfig = {
    apiKey: "AIzaSyACPThFj93lZ__x6OjIsNQaifL9LAEleGw",
    authDomain: "zinfty.firebaseapp.com",
    projectId: "zinfty",
    storageBucket: "zinfty.firebasestorage.app",
    messagingSenderId: "858644844927",
    appId: "1:858644844927:web:43427e13c7c01a8f288a4a",
    measurementId: "G-04QXTF2YYQ"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  let allServices = [];
  let currentCat = "all";
  let visitorDocRef = null;
  const sessionStart = Date.now();

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  onSnapshot(doc(db, "settings", "hub"), snap => {
    const bar = document.getElementById("ntcBar");
    if (snap.exists() && snap.data().noticeActive && snap.data().noticeText) {
      bar.textContent = "📢 " + snap.data().noticeText;
      bar.style.display = "block";
    } else {
      bar.style.display = "none";
    }
  });

  onSnapshot(query(collection(db, "services"), orderBy("order", "asc")), snap => {
    allServices = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== "blocked");
    renderServices();
  });

  function renderServices() {
    const grid = document.getElementById("svcGrid");
    const list = currentCat === "all" ? allServices : allServices.filter(s => s.category === currentCat);
    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:40px;">표시할 서비스가 없습니다.</div>`;
      return;
    }

    grid.innerHTML = list.map(s => {
      const isSoon = s.status === "soon";
      const bgCls = s.status === "live" ? "bg-live" : (s.status === "beta" ? "bg-beta" : "bg-soon");
      const iconHtml = s.iconImage
        ? `<img src="${esc(s.iconImage)}" alt="${esc(s.name)}" />`
        : (s.icon ? esc(s.icon) : `<img src="./logo.png" alt="Zinfty" />`);

      return `
        <article class="sc ${isSoon ? "sn" : ""}" data-id="${s.id}">
          <div>
            <div class="ct"><div class="sib">${iconHtml}</div><span class="bg ${bgCls}">${esc((s.status || "live").toUpperCase())}</span></div>
            <h2 class="st">${esc(s.name)}</h2>
            <p class="sd">${esc(s.description)}</p>
          </div>
          <div class="cf"><span>${esc(s.subdomain)}</span><span>${isSoon ? "준비중" : "바로가기 ↗"}</span></div>
        </article>`;
    }).join("");

    grid.querySelectorAll(".sc").forEach(card => {
      card.addEventListener("click", async () => {
        const svc = allServices.find(item => item.id === card.dataset.id);
        if (!svc || svc.status === "soon" || !svc.url) return;
        try {
          await updateDoc(doc(db, "services", svc.id), { clicks: increment(1) });
          if (visitorDocRef) await updateDoc(visitorDocRef, { clickedServices: arrayUnion(svc.name) });
        } catch (_) {}
        window.open(svc.url, "_blank", "noopener,noreferrer");
      });
    });
  }

  document.querySelectorAll(".fbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fbtn").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      currentCat = btn.dataset.cat;
      renderServices();
    });
  });

  async function initVisitor() {
    let uuid = localStorage.getItem("zinfty_vid");
    if (!uuid) {
      uuid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
      localStorage.setItem("zinfty_vid", uuid);
    }
    const visitCount = (Number(localStorage.getItem("zinfty_vcnt")) || 0) + 1;
    localStorage.setItem("zinfty_vcnt", String(visitCount));

    let geo = { ip: "수집 불가", country: "-", countryCode: "-", region: "-", city: "-", isp: "-", org: "-", asn: "-" };
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (res.ok) {
        const d = await res.json();
        geo = { ip: d.ip || "수집 불가", country: d.country_name || "-", countryCode: d.country_code || "-", region: d.region || "-", city: d.city || "-", isp: d.org || "-", org: d.org || "-", asn: d.asn || "-" };
      }
    } catch (_) {}

    if (geo.ip && geo.ip !== "수집 불가") {
      const blkSnap = await getDoc(doc(db, "blocked_ips", geo.ip.replace(/[^a-zA-Z0-9._-]/g, "_"))).catch(() => null);
      if (blkSnap && blkSnap.exists() && blkSnap.data().blocked !== false) {
        document.getElementById("hubWrap").style.display = "none";
        document.getElementById("blkOv").style.display = "flex";
        return;
      }
    }

    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    const os = /Windows/i.test(ua) ? "Windows" : (/Mac/i.test(ua) ? "macOS/iOS" : (/Android/i.test(ua) ? "Android" : "Linux/Other"));
    const browser = /Edg/i.test(ua) ? "Edge" : (/Chrome/i.test(ua) ? "Chrome" : (/Safari/i.test(ua) ? "Safari" : "Other"));

    try {
      visitorDocRef = await addDoc(collection(db, "visitors"), {
        visitorUuid: uuid, visitCount, ...geo,
        deviceType: isMobile ? "Mobile" : "Desktop", os, browser,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        pixelRatio: window.devicePixelRatio || 1,
        colorDepth: screen.colorDepth || 24,
        cpuCores: navigator.hardwareConcurrency || null,
        deviceMemoryGB: navigator.deviceMemory || null,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        language: navigator.language || "-",
        languages: navigator.languages || [],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "-",
        referrer: document.referrer || "직접 유입",
        entryUrl: window.location.href,
        userAgent: ua,
        clickedServices: [],
        durationSec: 0,
        visitedAt: serverTimestamp()
      });

      setInterval(() => {
        if (visitorDocRef) updateDoc(visitorDocRef, { durationSec: Math.floor((Date.now() - sessionStart) / 1000) }).catch(() => {});
      }, 15000);
    } catch (_) {}
  }

  initVisitor();
})();
