# Plan — Local Dev Launcher

> Sinh bởi Leader. Nguồn ngữ cảnh: `ai/CONTEXT.md` + README/`package.json` **thực tế** đã verify (selfpointrest, loyalty, token-service, indexer, public/{backend,frontend,mobile,collection}, new-frontend/apps/stor-web/project.json, new-frontend/package.json).
> Ngày tạo: 2026-06-29 · Tác giả: Leader (AI)

> ## 🤝 HANDOFF — Claude **HOÀN TẤT 16/17** (scope cũ code-complete · cập nhật 2026-06-30)
> Phiên Codex trước hết token; Claude đã tiếp tục theo pipeline Leader→Coder→Reviewer và hoàn tất **TOÀN BỘ 16 task scope cũ** (kể cả TG2 optional). Bổ sung mới theo yêu cầu 2026-06-30: **TB3** để thêm reset/discard local changes trước checkout/pull (ban đầu pending; xem handoff Codex Leader bên dưới để biết trạng thái đã PASS).
> - **Đã xong + verify PASS + commit & push lên `main` (16/17):** TA1, TA2, TB1, TB2, TC1, TD1, TE1, TF1, TF2, TF3, TG1, TG2, TH1, TH2, TI1, TJ1.
>   - Mỗi commit có hậu tố `(reviewed PASS)` = đã qua Reviewer agent **hoặc** Leader focused re-verify (kèm output) → đáng tin.
>   - Mốc lưu ý: TF1 fix BLOCKER **build-only guard**; **token-service nghe 4001** qua `.env` (không trùng loyalty 4000); indexer `specials` patch vào `config/default.json` (specials.js đọc `config.get`).
> - **Tại thời điểm handoff cũ còn lại:** `TB3` — reset tracked changes về `HEAD` hoặc discard local changes có preview + xác nhận để unblock checkout/pull branch mới. Xem handoff Codex Leader bên dưới: TB3 đã được implement + Reviewer PASS.
> - **Cần chạy THẬT để nghiệm thu cuối** (ngoài phạm vi auto-verify — cần **VPN + DB/ES nội bộ**): `npm install` → `npm start`, kết nối VPN (nhập probe host:port nội bộ ở VpnStatus), chọn env prod/test, Build & Start selfpointrest (3000) + ≥1 UI / stor-web (3002), rồi Stop all. Hướng dẫn: `LAUNCHER.md`. (DoD §4: các mục này đánh `[~]`.)
> - **Quy ước tin cậy (CLAUDE.md §7):** chỉ tin checkbox `[x]` khi commit tương ứng có `(reviewed PASS)`.
> - **Ràng buộc verify an toàn đã áp dụng:** KHÔNG launch server/VPN/GUI thật → runner/ports/vpn verify bằng **synthetic + static `describeRun`**; indexer patch verify trên **BẢN COPY** (file `repositories/*` nguyên vẹn).

> ## 🤝 HANDOFF — Codex Leader (2026-06-30)
> - Đã đọc `.codex/agents/launcher-leader.md`, `launcher-coder.md`, `launcher-reviewer.md`, `ai/CONTEXT.md`, `ai/prompts/02-coder.md`, `ai/prompts/03-reviewer.md`, và kiểm tra `plan.md`.
> - **TB3 đã implement + Reviewer PASS.** Coder sub-agent `Feynman` bị usage-limit trước khi gửi final report, nhưng diff TB3 đã xuất hiện trong đúng write-set: `src/main/orchestrator/git.js`, `src/main/ipc.js`, `src/main/preload.js`, `src/renderer/components/BranchPicker.jsx`, `plan.md`.
> - Verify Leader đã chạy: `node --check src\main\orchestrator\git.js`, `node --check src\main\ipc.js`, `node --check src\main\preload.js`, `npm.cmd run build:renderer`, và fixture Git tạm dưới `C:\tmp` cho preview/reset/discard — PASS. Không chạy destructive Git command trên managed repos thật.
> - Reviewer sub-agent `Meitner` review **TB3 PASS**, không có finding: dirty checkout/pull vẫn bị chặn; `resetTrackedChanges` dùng `git reset --hard HEAD`; `discardAllLocalChanges` dùng `git reset --hard HEAD` + `git clean -fd`; preview chỉ dùng metadata Git; confirm theo `repoId` + `action`; có cảnh báo `stor-web` monorepo.
> - Còn lại sau TB3: không còn task plan/code pending. Các mục `[~]` trong Definition of Done vẫn cần nghiệm thu thật với VPN + DB/ES nội bộ trước khi coi end-to-end production-ready.

