# Plan — Local Dev Launcher

> Sinh bởi Leader. Nguồn ngữ cảnh: `ai/CONTEXT.md` + README/`package.json` **thực tế** đã verify (selfpointrest, loyalty, token-service, indexer, public/{backend,frontend,mobile,collection}, new-frontend/apps/stor-web/project.json, new-frontend/package.json).
> Ngày tạo: 2026-06-29 · Tác giả: Leader (AI)

> ## 🤝 HANDOFF — Claude đã làm đến **TG1** (cập nhật 2026-06-30)
> Phiên Codex trước hết token; Claude tiếp tục theo cùng pipeline Leader→Coder→Reviewer.
> - **Đã xong + verify PASS + commit & push lên `main` (11/16):** TA1, TA2, TB1, TB2, TC1, TD1, TE1, TF1, TF2, TF3, TG1.
>   - Mỗi commit có hậu tố `(reviewed PASS)` = đã qua Reviewer agent **hoặc** Leader focused re-verify (kèm output) → đáng tin để build tiếp.
>   - Mốc lưu ý: TF1 đã fix BLOCKER **build-only guard** (backend/frontend không start ở engine level). **token-service nghe 4001** qua `.env` (không trùng loyalty 4000) — đã sửa registry + CONTEXT §3/§8/§12.
> - **Chưa làm:** TH1 (log stream + status table), TH2 (stop/stop-all tree-kill + free port), TI1 (persist config — `store.js`), TJ1 (đóng gói + README). TG2 (REST-only toggle) = **optional**.
> - **Quy ước tin cậy (CLAUDE.md §7):** chỉ tin checkbox `[x]` khi commit tương ứng có `(reviewed PASS)`; nếu chỉ tick mà thiếu bằng chứng → cần review lại.
> - **Ràng buộc verify an toàn đã áp dụng (giữ nguyên cho Codex):** KHÔNG launch server/VPN/GUI thật (cần VPN/DB) → runner/ports/vpn verify bằng **synthetic process + static `describeRun`**; indexer patch verify trên **BẢN COPY** (file `repositories/*` thật nguyên vẹn).
> - **Next đề xuất:** TH1 → TH2 (cùng chạm `runner.js` → làm tuần tự tránh xung đột) → TI1 → TJ1. Đọc CONTEXT §10–§12 trước khi code.

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
- [ ] **TG2: (tùy chọn) Tự động hóa REST-only — comment `queue.subscribe()`**
  - Acceptance: cờ "REST-only" → patch idempotent comment/bỏ comment `queue.subscribe()` trong `server.js` (có backup).
  - Verify: bật cờ → dòng bị comment; tắt → khôi phục.
  - Files: `src/main/orchestrator/indexer.js`.
  - Deps: TG1

### Phase H — Stop & Status & Logs (F9, F11)
- [x] **TH1: Log streaming + bảng trạng thái**
  - Acceptance: mỗi repo có panel log (stream stdout/stderr realtime); bảng trạng thái hiển thị state + port + branch hiện tại; cập nhật khi process crash.
  - Verify: start 1 repo → log chảy realtime; kill process ngoài app → state chuyển `crashed`.
  - Files: `src/renderer/components/LogPane.jsx`, `StatusTable.jsx`, `src/main/orchestrator/runner.js`.
  - Deps: TF1
- [ ] **TH2: Stop từng repo + Stop all (kill cây process, giải phóng port)**
  - Acceptance: Stop 1 repo và **Stop all** kill **toàn bộ cây process con** (`taskkill /T /F`); sau stop, port được giải phóng (kiểm chứng); không còn node/gulp/next mồ côi.
  - Verify: start vài repo → Stop all → `netstat` không còn các port (3000/3002/4000/...); Task Manager không còn node con của app.
  - Files: `src/main/orchestrator/runner.js`, `ports.js`.
  - Deps: TF1

### Phase I — Persist config (F12)
- [ ] **TI1: Lưu & khôi phục lựa chọn**
  - Acceptance: lưu repo đã chọn, branch, env (prod/test), port override, VPN probe host vào config; mở lại app → khôi phục đúng.
  - Verify: chọn cấu hình → tắt mở app → cấu hình còn nguyên.
  - Files: `src/main/orchestrator/store.js`, `ipc.js`.
  - Deps: TA2

### Phase J — Đóng gói & tài liệu
- [ ] **TJ1: Script chạy/đóng gói + README**
  - Acceptance: `npm start` (dev) hoạt động; (tùy chọn) `npm run package` ra app Windows; README hướng dẫn từ máy sạch (yêu cầu Node 20.x, corepack, OpenVPN GUI, lấy `.ovpn` từ team).
  - Verify: làm theo README trên mô tả → chạy được app.
  - Files: `package.json`, `README.md` (của launcher), (tùy chọn) `electron-builder` config.
  - Deps: TH2, TI1

## 4. Definition of Done

- [ ] Tất cả F1–F12 (CONTEXT §11) đạt.
- [ ] Khởi động được selfpointrest (3000) + ≥1 UI (vd stor-web 3002 hoặc `/backend`) từ launcher.
- [ ] Stop all dừng sạch, không process/port treo.
- [ ] Restart indexer hoạt động sau khi sửa code.
- [ ] Không log secret; không sửa ngoài phạm vi `repositories/*` ngoài `.env` + indexer (idempotent + backup).
- [ ] README chạy được từ máy sạch.

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

## 6. Thứ tự thực thi đề xuất

1. **TA1 → TA2** (scaffold + repo registry + IPC) — nền tảng, mọi thứ phụ thuộc.
2. **TH1 (log)** sớm một phần để debug, hoặc làm tối thiểu rồi quay lại — *khuyến nghị*: làm `runner.js` cơ bản trong TF nhưng tách log sau.
3. **TB1 → TB2** (git/branch).
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