> ## 🤝 HANDOFF — Codex Phase K (2026-06-30)
> - **TK1 implement + Reviewer PASS.** Coder `Kierkegaard` cập nhật `repos.js` resolver/injection workspace roots và `store.DEFAULT_CONFIG.workspaceRoots`; Reviewer `Beauvoir` PASS. Verify: `node --check repos.js/store.js`, injected roots one-liner, store round-trip, `npm.cmd run build:renderer` — PASS. Không chạm real managed repos.
> - **TK4 implement + Reviewer PASS.** Coder `Schrodinger` thêm `platform.js` và wire `deps.js`/`indexer.js`; Reviewer `Pasteur` PASS. Verify: `node --check platform/deps/indexer`, mock `pmCommand/openPath` win/mac/linux, mock deps/indexer, `npm.cmd run build:renderer` — PASS. Lưu ý khi stage/commit: `src/main/orchestrator/platform.js` là file mới untracked.
> - **TK2 implement + Reviewer PASS.** Coder `Raman` thêm `workspace:getRoots/setRoots/pickFolder`, `store.validateRoot`, preload `launcher.workspace`, và apply roots vào repo registry; Reviewer `Goodall` PASS. Verify: syntax checks, temp marker fixtures, mock Electron IPC/dialog, mock preload bridge — PASS. Không mở dialog thật, không chạm managed repos.
> - Phase K tiếp theo theo plan: **TK3**, rồi **TK5/TK6**, cuối cùng **TK7**.

## 0. Tóm tắt

Xây **Local Dev Launcher** — một desktop app cho 1 dev nội bộ (Windows) để khởi động môi trường local SelfPoint: chọn repo (trong 9 repo của 2 workspace) → chọn branch → fetch/pull → cài deps còn thiếu → bật & chờ VPN → chọn env cho selfpointrest → build/run đúng thứ tự → stream log → **stop/restart**. Đầu ra cuối: một app chạy được (`npm start`) quản lý vòng đời tất cả repo từ một cửa sổ.

## 1. Stack đã chọn (kèm lý do)

| Tiêu chí | **Electron** ✅ | Web dashboard (Node+browser) | CLI/TUI |
|---|---|---|---|
| Phù hợp "app + thông báo" | Cao — cửa sổ riêng + **native Notification** | TB — chỉ toast trong tab | Thấp — khó "thông báo" |
| Quản lý nhiều long-running process | Cao — Node đầy đủ ở main process | Cao — Node backend | TB — nhiều luồng log rối |
| Gọi git + `openvpn-gui.exe` + kill cây process | Dễ (Node `child_process` + `taskkill /T`) | Dễ | Dễ |
| Stream nhiều log song song | Tốt (panel/tab) | Tốt | Kém trong 1 terminal |
| Tốc độ phát triển / đóng gói | TB — có IPC main/renderer + packaging | Nhanh nhất | Nhanh |

**Lựa chọn: `Electron` (renderer React + Vite, main process là Node).**
**Lý do:** yêu cầu nêu rõ "app" + "hiển thị thông báo" (chọn branch, "Hãy đăng nhập VPN") → cần **native notification** + 1 cửa sổ điều khiển thường trú; cần quản lý ~9 long-running process kèm stream log và **kill cả cây process** trên Windows → main process Node làm gọn việc này; lưu config dễ (thư mục userData). Web dashboard là phương án á quân (nhẹ hơn) — vì vậy **toàn bộ logic orchestrator được tách thành module Node thuần, độc lập UI**, để dễ test bằng CLI và có thể tái dùng nếu sau này đổi sang web.

**Thư viện/khung chính dự kiến:** `electron`, `vite` + `react` (renderer), `child_process` (spawn + `taskkill /T /F` để kill cây process trên Windows; có thể thêm `tree-kill`), `git` CLI gọi trực tiếp (không thêm dep nặng; cân nhắc `simple-git` vì team đã quen), `electron-store` (hoặc JSON trong userData) cho config, `net.Socket` cho VPN probe.

## 2. Kiến trúc tổng quan

UI (renderer React) ⇄ **IPC** ⇄ **Orchestrator (Node, UI-agnostic)** ⇄ hệ thống (git, npm/pnpm, openvpn-gui, process con).

- **Repo registry** (`src/main/orchestrator/repos.js`): mã hóa 9 repo từ CONTEXT §3 (id, tên, workspace, path tuyệt đối, packageManager, installCwd, lệnh install/build/start, port mặc định, defaultBranch, nhóm phụ thuộc selfpointrest, cờ needsVpn/buildOnly). **Mọi task khác đọc từ đây** — không hardcode path rải rác.
- **Process orchestrator** (`runner.js`): `spawn(cmd, {cwd, env, shell:true})`, lưu PID + buffer log, broadcast log qua IPC; **stop = kill cây process** (`taskkill /T /F /PID <pid>`); theo dõi exit → cập nhật state; restart = stop→start.
- **Git layer** (`git.js`): listBranches (local+remote), currentBranch, isClean, fetch/checkout/pull an toàn.
- **Deps layer** (`deps.js`): kiểm tra thiếu/stale → install (npm theo từng repo sp, pnpm ở root new-frontend).
- **VPN layer** (`vpn.js`): probe TCP host:port (config) hoặc `Get-NetAdapter`; mở `openvpn-gui.exe`; poll + timeout.
- **Env layer** (`env.js`): selfpointrest prod/test → `.env` (backup, không log secret).
- **Ports layer** (`ports.js`): kiểm tra port bận + map repo↔port + override.
- **Config store** (`store.js`): F12 — lưu/khôi phục lựa chọn.
- **State model** mỗi repo: `stopped | fetching | installing | building | running | crashed`.

## 3. Phases & Tasks

> Quy ước: `- [ ] T<id>: <việc>` · `Acceptance:` · `Verify:` · `Files:` · `Deps:`. Coder làm 1 task/lượt, tick `[x]` khi PASS.

### Phase A — Scaffold dự án
- [x] **TA1: Khởi tạo Electron + Vite + React, mở được cửa sổ rỗng**
  - Acceptance: `npm start` build renderer (Vite) + mở 1 cửa sổ Electron hiển thị "Local Dev Launcher"; không lỗi console.
  - Verify: chạy `npm start` → cửa sổ hiện ra; đóng cửa sổ → process thoát sạch.
  - Files: `package.json`, `vite.config.js`, `src/main/main.js`, `src/main/preload.js`, `src/renderer/index.html`, `src/renderer/App.jsx`.
  - Deps: —
- [x] **TA2: Repo registry + IPC bridge khung**
  - Acceptance: có `src/main/orchestrator/repos.js` export 9 repo đúng path/lệnh/port/defaultBranch theo CONTEXT §3 (đã verify §5 plan); renderer gọi được `ipc: listRepos()` và render danh sách 9 repo nhóm theo workspace.
  - Verify: mở app → thấy đủ 9 repo, đúng tên + path + branch mặc định (master / new-frontend-dev-prod).
  - Files: `src/main/orchestrator/repos.js`, `src/main/ipc.js`, `src/main/preload.js`, `src/renderer/components/RepoList.jsx`.
  - Deps: TA1

### Phase B — Git & Branch (F2, F3)
- [x] **TB1: Git layer — list branch + current + isClean**
  - Acceptance: hàm `listBranches(repoId)` trả về local+remote; `currentBranch(repoId)`; `isClean(repoId)` đúng với `git status`.
  - Verify: với selfpointrest và stor-web, so kết quả hàm vs `git branch -a` / `git status` chạy tay → khớp.
  - Files: `src/main/orchestrator/git.js`, `src/main/ipc.js`.
  - Deps: TA2
- [x] **TB2: Fetch + checkout + pull an toàn + branch picker UI**
  - Acceptance: `git fetch --all --prune` → UI hiện picker, **preselect** default branch; nếu default không tồn tại → chọn từ list thật (không fail); checkout + pull **chỉ khi working tree sạch**, nếu bẩn → cảnh báo, không overwrite.
  - Verify: đổi branch 1 repo qua UI → `git branch --show-current` khớp; thử với repo có thay đổi local → nhận cảnh báo, không mất thay đổi.
  - Files: `src/main/orchestrator/git.js`, `src/renderer/components/BranchPicker.jsx`.
  - Deps: TB1
- [x] **TB3: Reset/discard local changes có xác nhận để unblock checkout/pull**
  - Acceptance: Khi repo dirty, UI vẫn chặn checkout/pull mặc định nhưng hiển thị 2 hành động phá thay đổi rõ ràng: (1) **Reset tracked changes về `HEAD` hiện tại** bằng `git reset --hard HEAD` (không reset về `origin/<branch>`, không đụng untracked files); (2) **Discard toàn bộ local changes** bằng `git reset --hard HEAD` + `git clean -fd` (tracked + untracked non-ignored). Trước khi chạy phải preview bằng `git status --short` và `git clean -fdn`, yêu cầu confirm theo từng repo, không in nội dung `.env*`/secret, không chạy tự động trước checkout/pull. Với `stor-web`, cảnh báo thao tác tác động cả root `new-frontend` monorepo.
  - Verify: tạo fixture git tạm với tracked modified file + untracked file; cancel confirm → không đổi gì; reset tracked → tracked file về `HEAD`, untracked còn nguyên; discard all → tracked về `HEAD`, untracked bị xoá; sau khi sạch thì checkout/pull được gọi bình thường. Smoke trên repo thật chỉ dùng repo sạch hoặc copy/fixture, không phá working tree thật.
  - Files: `src/main/orchestrator/git.js`, `src/main/ipc.js`, `src/main/preload.js`, `src/renderer/components/BranchPicker.jsx`.
  - Deps: TB2

### Phase C — Dependencies (F4)
- [x] **TC1: Install deps khi thiếu (npm theo repo sp; pnpm ở root new-frontend)**
  - Acceptance: phát hiện `node_modules` thiếu/stale (so mtime với lockfile) → install đúng PM (npm trong từng repo sp; `pnpm install` ở **root** new-frontend cho stor-web); có nút **force reinstall**; stream output; báo lỗi rõ nếu postinstall (gulp buildAll/bower) hoặc **Husky** fail (kèm gợi ý retry).
  - Verify: xóa `node_modules` của loyalty → install thành công; với new-frontend chạy `pnpm install` ở root (không phải trong apps/stor-web).
  - Files: `src/main/orchestrator/deps.js`.
  - Deps: TA2

### Phase D — VPN (F5)
- [x] **TD1: VPN detect → mở openvpn-gui → poll + thông báo + skip**
  - Acceptance: probe (TCP tới `host:port` cấu hình được; fallback `Get-NetAdapter`) cho biết VPN up/down; nếu down → chạy `C:\Program Files\OpenVPN\bin\openvpn-gui.exe` (nếu chưa chạy) + **native notification** "Hãy đăng nhập VPN" + poll mỗi 2–3s tới khi up hoặc timeout; có nút **Skip** (cho luồng chỉ chạy UI).
  - Verify: khi VPN tắt → app báo + mở GUI; sau khi connect tay → app tự nhận "VPN connected" trong < poll interval.
  - Files: `src/main/orchestrator/vpn.js`, `src/renderer/components/VpnStatus.jsx`.
  - Deps: TA2

### Phase E — Env selfpointrest (F6)
- [x] **TE1: Chọn prod/test → `.env` (backup, đảm bảo clients_dir, không log secret)**
  - Acceptance: UI chọn prod/test (mặc định **prod**); backup `.env` hiện tại → `.env.bak-<timestamp>`; **copy** `.env-prod|.env-test` → `.env` (giữ nguyên 2 file gốc); đảm bảo dòng `clients_dir="../../public"` (thêm nếu thiếu); **không in nội dung .env ra log**; hiển thị "env = prod/test".
  - Verify: chọn test → `.env` khớp `.env-test` (so hash, không in nội dung); có file `.env.bak-*`; `.env-prod`/`.env-test` còn nguyên.
  - Files: `src/main/orchestrator/env.js`, `src/renderer/components/EnvSelector.jsx`.
  - Deps: TA2

### Phase F — Build & Run (F7)
- [x] **TF1: selfpointrest — install→buildAll→start (3000) + build UI backend/frontend tùy chọn**
  - Acceptance: chạy được theo thứ tự install(nếu thiếu)→`npm run buildAll`→`npm start` (port 3000); nếu user chọn xem UI Back Office/Frontend thì build qua **script orchestration của selfpointrest**: `npm run build-backend`, `npm run build-kikar`, `npm run build-prutah` **trước** khi start; mở được `http://localhost:3000`, `/backend`, `/kikar`, `/prutah`.
  - Verify: sau start, `http://localhost:3000` phản hồi; nếu đã build-kikar thì `/kikar` load. (⚠️ Xem Rủi ro R1 về lệnh build frontend.)
  - Files: `src/main/orchestrator/runner.js`, `repos.js` (build steps), `src/renderer/components/RunControls.jsx`.
  - Deps: TC1, TE1, (TD1 nếu cần DB)
- [x] **TF2: loyalty / token-service / indexer — start + port-aware (token-service 4001, không trùng)**
  - Acceptance: loyalty (`npm start`, 4000) và token-service (`npm run build`(tsc)→`npm start`, mặc định 4000) chạy đồng thời **không đụng port** nhờ override `PORT` (đặt qua env khi spawn); indexer (`npm start`, 4002, có `--max-old-space-size=3000`) start sau khi qua Phase G.
  - Verify: bật loyalty + token-service cùng lúc → cả hai `running`, 2 port khác nhau; `netstat` không báo lỗi EADDRINUSE.
  - Files: `src/main/orchestrator/runner.js`, `ports.js`, `repos.js`.
  - Deps: TC1, (TD1 nếu cần DB)
- [x] **TF3: mobile / collection (9000) + stor-web (3002)**
  - Acceptance: mobile (`npm run serve`) và collection (`npm run serve`) chạy ở 9000 — **cảnh báo nếu chọn cả hai** (trùng 9000); stor-web chạy `pnpm nx serve stor-web` ở root new-frontend → port 3002.
  - Verify: start stor-web → `http://localhost:3002` load; start mobile → `http://localhost:9000` load; chọn cả mobile+collection → nhận cảnh báo trùng port.
  - Files: `src/main/orchestrator/runner.js`, `ports.js`, `repos.js`.
  - Deps: TC1

### Phase G — Indexer edits + Restart (F8, F10)
- [x] **TG1: Hỗ trợ sửa `test/products.js` & `test/specials.js` + restart**
  - Acceptance: UI cho (a) **mở** 2 file bằng editor mặc định, và/hoặc (b) nhập preset (retailerId, productIds, special) → patch vào file **idempotent + backup** (`*.bak-<ts>`); nút **Restart** indexer = kill cây process cũ → start lại với `--max-old-space-size=3000`.
  - Verify: đổi preset → file cập nhật đúng (diff), có backup; Restart → PID đổi, process mới chạy.
  - Files: `src/main/orchestrator/indexer.js`, `runner.js`, `src/renderer/components/IndexerPanel.jsx`.
  - Deps: TF2
- [x] **TG2: (tùy chọn) Tự động hóa REST-only — comment `queue.subscribe()`**
  - Acceptance: cờ "REST-only" → patch idempotent comment/bỏ comment `queue.subscribe()` trong `server.js` (có backup).
  - Verify: bật cờ → dòng bị comment; tắt → khôi phục.
  - Files: `src/main/orchestrator/indexer.js`, `src/main/ipc.js`, `src/main/preload.js`, `src/renderer/components/IndexerPanel.jsx`.
  - Deps: TG1

### Phase H — Stop & Status & Logs (F9, F11)
- [x] **TH1: Log streaming + bảng trạng thái**
  - Acceptance: mỗi repo có panel log (stream stdout/stderr realtime); bảng trạng thái hiển thị state + port + branch hiện tại; cập nhật khi process crash.
  - Verify: start 1 repo → log chảy realtime; kill process ngoài app → state chuyển `crashed`.
  - Files: `src/renderer/components/LogPane.jsx`, `StatusTable.jsx`, `src/main/orchestrator/runner.js`.
  - Deps: TF1
- [x] **TH2: Stop từng repo + Stop all (kill cây process, giải phóng port)**
  - Acceptance: Stop 1 repo và **Stop all** kill **toàn bộ cây process con** (`taskkill /T /F`); sau stop, port được giải phóng (kiểm chứng); không còn node/gulp/next mồ côi.
  - Verify: start vài repo → Stop all → `netstat` không còn các port (3000/3002/4000/...); Task Manager không còn node con của app.
  - Files: `src/main/orchestrator/runner.js`, `ports.js`.
  - Deps: TF1

### Phase I — Persist config (F12)
- [x] **TI1: Lưu & khôi phục lựa chọn**
  - Acceptance: lưu repo đã chọn, branch, env (prod/test), port override, VPN probe host vào config; mở lại app → khôi phục đúng.
  - Verify: chọn cấu hình → tắt mở app → cấu hình còn nguyên.
  - Files: `src/main/orchestrator/store.js`, `ipc.js`.
  - Deps: TA2

### Phase J — Đóng gói & tài liệu
- [x] **TJ1: Script chạy/đóng gói + README**
  - Acceptance: `npm start` (dev) hoạt động; (tùy chọn) `npm run package` ra app Windows; README hướng dẫn từ máy sạch (yêu cầu Node 20.x, corepack, OpenVPN GUI, lấy `.ovpn` từ team).
  - Verify: làm theo README trên mô tả → chạy được app.
  - Files: `package.json`, `README.md` (của launcher), (tùy chọn) `electron-builder` config.
  - Deps: TH2, TI1
  - **Done (2026-06-30):** Tài liệu chạy app tách ra [`LAUNCHER.md`](./LAUNCHER.md) (giữ nguyên `README.md` của AI pack, chỉ thêm 1 dòng pointer) — đủ prerequisites (Node 20.x, `corepack enable`, OpenVPN GUI + `.ovpn` từ team), install+run (`npm install` → `npm start`), F1–F12, lưu ý port/VPN. `package.json` đã có script rõ: `start` (`electron .`), `build:renderer` (`vite build`). **Đóng gói = tài liệu thủ công** (`npx electron-builder --win portable`) — KHÔNG thêm devDep `electron-builder` để giữ launcher nhẹ (low-risk). Verify: `node --check src/main/main.js` OK, `npx vite build` PASS (output `dist/renderer/`).

## 4. Definition of Done

> Cập nhật 2026-06-30 (sau TJ1). Quy ước: `[x]` = đạt qua task có Reviewer/Leader verify (kèm bằng chứng); `[~]` = code đã có + verify tĩnh/synthetic, **cần chạy thật với VPN/DB** để nghiệm thu end-to-end (ngoài phạm vi verify tự động vì cần VPN + DB nội bộ).

- [x] Tất cả F1–F12 (CONTEXT §11) đạt về mặt implementation — TA1–TI1 + TB3 đều reviewed PASS; F3 đã có reset/discard local changes có preview + confirm. *(Các luồng cần backend thật vẫn xem `[~]` bên dưới.)*
- [~] Khởi động được selfpointrest (3000) + ≥1 UI (vd stor-web 3002 hoặc `/backend`) từ launcher — code/`describeRun` đúng (TF1/TF3, reviewed PASS); **chạy thật cần VPN + DB** → để dev nghiệm thu theo `LAUNCHER.md` §3.
- [x] Stop all dừng sạch, không process/port treo — TH2 (reviewed PASS): `taskkill /T /F` cây process + giải phóng port.
- [x] Restart indexer hoạt động sau khi sửa code — TG1 (reviewed PASS): patch idempotent + backup, restart đổi PID.
- [x] Không log secret; không sửa ngoài phạm vi `repositories/*` ngoài `.env` + indexer (idempotent + backup) — TE1/TG1 (reviewed PASS): backup `.env`/`*.bak-<ts>`, không in nội dung `.env*`.
- [x] README chạy được từ máy sạch — `LAUNCHER.md` (link từ `README.md`): prerequisites (Node 20.x, corepack/pnpm, OpenVPN GUI + `.ovpn`) + `npm install` → `npm start` + F1–F12 + lưu ý port/VPN. *(Khởi động backend trong app vẫn cần VPN/DB như mục `[~]`.)*

## 5. Giả định & Rủi ro

**Điểm lệch đã phát hiện khi verify (đã sửa trong plan; nên cập nhật lại CONTEXT §3):**
- **R1 — Lệnh build frontend (Kikar/Prutah):** CONTEXT §3 ghi `node builder --template=Kikar` chạy trong `public/frontend` — **không tồn tại** script này. Thực tế: build template qua **selfpointrest** `npm run build-kikar` / `npm run build-prutah` (= `node builder frontend build -t kikar|prutah`), hoặc frontend `npm run build-local`. Plan dùng script selfpointrest. Coder PHẢI verify lại đầu ra build (đường dẫn `build/`) trước khi tick TF1.
- **R2 — `node livereload run <Template>` (port 35999):** không có script tương ứng trong `public/frontend/package.json` (chỉ có dep `livereload`). Đây là chế độ dev nâng cao → **để ngoài phạm vi** luồng run cơ bản; ghi chú để xử lý sau nếu cần.
- **R3 — Build UI Back Office:** dùng selfpointrest `npm run build-backend` hoặc backend `npm run build-local` (ra `servers/selfpointrest/build/backend`). Coder chọn 1 và verify.

| Giả định | Nếu sai thì |
|---|---|
| Branch mặc định (master / new-frontend-dev-prod) tồn tại | fallback picker (TB2) |
| VPN probe host do user nhập (vd host DB/ES nội bộ) | onboarding bắt nhập; có nút Skip |
| Node 20.x + `corepack enable` (pnpm) sẵn sàng | TC1 kiểm tra version & cảnh báo |
| openvpn-gui.exe ở `C:\Program Files\OpenVPN\bin\` | cho cấu hình lại đường dẫn |

| Rủi ro | Giảm thiểu |
|---|---|
| Kill process con sót trên Windows (npm/gulp/next spawn nhiều con) | `taskkill /T /F` theo PID gốc (TH2) |
| Postinstall (gulp buildAll/bower) hoặc Husky lỗi khi install | bắt lỗi, hiển thị log, nút retry/force (TC1) |
| Trùng port 4000 (loyalty/token-service) & 9000 (mobile/collection) | override PORT + kiểm tra port bận + cảnh báo (TF2/TF3) |
| selfpointrest cần VPN để buildAll/start (DB) | gắn TD1 trước TF1 khi cần DB |
| token-service build TS lỗi version | `npm run build` (tsc 4.9.5) trước start; hiện lỗi tsc rõ |
| Reset/discard Git làm mất thay đổi chưa commit | mặc định chỉ cảnh báo; destructive action cần preview + confirm theo repo; verify bằng fixture tạm, không test phá repo thật |

## 6. Thứ tự thực thi đề xuất

1. **TA1 → TA2** (scaffold + repo registry + IPC) — nền tảng, mọi thứ phụ thuộc.
2. **TH1 (log)** sớm một phần để debug, hoặc làm tối thiểu rồi quay lại — *khuyến nghị*: làm `runner.js` cơ bản trong TF nhưng tách log sau.
3. **TB1 → TB2 → TB3** (git/branch + reset/discard dirty working tree có xác nhận).
4. **TC1** (deps).
5. **Chạy 1 repo end-to-end:** TE1 → TF1 (selfpointrest) — mốc giá trị đầu tiên.
6. **TF2 → TF3** (mở rộng các backend/UI khác) + **TD1** (VPN, chèn trước backend cần DB).
7. **TG1 → TG2** (indexer + restart).
8. **TH1 → TH2** (log + stop all).
9. **TI1** (persist) → **TJ1** (đóng gói + README).

**3 task nên làm trước:** `TA1`, `TA2`, `TB1`.

## 7. Handoff note — Codex -> Claude (2026-06-29)

- Codex review PASS trong luồng này: `TB1` re-check PASS, `TB2` PASS, `TC1` PASS, `TD1` PASS, `TE1` PASS.
- `TD1` từng FAIL review vì 2 lỗi: configured TCP probe fail vẫn fallback adapter, và `launchOpenVpnGui()` có thể crash khi path sai. Codex đã sửa và Reviewer re-check PASS: configured TCP probe giờ authoritative; OpenVPN launch trả fail graceful, không unhandled `error`.
- `TF1`, `TF2`, `TF3`, `TG1` đang tick `[x]` trong plan và có code trong snapshot, nhưng chưa có Reviewer artifact trong luồng Codex này. Treat as implemented/ticked but **UNREVIEWED**; Claude/Codex tiếp theo cần review lại trước khi coi là done.
- `TG1` code được include trong handoff snapshot: `src/main/orchestrator/indexer.js`, `src/renderer/components/IndexerPanel.jsx`, và IPC/preload/RepoList wiring.
- Agent rules đã được cập nhật: khi gần hết quota/context khoảng 99%, phải ghi handoff note trong `plan.md`, nêu rõ đã làm/review đến task nào, rồi commit snapshot nếu user yêu cầu.
- Next recommended: review `TF1 -> TF2 -> TF3 -> TG1`; sau đó tiếp `TG2` nếu cần REST-only, rồi `TH1/TH2`, `TI1`, `TJ1`.

---

## 8. Phase K — Portability (cấu hình workspace roots) + Cross-platform (Win/Linux/Mac)

> **Scope MỚI — planned 2026-06-30 (Claude Leader). CHƯA code.** Mở rộng launcher đã code-complete. **Stack không đổi** (Electron + Vite/React + Node orchestrator). 2 mục tiêu:
> 1. **Portability:** cho user **cấu hình vị trí 2 workspace gốc** (`sp-local-workspace`, `new-frontend`) thay vì hardcode `C:\Users\TrungPhung\...` → đem dự án sang máy khác vẫn start dev local được.
> 2. **Cross-platform:** chạy được trên **Windows, Linux, macOS** (hiện code dính nhiều chỗ Windows-only).

### Bối cảnh kỹ thuật — điểm Windows-only/hardcode cần sửa (đã đọc code thật)
- `repos.js`: `WORKSPACES` hardcode 2 abs path Windows; mọi repo path = `path.join(SP/NF, …)` → cần **config-driven**.
- `runner.js`: `killTree` dùng `taskkill /T /F` (win); spawn `shell:true` **không** `detached` → POSIX không group-kill được.
- `vpn.js`: `DEFAULT_OPENVPN_GUI` path Windows; `detectAdapter` qua `Get-NetAdapter`; `isOpenVpnGuiRunning` qua `tasklist`. (probe TCP đã cross-OS — giữ làm chính.)
- `deps.js`: `commandFor` thêm `.cmd` khi win32. `indexer.js`: `openTestFiles` dùng `cmd /c start`.
- ✅ Đã cross-platform sẵn: `path.join`, Electron `Notification`, `net` TCP probe, `store.js` (userData qua `app.getPath`).

### Thiết kế
- **Workspace roots config:** thêm `workspaceRoots {spLocalWorkspace, newFrontend}` vào `store.js` (userData). `repos.js` đổi const tĩnh → **resolver** (đọc roots: config → fallback default cũ để back-compat → tính path). First-run: roots chưa set/không hợp lệ → onboarding bắt chọn folder (Electron `dialog.showOpenDialog`) + validate marker.
- **Platform layer:** thêm `src/main/orchestrator/platform.js` gom OS-specifics (`isWin/isMac/isLinux`, `pmCommand`, `openPath`, `killTree`); các module gọi nó thay vì tự check.
- Giữ nguyên: orchestrator UI-agnostic, không log secret, idempotent + backup, verify an toàn (synthetic/copy/mock-platform, KHÔNG launch thật).

### Tasks
- [x] **TK1: `repos.js` đọc workspace roots từ config (resolver), bỏ hardcode**
  - Acceptance: roots lấy từ store/inject → `getRepo(id)` tính `path/installCwd/runCwd` từ roots hiện hành; chưa cấu hình → fallback default cũ (back-compat). API `getRepo`/`repos` giữ tương thích.
  - Verify: unit (node) — set roots tùy ý → `getRepo('selfpointrest').path == <sp>/servers/selfpointrest`, `getRepo('stor-web').installCwd == <nf>`; default → path hiện tại. `build:renderer` pass.
  - Files: `src/main/orchestrator/repos.js` (+ `store.js`). · Deps: —
- [x] **TK2: `store.js` workspaceRoots + IPC folder-picker + validate**
  - Acceptance: schema thêm `workspaceRoots`; IPC `workspace:getRoots/setRoots/pickFolder` (Electron `dialog.showOpenDialog`); `validateRoot(kind,dir)` kiểm marker (sp ↔ `servers/selfpointrest`+`public`; nf ↔ `apps/stor-web`+`nx.json`/`pnpm-lock.yaml`); persist qua restart.
  - Verify: synthetic — temp dir có/không marker → validateRoot đúng; setRoots→getRoots round-trip (file tạm).
  - Files: `store.js`, `ipc.js`, `preload.js`. · Deps: TK1
- [ ] **TK3: WorkspaceSettings UI + first-run gating**
  - Acceptance: panel hiện 2 root + trạng thái (valid/invalid/missing) + "Change…" (picker); roots chưa hợp lệ → onboarding + **chặn** Start/Build/Install tới khi set; đổi root → RepoList/StatusTable refresh theo root mới.
  - Verify: `build:renderer` pass; logic config rỗng→onboarding, set valid→9 repo theo root mới, invalid→blocked+message.
  - Files: `src/renderer/components/WorkspaceSettings.jsx`, `App.jsx`/`RepoList.jsx`, `preload.js`. · Deps: TK2
- [x] **TK4: `platform.js` (OS util) + wire deps/indexer**
  - Acceptance: export `isWin/isMac/isLinux`, `pmCommand(pm)` (`.cmd` chỉ win), `openPath(p)` (`start ""`/`open`/`xdg-open`). `deps.commandFor` + `indexer.openTestFiles` gọi platform.js. Windows behavior **không đổi**.
  - Verify: unit mock `process.platform`=win32/darwin/linux → assert command shape (`pnpm.cmd` vs `pnpm`; `start`/`open`/`xdg-open`). `node --check`.
  - Files: `src/main/orchestrator/platform.js` (mới), `deps.js`, `indexer.js`. · Deps: —
- [ ] **TK5: `runner.js` tree-kill cross-platform**
  - Acceptance: Windows giữ `taskkill /T /F /PID` (regression-safe); POSIX spawn long-running `detached:true` (process group) + stop kill cả group (`process.kill(-pid,'SIGTERM')` → timeout → `SIGKILL`); không orphan.
  - Verify: synthetic trên Windows (test tree-kill cũ vẫn PASS, port freed); logic POSIX review (+ test nếu có máy POSIX) — ghi rõ phần POSIX chưa chạy thật ở đây.
  - Files: `runner.js`, `platform.js`. · Deps: TK4
- [ ] **TK6: `vpn.js` cross-platform + client config**
  - Acceptance: TCP probe (đã cross-OS) là detection **chính**; adapter-fallback theo OS (win `Get-NetAdapter`; mac `scutil`/`ifconfig`; linux `ip addr`/`nmcli`) — lỗi → connected:false, không throw; **launch VPN client theo OS + cấu hình được** (`vpn.clientPath`/`clientArgs`; default win `openvpn-gui.exe`, mac `open -a Tunnelblick`, linux gợi ý `nmcli`/`openvpn3`).
  - Verify: unit — probe synthetic; mock platform → assert lệnh launch + adapter-cmd theo OS; config-driven path; `node --check`. KHÔNG launch client thật.
  - Files: `vpn.js`, `store.js` (vpn.clientPath), `ipc.js`/`VpnStatus.jsx`. · Deps: TK4 (+TK2 cho config)
- [ ] **TK7: Docs + cross-platform packaging**
  - Acceptance: `ai/CONTEXT.md` (§2 path nay **configurable** + onboarding; §10 process/VPN per-OS, bỏ giả định "chỉ Windows"); `LAUNCHER.md` (onboarding chọn roots; prerequisites theo OS: VPN client mỗi OS, corepack); ghi cách đóng gói `electron-builder --win|--mac|--linux`.
  - Verify: đọc lại docs khớp code TK1–TK6; markdown hợp lệ.
  - Files: `ai/CONTEXT.md`, `LAUNCHER.md`, `README.md`. · Deps: TK1–TK6

### Definition of Done (Phase K)
- [ ] Đổi 2 workspace root qua UI → launcher quản lý repo ở vị trí mới; restart app giữ root đã chọn.
- [ ] First-run (config rỗng) → onboarding bắt chọn root hợp lệ trước khi run.
- [ ] Không còn hardcode abs path Windows là nguồn **duy nhất** (repos roots + vpn client path đều configurable/có default theo OS).
- [ ] OS-specifics gom trong `platform.js`; deps/indexer/runner/vpn dùng nó; **Windows không regression** (synthetic test cũ vẫn PASS).
- [ ] Docs phản ánh portability + cross-platform.
- [ ] `[~]` Nghiệm thu end-to-end trên Linux/Mac thật (ngoài phạm vi auto-verify trên Windows).

### Giả định & Rủi ro (Phase K)
| Rủi ro | Giảm thiểu |
|---|---|
| Không có máy Linux/Mac để test thật ở môi trường này | verify bằng **mock `process.platform`** + logic review; đánh `[~]`; giữ Windows regression-safe |
| Đổi repos.js config-driven phá module gọi getRepo | giữ API `getRepo`/`repos` tương thích; fallback default = path hiện tại |
| POSIX group-kill sót process | bắt buộc `detached:true` + kill `-pgid`; test trên POSIX khi có máy |
| VPN client mỗi OS khác nhau | probe TCP là tín hiệu chính (cross-OS); client launch để **config** + default theo OS |
| Onboarding trỏ nhầm folder | `validateRoot` theo marker + lỗi rõ; chặn run tới khi hợp lệ |

### Thứ tự thực thi (Phase K)
1. **TK1** (repos config-driven) + **TK4** (platform.js) — 2 nền tảng độc lập, làm trước.
2. **TK2 → TK3** (portability: store/picker → onboarding + gating).
3. **TK5** (runner kill) + **TK6** (vpn) — cross-platform behaviors.
4. **TK7** (docs + packaging).

**3 task nên làm trước:** `TK1`, `TK4`, `TK2`.
