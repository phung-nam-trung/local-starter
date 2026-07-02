# Plan — Local Dev Launcher

> Sinh bởi Leader. Nguồn ngữ cảnh: `ai/CONTEXT.md` + README/`package.json` **thực tế** đã verify (selfpointrest, loyalty, token-service, indexer, public/{backend,frontend,mobile,collection}, new-frontend/apps/stor-web/project.json, new-frontend/package.json).
> Ngày tạo: 2026-06-29 · Tác giả: Leader (AI)

> ## 🤝 HANDOFF — Phase M reviewed **PASS** + committed (2026-07-02)
> - **Phase M (TM1-TM4) do Codex implement — Reviewer agent + Claude Leader đều PASS, đã commit.** VPN giờ **adapter-only**: gỡ hẳn TCP-probe/`probeHost`/`probePort`; `isVpnConnected` luôn `detectAdapter`; `probe` không còn export. `VpnStatus` bỏ ô Probe host/Port; **Connect** mở OpenVPN client cho user tự authen + poll adapter. `store` back-compat: config cũ có probe fields load không crash, bị strip qua `mergeConfig`.
> - **Bằng chứng (2 review độc lập):** mock `_execFile` win/mac/linux (Up→true, Disconnected/vắng→false); config cũ `probeHost` → `method:'adapter'` KHÔNG probe; store round-trip strip probe; `probeHost|probePort` sạch khỏi ipc/store/VpnStatus; `node --check` + `build:renderer` PASS; `repositories/*` nguyên vẹn.
> - **NIT:** `preload.js:95` comment cũ nhắc "VPN probe host" (ngoài scope Phase M) → Coder dọn ở commit riêng. `[~]` nghiệm thu thật (authen → badge Connected trên máy user, tinh chỉnh regex tên adapter nếu cần) vẫn cần môi trường thật.

> ## 🤝 HANDOFF — Claude Leader → **Codex làm Phase M (VPN adapter-only)** (2026-07-02)
> - **Yêu cầu user (nghiệm thu):** OpenVPN đã trỏ **profile** sẵn → chỉ cần **mở app OpenVPN cho user tự authen** + launcher **chỉ check đã connect hay chưa** (KHÔNG probe DB/ES, KHÔNG bắt nhập host:port). User chọn **"chỉ commit plan để Codex làm"**.
> - **Kế hoạch ở §10 (Phase M):** `TM1` (`vpn.js`: `isVpnConnected` chỉ dùng `detectAdapter`, bỏ nhánh probe + hàm/export `probe`) → `TM2` ∥ `TM3` (`VpnStatus.jsx` bỏ ô Probe host/Port, **Connect**=mở app OpenVPN + poll adapter; `ipc.js`/`store.js` gỡ `probeHost/probePort`, back-compat config cũ) → `TM4` (docs CONTEXT §9/F5 + LAUNCHER).
> - **Giả định chốt:** "đã connect" = **adapter VPN Up** (`detectAdapter` per-OS ĐÃ có sẵn: win `Get-NetAdapter` / mac `ifconfig` / linux `ip -o link`). Rủi ro false positive/negative do tên adapter → tinh chỉnh regex ở nghiệm thu thật `[~]`.
> - **Ràng buộc verify an toàn:** KHÔNG mở VPN client thật, KHÔNG probe thật → mock `_execFile`/`platform` cho win/mac/linux + `node --check` + `npm run build:renderer`. Không đụng `repositories/*`.
> - Claude Leader chỉ lập plan (chưa code); **Codex thực thi TM1→TM4** rồi để Claude/Reviewer verify.

> ## 🤝 HANDOFF — Claude review **Phase L PASS** + commit (2026-07-02)
> - **Phase L (TL1/TL2/TL3) do Codex implement — Claude Leader review PASS + commit.** Bug nghiệm thu (build-UI chạy sai cwd `servers/selfpointrest`) đã được fix.
>   - **TL1 PASS (bằng chứng `describeRun`):** `build-backend`/`build-kikar`/`build-prutah` chạy tại **ROOT `sp-local-workspace`**; `buildAll` + `npm start` vẫn tại `servers/selfpointrest`. cwd bám workspace root cấu hình (test custom root `D:\...` → cwd đổi theo, KHÔNG hardcode).
>   - **TL2 PASS:** `deps.js` thêm install target ảo `sp-local-workspace-root` (`getSpWorkspaceRootTarget`/`getDependencyTarget`) để check/install root `node_modules` cho `node builder`.
>   - **TL3 PASS:** CONTEXT §3/§6/§12 + LAUNCHER đã sửa build-UI = ROOT (bỏ text "cwd selfpointrest"); `build-local` @ `public/backend` là alt thủ công.
>   - Verify an toàn: `node --check` runner/repos/deps PASS; managed repo `sp-local-workspace` porcelain SẠCH (không đụng). KHÔNG build/run thật.
> - **TH3 PASS (Claude Leader re-verify 2026-07-02):** `StatusTable.jsx` là file code DUY NHẤT của `dc75bf6` (còn lại là docs). `onStop`→`window.launcher.runner.stop(repoId)`, `onRestart`→`window.launcher.runner.restart(repoId,{})`; nút **Restart** riêng cho `stor-web` (`repo.id==='stor-web'`), per-row busy state (`stopping`/`restarting`). **Tái dùng engine `runner`** (tree-kill cross-OS TK5 đã PASS) → không reinvent kill; port 3002 giải phóng theo engine. `npm run build:renderer` PASS. Click-test thật (app đang chạy) thuộc mục `[~]`.
> - **Next:** nghiệm thu thật các mục `[~]` (VPN + DB/ES nội bộ; start/stop/restart `stor-web` port 3002 khi app chạy; Linux/macOS end-to-end). Không còn task plan/code nào pending.

> ## 🤝 HANDOFF — Codex đã hoàn thành TK7 + TH3 (2026-07-01)
> - **Codex đã hoàn thành:** TK7 docs/cross-platform packaging và TH3 quick **Stop/Restart** cho `stor-web` (`new-frontend`) trong bảng Status.
> - **Files touched:** `LAUNCHER.md`, `README.md`, `ai/CONTEXT.md`, `plan.md`, `src/renderer/components/StatusTable.jsx`.
> - **Verification đã chạy:** `git fetch` PASS; `npm.cmd run build:renderer` PASS; `git diff --check` PASS; static scan `TH3|stor-web|onRestart|restarting` PASS.
> - **Chưa nghiệm thu thật:** start/stop/restart `stor-web` trên port 3002; selfpointrest + UI với VPN/DB/ES nội bộ; Linux/macOS end-to-end cho VPN client/opener/group-kill.
> - **Commit/push status:** local commit đã tạo; push lên `origin/main` bị policy reviewer chặn vì remote ngoài chưa xác minh/rủi ro xuất nội dung workspace. Không thử đường vòng; cần user tự push hoặc phê duyệt lại theo chính sách nếu môi trường cho phép.
> - **Next steps cho agent kế tiếp:** pull latest `main`, đọc note này + `git status --short --branch`, rồi ưu tiên nghiệm thu thật các mục `[~]`/Phase K DoD còn lại trước khi mở task mới.

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

> ## 🤝 HANDOFF — Claude Phase K → **Codex làm TK7** (2026-06-30)
> - **Claude đã hoàn thành + review PASS + commit & push:** TB3, TK1, TK2, TK4 (`aa3734c`), TK3 (`20d0214`), TK5 (`be4829d`), **TK6** (commit này). Phase K chỉ còn **DUY NHẤT TK7**.
>   - TK6: `vpn.js` cross-platform — probe TCP là detection chính; `detectAdapter` per-OS (win `Get-NetAdapter` / mac `ifconfig` / linux `ip -o link`); `launchVpnClient` per-OS + `clientPath`/`clientArgs` config (win `openvpn-gui.exe` · mac `open -a Tunnelblick` · linux **cần** clientPath, không đoán) + wiring `store`/`ipc`/`VpnStatus`. Claude verify độc lập PASS (mock per-OS, **KHÔNG launch client thật**; probe synthetic; store round-trip; build). Lưu ý: coder quên export `launchVpnClient` → đã thêm export (1 dòng); `VpnStatus` migrate `exePath` cũ → `clientPath`.
> - **BÀN GIAO CHO CODEX — TK7** (Docs + đóng gói cross-OS; xem §8 TK7). Deps TK1–TK6 đã xong hết. Việc cần làm:
>   1. `ai/CONTEXT.md`: §2 — workspace roots nay **configurable** (onboarding folder-picker `workspace:pickFolder`, `store.validateRoot`, fallback default cũ); §10 — mô tả **per-OS**, bỏ giả định "chỉ Windows": tree-kill (win `taskkill /T /F`; POSIX detached + group `SIGTERM→SIGKILL`), pm `.cmd` chỉ win, open file (`start`/`open`/`xdg-open`), VPN client per-OS + `clientPath`/`clientArgs`.
>   2. `LAUNCHER.md`: mô tả workspace roots configurable với fallback default và onboarding khi root invalid; prerequisites theo OS (VPN client: win OpenVPN GUI · mac Tunnelblick · linux `nmcli`/`openvpn3`; `corepack enable` cho pnpm); cách đóng gói `electron-builder --win|--mac|--linux`.
>   3. `README.md` nếu cần.
> - **Cách làm (Codex):** dùng `.codex/agents` (launcher-coder → launcher-reviewer) cho TK7; verify docs khớp code TK1–TK6 (markdown hợp lệ, không lệch tên hàm/field); tick `[x] TK7` §8; commit message có `(reviewed PASS)`.
> - **`[~]` chưa nghiệm thu thật trên Linux/Mac:** toàn bộ Phase K verify per-OS bằng **mock `process.platform`** trên máy Windows; cần máy Linux/Mac để nghiệm thu end-to-end (kill group, VPN client, open file).

> ## 🤝 HANDOFF — Claude Leader → **Codex làm Phase L (FIX build-UI cwd)** (2026-06-30)
> - Nghiệm thu phát hiện **BUG**: launcher chạy `npm run build-backend` tại `servers/selfpointrest` → **SAI**. Verify `package.json` thật: `build-backend`/`build-kikar`/`build-prutah`/`build-mobile`/`build-collection` **chỉ có ở ROOT `sp-local-workspace/package.json`** (`node builder <client> build [-t <tmpl>]`); `public/backend` có `build-local`. → build-UI phải chạy tại **ROOT `sp-local-workspace`**, KHÔNG phải selfpointrest.
> - **Kế hoạch fix ở §9 (Phase L):** `TL1` (sửa cwd build-UI → ROOT trong `runner.js`+`repos.js`; buildAll+npm start vẫn ở selfpointrest) → `TL2` (root install prereq cho `node builder`) → `TL3` (cập nhật CONTEXT §3.2/§6/§12 + repos + LAUNCHER; tùy chọn `build-local`).
> - **BÀN GIAO CHO CODEX:** làm `TL1`→`TL2`→`TL3` qua `.codex/agents` (Coder→Reviewer). Ưu tiên **TL1**. Verify tĩnh (`describeRun` khẳng định cwd đúng) + `build:renderer`; **KHÔNG build UI thật** (cần root+public đã install). ⚠️ TF1 cũ + CONTEXT §3.2/§6 đang **ghi sai** cwd (selfpointrest) — TL1/TL3 phải sửa.
> - Claude Leader chỉ lập plan Phase L (chưa code) theo yêu cầu user; Codex thực thi.

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
- **VPN layer** (`vpn.js`): detect adapter VPN `Up` theo OS; mở VPN client; poll adapter + timeout.
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
  - Acceptance: chạy được theo thứ tự install(nếu thiếu)→`npm run buildAll`→`npm start` (port 3000); nếu user chọn xem UI Back Office/Frontend thì chạy root builder scripts ở ROOT `sp-local-workspace`: `npm run build-backend`, `npm run build-kikar`, `npm run build-prutah` **trước** khi start selfpointrest; mở được `http://localhost:3000`, `/backend`, `/kikar`, `/prutah`.
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
- [x] **TH3: Quick Stop/Restart cho `stor-web` (`new-frontend`)**
  - Acceptance: Bảng Status có nút **Stop** và **Restart** rõ ràng trên hàng `stor-web`; Stop dùng `runner.stop('stor-web')`, Restart dùng `runner.restart('stor-web', {})`; không hardcode command/spawn trực tiếp, vẫn chạy theo registry `pnpm nx serve stor-web` ở root `new-frontend` và port 3002. Busy state theo hàng tránh click đôi; các repo khác giữ hành vi Stop cũ.
  - Verify: `npm.cmd run build:renderer` PASS; static scan thấy `StatusTable.jsx` có `onRestart`/`restarting` và task TH3 trong `plan.md`. Nghiệm thu thật: start `stor-web` → Stop giải phóng 3002 → Restart đổi process và load lại 3002.
  - Files: `src/renderer/components/StatusTable.jsx`, `plan.md`.
  - Deps: TH2

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
- [x] `stor-web` (`new-frontend`) có quick **Stop** và **Restart** ngay trong bảng Status — TH3; verify tĩnh/build PASS, nghiệm thu thật bằng port 3002 khi chạy local.
- [x] Restart indexer hoạt động sau khi sửa code — TG1 (reviewed PASS): patch idempotent + backup, restart đổi PID.
- [x] Không log secret; không sửa ngoài phạm vi `repositories/*` ngoài `.env` + indexer (idempotent + backup) — TE1/TG1 (reviewed PASS): backup `.env`/`*.bak-<ts>`, không in nội dung `.env*`.
- [x] README chạy được từ máy sạch — `LAUNCHER.md` (link từ `README.md`): prerequisites (Node 20.x, corepack/pnpm, OpenVPN GUI + `.ovpn`) + `npm install` → `npm start` + F1–F12 + lưu ý port/VPN. *(Khởi động backend trong app vẫn cần VPN/DB như mục `[~]`.)*

## 5. Giả định & Rủi ro

**Điểm lệch đã phát hiện khi verify (đã sửa trong plan; nên cập nhật lại CONTEXT §3):**
- **R1 — Lệnh build frontend (Kikar/Prutah):** CONTEXT §3 cũ ghi `node builder --template=Kikar` chạy trong `public/frontend` — **không tồn tại** script này. Thực tế Phase L: build template bằng root `sp-local-workspace` scripts `npm run build-kikar` / `npm run build-prutah` (= `node builder frontend build -t kikar|prutah`). Coder PHẢI verify lại đầu ra build (đường dẫn `build/`) trước khi tick TF1.
- **R2 — `node livereload run <Template>` (port 35999):** không có script tương ứng trong `public/frontend/package.json` (chỉ có dep `livereload`). Đây là chế độ dev nâng cao → **để ngoài phạm vi** luồng run cơ bản; ghi chú để xử lý sau nếu cần.
- **R3 — Build UI Back Office:** launcher path chính dùng root `sp-local-workspace` script `npm run build-backend` (ra `servers/selfpointrest/build/backend`); `public/backend` `npm run build-local` chỉ là alternative thủ công. Coder chọn 1 và verify.

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
8. **TH1 → TH2 → TH3** (log + stop all + quick Stop/Restart cho `stor-web`).
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
- **Workspace roots config:** thêm `workspaceRoots {spLocalWorkspace, newFrontend}` vào `store.js` (userData). `repos.js` đổi const tĩnh → **resolver** (đọc roots: config → fallback default cũ để back-compat → tính path). Config rỗng dùng fallback nếu valid; nếu fallback/root đã lưu không hợp lệ → onboarding bắt chọn folder (Electron `dialog.showOpenDialog`) + validate marker.
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
- [x] **TK3: WorkspaceSettings UI + first-run gating**
  - Acceptance: panel hiện 2 root + trạng thái (valid/invalid/missing) + "Change…" (picker); roots chưa hợp lệ → onboarding + **chặn** Start/Build/Install tới khi set; đổi root → RepoList/StatusTable refresh theo root mới.
  - Verify: `build:renderer` pass; logic config rỗng→fallback nếu valid, set valid→9 repo theo root mới, invalid→onboarding blocked+message.
  - Files: `src/renderer/components/WorkspaceSettings.jsx`, `App.jsx`/`RepoList.jsx`, `preload.js`. · Deps: TK2
- [x] **TK4: `platform.js` (OS util) + wire deps/indexer**
  - Acceptance: export `isWin/isMac/isLinux`, `pmCommand(pm)` (`.cmd` chỉ win), `openPath(p)` (`start ""`/`open`/`xdg-open`). `deps.commandFor` + `indexer.openTestFiles` gọi platform.js. Windows behavior **không đổi**.
  - Verify: unit mock `process.platform`=win32/darwin/linux → assert command shape (`pnpm.cmd` vs `pnpm`; `start`/`open`/`xdg-open`). `node --check`.
  - Files: `src/main/orchestrator/platform.js` (mới), `deps.js`, `indexer.js`. · Deps: —
- [x] **TK5: `runner.js` tree-kill cross-platform**
  - Acceptance: Windows giữ `taskkill /T /F /PID` (regression-safe); POSIX spawn long-running `detached:true` (process group) + stop kill cả group (`process.kill(-pid,'SIGTERM')` → timeout → `SIGKILL`); không orphan.
  - Verify: synthetic trên Windows (test tree-kill cũ vẫn PASS, port freed); logic POSIX review (+ test nếu có máy POSIX) — ghi rõ phần POSIX chưa chạy thật ở đây.
  - Files: `runner.js`, `platform.js`. · Deps: TK4
  - **DONE (Coder, 2026-06-30):** `platform.killTree(pid, options)` thêm vào `platform.js` (win `taskkill /PID x /T /F`, 128→ok; POSIX `kill(-pid,'SIGTERM')`→grace→`SIGKILL`, ESRCH→ok; mock hooks `platform/execFileImpl/killImpl/posixTermWaitMs`). `runner.js`: `spawnStep` thêm `detached:true` **chỉ POSIX** (gate `!isWin`), win không đổi (shell+windowsHide, KHÔNG detached); `killTree` nội bộ delegate sang `platform.killTree`. Verify: `node --check` cả 2 file PASS; killTree unit mock per-OS PASS (win argv `/PID x /T /F`, POSIX SIGTERM→SIGKILL trên `-pid`, ESRCH ok); spawn-opts gating PASS (win KHÔNG detached; forced linux/darwin có detached); Windows synthetic tree-kill regression (real taskkill, stop()+stopAll()) PASS — 0 orphan (parent+child gone), state 'stopped', port freed. **`[~]` POSIX group-kill thật chưa nghiệm thu (không có máy Linux/Mac ở đây) — verify qua mock + logic review; cần Linux/Mac để nghiệm thu end-to-end.**
- [x] **TK6: `vpn.js` cross-platform + client config**
  - Acceptance: TCP probe (đã cross-OS) là detection **chính**; adapter-fallback theo OS (win `Get-NetAdapter`; mac `scutil`/`ifconfig`; linux `ip addr`/`nmcli`) — lỗi → connected:false, không throw; **launch VPN client theo OS + cấu hình được** (`vpn.clientPath`/`clientArgs`; default win `openvpn-gui.exe`, mac `open -a Tunnelblick`, linux gợi ý `nmcli`/`openvpn3`).
  - Verify: unit — probe synthetic; mock platform → assert lệnh launch + adapter-cmd theo OS; config-driven path; `node --check`. KHÔNG launch client thật.
  - Files: `vpn.js`, `store.js` (vpn.clientPath), `ipc.js`/`VpnStatus.jsx`. · Deps: TK4 (+TK2 cho config)
  - **DONE (Coder wiring, 2026-07-01):** vpn.js core (per-OS `launchVpnClient`/`detectAdapter`/`resolveClientPlan`) đã có từ trước; task này WIRE store/ipc/UI + verify (KHÔNG rewrite core). `store.DEFAULT_CONFIG.vpn` thêm `clientPath:''`/`clientArgs:[]` (giữ `exePath` back-compat); `mergeConfig` shallow-merge vpn giữ mảng clientArgs OK. `ipc.vpn:connect` đổi sang `vpn.launchVpnClient({clientPath,clientArgs,exePath})` + `isOpenVpnGuiRunning({clientPath: clientPath||exePath})`, KHÔNG forward field test-only (platform/spawnImpl), giữ probe TCP + Notification + poll. `VpnStatus.jsx`: input "VPN client path/command" + "VPN client args" (persist qua config, migrate exePath cũ→clientPath). **Bug đã sửa (1 dòng wiring):** `launchVpnClient` trước đó KHÔNG nằm trong `module.exports` của vpn.js → thêm vào export (ipc cần API này; đúng như doc-comment vpn.js). Verify (Windows): `node --check` 4 file PASS; unit 15 checks (probe synthetic occupied→true/closed→false; launch mock win `openvpn-gui.exe`+args, mac `open -a Tunnelblick`, linux no-config→`no-client-configured` KHÔNG spawn, linux/mac override, exePath alias; store round-trip clientPath/clientArgs mảng nguyên vẹn + back-compat merge) PASS; ipc wiring smoke (forward clientPath/clientArgs/exePath, drop test-only, `launchOpenVpnGui` KHÔNG bị gọi) PASS; adapter per-OS mock (win powershell Get-NetAdapter / mac ifconfig / linux `ip -o link show`, error→connected:false) PASS; `npm run build:renderer` PASS; `isOpenVpnGuiRunning` real Windows read-only=boolean (openvpn-gui.exe đang chạy sẵn của user, PID 26616 KHÔNG đổi trước/sau test → xác nhận KHÔNG launch thật); real `sp-local-workspace` clean. `[~]` chưa nghiệm thu launch/adapter thật trên Linux/Mac (không có máy ở đây) — verify qua mock platform.
- [x] **TK7: Docs + cross-platform packaging**
  - Acceptance: `ai/CONTEXT.md` (§2 path nay **configurable** + fallback/onboarding khi invalid; §10 process/VPN per-OS, bỏ giả định "chỉ Windows"); `LAUNCHER.md` (workspace roots configurable, prerequisites theo OS: VPN client mỗi OS, corepack); ghi cách đóng gói `electron-builder --win|--mac|--linux`.
  - Verify: đọc lại docs khớp code TK1–TK6; markdown hợp lệ.
  - Files: `ai/CONTEXT.md`, `LAUNCHER.md`, `README.md`. · Deps: TK1–TK6
  - **DONE (Coder, 2026-07-01):** Cập nhật docs cho workspace roots configurable với fallback default trước khi onboarding block, process + VPN per-OS, package-manager/opener theo OS, packaging `electron-builder --win|--mac|--linux`; verify `git diff --check`, keyword scan, markdown smoke/code alignment; Reviewer TK7 PASS, polish minor/nits applied.

### Definition of Done (Phase K)
- [ ] Đổi 2 workspace root qua UI → launcher quản lý repo ở vị trí mới; restart app giữ root đã chọn.
- [ ] First-run/config rỗng → dùng fallback default nếu valid; nếu fallback/root đã lưu invalid thì onboarding bắt chọn root hợp lệ trước khi run.
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

---

## 9. Phase L — FIX: build UI (backend/frontend) chạy SAI cwd (nghiệm thu 2026-06-30)

> **Bug nghiệm thu thực tế (user):** khi Start selfpointrest kèm build backend, launcher chạy `npm run build-backend` tại `servers/selfpointrest` → **SAI**. Đã verify `package.json` thật:
> - `build-backend` / `build-kikar` / `build-prutah` / `build-mobile` / `build-collection` **chỉ có trong `sp-local-workspace/package.json` (ROOT)** (`node builder <client> build [-t <tmpl>]`) → phải chạy tại **ROOT `sp-local-workspace`**.
> - `public/backend` có `build-local` = `npm run watch -- --build-dir=../../servers/selfpointrest/build/backend` → phương án thay thế, chạy tại `public/backend`.
> - selfpointrest cũng có script `build-backend` nhưng chạy ở đó **không đúng** (per acceptance) → KHÔNG dùng cwd selfpointrest cho build UI.
> **Ảnh hưởng code:** `runner.js buildSteps` + `repos.js` (`backend`/`frontend` `runCwd`) đang trỏ `servers/selfpointrest`. TF1 trước "reviewed PASS" nhưng dựa trên giả định cwd sai (chỉ verify tĩnh `describeRun`, không build thật). **CONTEXT §3.2/§6/§12 cũng ghi sai cwd build UI**.

### Tasks
- [x] **TL1: Sửa cwd build-UI → `sp-local-workspace` ROOT**
  - `runner.js`: các build-UI step của selfpointrest (`npm run build-backend`/`build-kikar`/`build-prutah`) chạy với **cwd = workspace root sp-local-workspace** (`repos.getWorkspaceRoots()['sp-local-workspace']`), tách khỏi runCwd selfpointrest. Step `npm run buildAll` + `npm start` **vẫn** cwd = `servers/selfpointrest` (đúng). Mỗi step nên mang `cwd` riêng.
  - `repos.js`: `backend`/`frontend` — build chạy tại ROOT (thêm field ví dụ `buildCwd` = sp root cho build-only UI, hoặc để runner resolve ROOT cho build-UI); giữ `installCwd` = `public/<repo>` (bower postinstall tại repo UI); `path` giữ nguyên.
  - Acceptance: `describeRun('selfpointrest',{buildUIs:{backend:true,kikar:true,prutah:true}})` → build-backend/kikar/prutah có `cwd == <sp-root>`; buildAll + npm start `cwd == <sp-root>/servers/selfpointrest`.
  - Verify: unit + `describeRun` (khẳng định cwd), `node --check`, `npx vite build`. **KHÔNG build thật** (nặng + cần root install — TL2). Không đụng managed repo.
  - Files: `src/main/orchestrator/runner.js`, `src/main/orchestrator/repos.js`. · Deps: —
  - **DONE (Coder, 2026-07-01):** `repos.js` thêm `buildCwd` cho `backend`/`frontend` = root `sp-local-workspace`; `runner.js` cho mỗi build step dùng `step.cwd` riêng. Verify PASS: `node --check` 2 file, `describeRun('selfpointrest',{buildUIs:{backend:true,kikar:true,prutah:true}})` với root giả lập cho thấy build-backend/kikar/prutah cwd = `<sp-root>`, còn `npm run buildAll`/`npm start` cwd = `<sp-root>/servers/selfpointrest`; `npm.cmd run build:renderer` PASS. Không chạy build UI thật, không chạm managed repo.
- [x] **TL2: Root install prerequisite cho `node builder`**
  - `node builder <client> build` ở ROOT cần deps của `sp-local-workspace/package.json` (gulp, sp-builder-utils…) → ROOT phải `npm install`. Launcher chưa install ROOT. Thêm: coi **sp-local-workspace ROOT** là install target (hoặc precondition trước build-UI): thiếu `<sp-root>/node_modules` → cảnh báo rõ / cho install. Lưu ý build UI còn cần `public/<repo>` đã install (bower) — cảnh báo nếu thiếu.
  - Acceptance: trước build-UI, kiểm tra `<sp-root>/node_modules` (+ `public/<repo>/node_modules`); thiếu → message rõ hoặc install; `deps` install được tại ROOT.
  - Verify: `deps.getDependencyStatus` cho ROOT (missing/current) qua path tạm/mock; KHÔNG install thật; `node --check`.
  - Files: `src/main/orchestrator/deps.js` (+ root entry/precondition ở runner hoặc RunControls). · Deps: TL1
  - **DONE (Coder, 2026-07-01):** `deps.js` thêm dependency target nội bộ `sp-local-workspace-root` (không thêm repo visible) để status/install tại root `sp-local-workspace`; `runner.js` preflight root + `public/backend`/`public/frontend` trước build UI served by selfpointrest và trả `missing-build-ui-deps` kèm cwd `npm install` rõ ràng, không spawn build khi thiếu/stale. Verify PASS: synthetic temp dirs cho missing/current/stale root/public deps + start blocked no-spawn + describeRun prereq/cwd; `node --check` deps/runner; `npm.cmd run build:renderer`; `git diff --check`. Không chạy install/build UI thật, không chạm managed repos.
- [x] **TL3: Cập nhật CONTEXT + repos comment + LAUNCHER (+ doc-only build-local alternative)**
  - `ai/CONTEXT.md` §2 (root cần install cho builder), §3.2 (backend/frontend build **tại ROOT**: `npm run build-backend`/`build-kikar`/`build-prutah`; `build-local` tại `public/backend` là alt), §6, §12; `repos.js` comments; `LAUNCHER.md`.
  - Không implement code fallback; chỉ document `public/backend` `build-local` là alternative thủ công nếu nhắc tới.
  - Acceptance: docs khớp cwd đúng, bỏ giả định build UI chạy với cwd `servers/selfpointrest`.
  - Verify: đọc lại docs khớp TL1/TL2; markdown hợp lệ.
  - Files: `ai/CONTEXT.md`, `src/main/orchestrator/repos.js`, `LAUNCHER.md`. · Deps: TL1, TL2
  - **DONE (Coder, 2026-07-01):** Cập nhật `ai/CONTEXT.md` §2/§3.2/§6/§12 và `LAUNCHER.md` để nêu rõ root `sp-local-workspace` cần `npm install` cho `node builder`, build UI Back Office/Kikar/Prutah chạy tại ROOT, `public/backend` `build-local` chỉ là alternative thủ công, còn selfpointrest `buildAll`/`npm start` vẫn chạy tại `servers/selfpointrest` và serve output. Sửa comment `repos.js` từ selfpointrest builder sang root builder; không thêm code fallback. Verify PASS: static scan cụm stale; markdown readback bằng `rg`; `node --check src/main/orchestrator/repos.js`; `git diff --check`.

### Definition of Done (Phase L)
- [x] Build UI (backend/kikar/prutah) chạy tại **sp-local-workspace ROOT**; `describeRun`/preview hiển thị cwd đúng; `npm run buildAll` + `npm start` vẫn ở selfpointrest.
- [x] Có kiểm tra/install ROOT (+ `public/<repo>`) trước build-UI, thông báo rõ nếu thiếu.
- [x] CONTEXT §3.2/§6/§12 + repos.js + LAUNCHER phản ánh cwd đúng (bỏ giả định cwd selfpointrest).
- [ ] `[~]` Build UI thật (`node builder … build`) cần root+public đã install + môi trường thật — verify tĩnh ở đây; build thật do user nghiệm thu.

### Thứ tự thực thi (Phase L)
1. **TL1** (fix cwd — core, đúng bug user báo) → 2. **TL2** (root install prereq) → 3. **TL3** (docs + doc-only build-local alternative).

**Ưu tiên làm ngay:** `TL1`.

## 10. Phase M — VPN: chỉ check adapter "đã connect" + nút Connect mở OpenVPN app (nghiệm thu 2026-07-02)

> **Yêu cầu user (nghiệm thu):** OpenVPN đã trỏ sẵn **profile** → chỉ cần **mở app OpenVPN cho user tự authen**, và launcher **chỉ cần check đã connect VPN hay chưa**. KHÔNG cần probe DB/ES nội bộ, KHÔNG bắt user nhập host:port.
> **Hiện trạng code:** `vpn.isVpnConnected` ưu tiên **TCP-probe** `probeHost:probePort` (user nhập, vd DB/ES), chỉ **fallback** sang `detectAdapter` khi không có probe; `VpnStatus.jsx` có ô nhập **Probe host + Port**. → Cần **bỏ hẳn nhánh probe**, để **adapter là cách DUY NHẤT**.
> **Tin tốt:** `detectAdapter` (per-OS: win `Get-NetAdapter`, mac `ifconfig`, linux `ip -o link`; match `tap|tun|utun|ppp|wg|wireguard|openvpn|wintun` + Status `Up`) ĐÃ làm đúng việc "adapter VPN đang lên hay không" mà không đụng DB/ES. Chỉ cần nâng thành primary + gỡ probe.
> **Giả định chốt (Leader):** "đã connect" = **có adapter VPN ở trạng thái Up** (OpenVPN authen xong thì adapter TAP/wintun mới `Up`; app mở mà chưa authen → adapter `Disconnected` → vẫn "not connected"). Nếu máy user cho false positive/negative (adapter lạ, tên không khớp regex) → tinh chỉnh filter tên adapter ở bước nghiệm thu thật `[~]`.

### Tasks
- [x] **TM1: `vpn.js` — adapter là cách detect DUY NHẤT (bỏ TCP probe)**
  - `isVpnConnected(config)`: luôn gọi `detectAdapter` (`method:'adapter'`); **bỏ nhánh** `probeHost/probePort` + hàm `probe()` + export `probe` (giờ là dead code). Giữ nguyên `detectAdapter`, `isOpenVpnGuiRunning`, `launchVpnClient`/`launchOpenVpnGui`, `waitForConnection` (giờ poll adapter). Giữ test hook `platform`/`_execFile`.
  - Acceptance: `isVpnConnected({})` trả kết quả từ adapter; không còn code path probe; `require('./vpn').probe === undefined`. Mock `_execFile` win/mac/linux (adapter Up / vắng) → `connected` đúng.
  - Verify: node one-liner mock `_execFile` cho 3 OS (Up→true, vắng→false); `waitForConnection` với `_execFile` giả lập lần đầu chưa Up rồi Up → `ok:true`; `node --check vpn.js`. KHÔNG mở client thật, KHÔNG probe thật.
  - Files: `src/main/orchestrator/vpn.js`. · Deps: —
  - **DONE (Coder TM1, 2026-07-02):** `vpn.js` bỏ `node:net`, hàm/export `probe`, và nhánh `probeHost/probePort`; `isVpnConnected` luôn gọi `detectAdapter` và trả `method:'adapter'`; `waitForConnection` tiếp tục poll qua `isVpnConnected` nên giờ poll adapter-only. Verify PASS: mock `_execFile` win/mac/linux Up→true và vắng→false, kể cả config cũ có `probeHost/probePort` vẫn bị bỏ qua; `waitForConnection` false→true trả `ok:true`; `require('./src/main/orchestrator/vpn').probe === undefined`; `node --check src/main/orchestrator/vpn.js`; `git diff --check`. Không mở VPN client thật, không TCP probe thật, không đụng `repositories/*`.
- [x] **TM2: `VpnStatus.jsx` — bỏ ô Probe host/Port; Connect = mở OpenVPN app + poll adapter**
  - Bỏ input **Probe host** + **Port** và state/persist `probeHost/probePort`. Badge Connected/Disconnected/Connecting/Unknown lấy từ adapter. Giữ **Check** (một phát), **Connect** (mở app OpenVPN + notify + poll tới khi adapter Up / timeout / Skip), **Cancel**, **Skip**. Sửa helper text (bỏ "Không nhập probe host → fallback…"; nêu "check adapter VPN theo OS"). `clientPath/clientArgs` giữ (tùy chọn nâng cao — win mặc định `openvpn-gui.exe`; mac/linux override).
  - Acceptance: UI không còn ô probe host/port; `runConnect` gọi `vpn.connect` (launch + poll); `runCheck` chỉ hiện connected/not; `npm run build:renderer` PASS.
  - Verify: `npm.cmd run build:renderer` PASS; đọc code khẳng định không còn `probeHost/probePort`; badge phản ánh `status.connected`.
  - Files: `src/renderer/components/VpnStatus.jsx`. · Deps: TM1
  - **DONE (Coder TM2, 2026-07-02):** `VpnStatus.jsx` bỏ state/input/persist `probeHost/probePort`; `configFromInputs()` chỉ gửi `clientPath/clientArgs`; UI không còn Probe host/Port và helper text chuyển sang adapter-based per OS. Giữ Check/Connect/Cancel/Skip; Connect vẫn gọi `window.launcher.vpn.connect` để launch VPN client + poll adapter, badge ưu tiên `status.connected` và hiển thị `connecting` khi đang poll. Verify PASS: `npm.cmd run build:renderer`; static scan `rg -n "probeHost|probePort|Probe host|fallback|host:port" src/renderer/components/VpnStatus.jsx` không có match; `git diff --check`. Không mở VPN client thật, không probe thật, không đụng `repositories/*`.
- [x] **TM3: `ipc.js` + `store.js` — gỡ `probeHost/probePort`**
  - `ipc` `vpn:check`/`vpn:connect`: thôi đọc `probeHost/probePort`; chỉ truyền `platform` + client config vào `isVpnConnected`/`waitForConnection`. `store.DEFAULT_CONFIG.vpn`: bỏ `probeHost/probePort` (giữ `exePath/clientPath/clientArgs`). Back-compat: config cũ có `probeHost/probePort` thì bỏ qua, không crash.
  - Acceptance: `node --check ipc.js store.js`; round-trip store không còn `probeHost/probePort`; `vpn:check` chạy không cần probe config.
  - Verify: `node --check`; load store cũ (có probeHost) → không lỗi; mock IPC `vpn:check` → gọi `isVpnConnected` không kèm probe.
  - Files: `src/main/ipc.js`, `src/main/orchestrator/store.js`. · Deps: TM1
  - **DONE (Coder TM3, 2026-07-02):** `ipc.js` thêm allowlist VPN config; `vpn:check`/`vpn:connect` chỉ truyền `platform` cho adapter detect/poll, và chỉ truyền `clientPath/clientArgs/exePath` cho running/launch client. `store.DEFAULT_CONFIG.vpn` bỏ probe fields; load/save config cũ sanitize VPN slice để `probeHost/probePort` không sống sót sau merge/save. Verify PASS: `node --check` ipc/store; synthetic store round-trip config cũ; mock IPC check/connect không forward probe/test-only hooks; static scan source sạch; `git diff --check` PASS.
- [x] **TM4: Docs — CONTEXT §9 + LAUNCHER + header comments**
  - `ai/CONTEXT.md` §9 (VPN) + F5 (§11): detect = **adapter Up per-OS**, KHÔNG probe DB/ES; Connect = mở app OpenVPN, user tự authen, launcher poll adapter. `LAUNCHER.md` mục VPN tương tự (bỏ hướng dẫn nhập probe host:port). Header comment `vpn.js`/`VpnStatus.jsx`.
  - Acceptance: docs nói adapter-based; không còn hướng dẫn probe host:port; F5 cập nhật.
  - Verify: đọc lại docs khớp TM1-TM3; markdown hợp lệ.
  - Files: `ai/CONTEXT.md`, `LAUNCHER.md`, `src/main/orchestrator/vpn.js`, `src/renderer/components/VpnStatus.jsx`. · Deps: TM1-TM3
  - **DONE (Coder TM4, 2026-07-02; dòng evidence bổ sung sau review):** `ai/CONTEXT.md` §9/§10.5/F5 + `LAUNCHER.md` (mục VPN, F5, troubleshooting) chuyển sang detect = adapter `Up` per-OS (win `Get-NetAdapter` / mac `ifconfig` / linux `ip -o link`), bỏ hướng dẫn nhập probe host:port; Connect = mở VPN client theo OS cho user tự authen + poll adapter; header comment `vpn.js`/`VpnStatus.jsx`/`store.js` cập nhật. Verify PASS (Reviewer agent + Leader đối chiếu diff CONTEXT/LAUNCHER trực tiếp): docs khớp TM1-TM3, không còn cụm probe host:port; markdown hợp lệ.

### Definition of Done (Phase M)
- [x] Detect VPN chỉ dựa **adapter Up** per-OS; không còn TCP-probe / ô nhập host:port; `probe` không còn là code path.
- [x] Nút **Connect** mở app OpenVPN (win `openvpn-gui.exe` mặc định) để user tự authen; poll adapter tới khi Up.
- [x] `build:renderer` + `node --check` PASS; config cũ (`probeHost/probePort`) không gây lỗi.
- [x] Docs (CONTEXT §9/F5 + LAUNCHER) phản ánh adapter-based, bỏ probe DB/ES.
- [ ] `[~]` Nghiệm thu thật: mở OpenVPN → authen → badge chuyển **Connected** trên máy user (tinh chỉnh filter tên adapter nếu cần).

### Thứ tự thực thi (Phase M)
1. **TM1** (vpn.js adapter-only — core) → 2. **TM2** ∥ **TM3** (renderer & ipc/store, độc lập, sau TM1) → 3. **TM4** (docs).

**Ưu tiên làm ngay:** `TM1`.

## 11. Phase N — FIX: RepoList hiển thị branch mặc định thay vì branch git thực tế (nghiệm thu 2026-07-02)

> **Bug nghiệm thu (user, kèm ảnh):** Danh sách repo (RepoList, cột trái) hiện **"branch master"** cho MỌI repo `sp-local-workspace` — đó là `repo.defaultBranch` (giá trị **tĩnh** trong registry), KHÔNG phải branch git hiện tại. Bằng chứng: panel Branch bên phải cho `backend` ghi **Current: `new-frontend`**; StatusTable trên cùng cũng hiện branch THẬT (vd `development`, `new-frontend-dev-prod`). Chỉ RepoList sai.
> **Nguyên nhân:** [`RepoList.jsx:173`](src/renderer/components/RepoList.jsx) render `{repo.defaultBranch}`.
> **Có sẵn để tái dùng:** `window.launcher.git.currentBranch(repoId)` (ipc `git:currentBranch`). `StatusTable.jsx` đã có pattern chuẩn `branchById` + `refreshBranches(list)` (fetch song song, mỗi repo lỗi → `null`, **KHÔNG poll** vì spawn `git` nặng).
> **Phạm vi (user 2026-07-02 "sửa luôn cho new-frontend"):** fix áp dụng cho **CẢ 2 workspace** — `sp-local-workspace` VÀ `new-frontend` (`stor-web`). TN1 `refreshBranches` loop **toàn bộ** repos (gồm `stor-web`) + TN2 `pickDefault` generic theo params (không hardcode repo id) → new-frontend đã nằm sẵn trong phạm vi. Verify (Leader): diff cho thấy không lọc theo workspace; `git.currentBranch('stor-web')` chạy ở root monorepo new-frontend (StatusTable đã chứng minh).

### Tasks
- [x] **TN1: RepoList hiển thị current branch thật + refresh sau khi BranchPicker đổi branch**
  - `RepoList.jsx`: thêm state `branchById` + hàm `refreshBranches(list)` (mirror StatusTable: `Promise.all(list.map(r => git.currentBranch(r.id).catch(()=>null)))` → `setBranchById`), gọi ngay sau khi `listRepos()` xong (dùng `list`, không phụ thuộc `repos` async). Render `branch {branchById[repo.id] ?? '…'}` thay cho `{repo.defaultBranch}`. Hiện `'…'` khi đang load/không xác định — **KHÔNG** fallback về `defaultBranch` (đó chính là giá trị gây hiểu nhầm).
  - Wire refresh sau mutation: truyền prop `onBranchChanged` (= `refreshBranches`) vào `<BranchPicker repo={activeRepo} />`; `BranchPicker.jsx` nhận prop optional và gọi `onBranchChanged?.()` sau khi **checkout / pull / reset-tracked / discard-all** thành công (sau `refresh(true)`), để list trái cập nhật branch mới mà không cần reload app. Fetch (read-only) không cần gọi.
  - Giữ nguyên mọi thứ khác của RepoList (selection, port, path, cảnh báo trùng port, persist). KHÔNG đụng orchestrator/git/ipc/preload.
  - Acceptance: RepoList hiển thị branch = current branch thật của từng repo (khớp StatusTable + BranchPicker "Current"); sau khi checkout branch khác trong picker → dòng branch của repo đó ở list trái đổi theo; `npm run build:renderer` PASS.
  - Verify: `npm.cmd run build:renderer` PASS; static: dòng branch của list KHÔNG còn render `repo.defaultBranch`; grep xác nhận `onBranchChanged` được gọi trong 4 handler mutation của BranchPicker. (Xác nhận UI thật = nghiệm thu tay.)
  - Files: `src/renderer/components/RepoList.jsx`, `src/renderer/components/BranchPicker.jsx`. · Deps: —
  - **DONE (Coder TN1, 2026-07-02):** `RepoList.jsx` thêm state `branchById` + `reposRef` + `refreshBranches(list)` (mirror StatusTable: `useCallback`, `Promise.all` fetch `git.currentBranch` song song, lỗi/repo → `null`, KHÔNG poll); mount effect sau `setRepos(list)` set `reposRef.current=list` rồi `refreshBranches(list)` (dùng chính `list`, không đọc state async). Dòng branch của list đổi `{repo.defaultBranch}` → `{branchById[repo.id] ?? '…'}` (KHÔNG fallback defaultBranch); truyền `onBranchChanged={refreshBranches}` vào `<BranchPicker>`. `BranchPicker.jsx` nhận prop optional `onBranchChanged`, gọi `onBranchChanged?.()` sau `await refresh(true)` trong `onCheckout`/`onPull`/`onResetTracked`/`onDiscardAll` (KHÔNG trong `onFetch` read-only). Giữ nguyên selection/persist/port-conflict/path (RepoList) + guard-dirty/checkout/pull (BranchPicker); KHÔNG đụng orchestrator/git/ipc/preload. Verify PASS: `npm.cmd run build:renderer` PASS (39 modules, 766ms); `Select-String repo\.defaultBranch` @ RepoList.jsx = KHÔNG match; `currentBranch|branchById` xác nhận state+callback+render; BranchPicker `onBranchChanged` = 5 match (prop + 4 handler mutation, KHÔNG có ở onFetch); `git diff --stat` chỉ 2 file renderer. Nghiệm thu UI thật = manual `[~]`.
- [x] **TN2: Dropdown chọn branch preselect CURRENT branch (không phải defaultBranch)**
  - Bug (user, kèm ảnh): `<select>` chọn branch trong `BranchPicker` đang preselect `repo.defaultBranch` (`master`) dù repo đang ở branch khác → phải preselect **branch hiện tại**.
  - [`BranchPicker.jsx` `pickDefault(branches, defaultBranch, current)`](src/renderer/components/BranchPicker.jsx:18): đảo thứ tự ưu tiên → **current branch TRƯỚC** (local match theo `current`), rồi mới `defaultBranch` (local, rồi remote short), cuối cùng `branches[0]`. Cập nhật comment đầu file (đang ghi "defaultBranch PRESELECTED… fallback current") cho khớp logic mới.
  - Giữ nguyên: guard dirty; Checkout `disabled` khi `chosen === current` (preselect current → nút Checkout disabled sẵn, đúng vì đang ở branch đó). Không đụng orchestrator/git.
  - Acceptance: mở repo đang ở branch X (X ≠ default) → dropdown hiện X; repo detached / không có `current` trong list → fallback `defaultBranch`; list rỗng → `''`. `npm run build:renderer` PASS.
  - Verify: `npm.cmd run build:renderer` PASS; đọc `pickDefault` khẳng định `current` được ưu tiên trước `defaultBranch`.
  - Files: `src/renderer/components/BranchPicker.jsx`. · Deps: TN1 (CÙNG FILE — làm TUẦN TỰ sau TN1, không sửa song song).
  - **DONE (Coder TN2, 2026-07-02):** `BranchPicker.jsx` `pickDefault(branches, defaultBranch, current)` đảo thứ tự ưu tiên thành **current-first**: (1) `if (current)` → local match `!b.isRemote && b.name === current` → `b.name`; (2) rồi `if (defaultBranch)` → local match `!b.isRemote && b.name === defaultBranch`, rồi remote short `b.isRemote && b.short === defaultBranch`; (3) cuối `branches[0].name`; list rỗng → `''`. Cập nhật comment đầu file + doc-comment hàm cho khớp (CURRENT PRESELECTED, fallback defaultBranch → first). Hàm **generic, KHÔNG hardcode repo** (chỉ dùng params) → cover MỌI repo gồm `new-frontend/stor-web` (giá trị `current` đến từ `git.currentBranch(repo.id)`, đã chạy cho stor-web như StatusTable). Caller line 92 vẫn `pickDefault(list, repo.defaultBranch, cur)` với `cur` = current branch thật. GIỮ NGUYÊN TN1 (`onBranchChanged` prop + 4 handler checkout/pull/reset/discard) + guard dirty + Checkout `disabled` khi `chosen === current`. Verify PASS: `npm.cmd run build:renderer` PASS (39 modules, 975ms); đọc `pickDefault` sau sửa khẳng định `if (current)` (dòng 21-24) ĐỨNG TRƯỚC `if (defaultBranch)` (dòng 25-30); `git diff --stat -- src/` chỉ BranchPicker.jsx (TN2) + RepoList.jsx (từ TN1). KHÔNG đụng main/orchestrator/git/ipc/preload/repositories. Nghiệm thu UI thật (dropdown hiện current branch cho mọi repo gồm stor-web) = manual `[~]`.

**Ưu tiên làm ngay:** `TN1` → rồi `TN2` (cùng file `BranchPicker.jsx`, tuần tự).

## 12. Phase O — Bảo vệ `.env-prod`/`.env-test` khỏi "Discard all" (git local exclude) (nghiệm thu 2026-07-02)

> **Yêu cầu user:** `.env-prod`/`.env-test` (selfpointrest) là file **untracked** user tự giữ. Nút **Discard all** chạy `git clean -fd` → **XÓA** chúng. User muốn git **tự động loại trừ** 2 file để discard/reset không đụng file của họ. **Chọn: tính năng launcher — tự động, chạy mọi máy** (khớp mục tiêu portable Phase K).
> **Phân tích (đã verify read-only):** selfpointrest là git repo riêng (`.git` tại `servers/selfpointrest`); `.env` đã ignored (`.gitignore:26`); `.env-prod`/`.env-test` **untracked, chưa ignored**; launcher dùng `git clean -fd` ([git.js:244](src/main/orchestrator/git.js)) **không `-x`** → **file ignored được giữ lại**. `git reset --hard HEAD` (Reset tracked) vốn không đụng untracked.
> **Cách đúng:** thêm 2 pattern vào **`.git/info/exclude`** (ignore CỤC BỘ, KHÔNG commit, không làm bẩn working tree, KHÔNG bị `reset --hard` revert như `.gitignore` — vì `.gitignore` là file tracked). Sau đó `git clean -fd` bỏ qua chúng.

### Tasks
- [x] **TO1: `git.ensureLocalExcludes` + wire tự động vào env flow + áp dụng ngay cho selfpointrest**
  - `src/main/orchestrator/git.js`: thêm `async ensureLocalExcludes(repoId, patterns)`:
    - Resolve repo cwd như các hàm git khác. Định vị file exclude bằng `git rev-parse --git-path info/exclude` (robust cho worktree/submodule) → đường dẫn tuyệt đối; tạo thư mục/file nếu thiếu.
    - **Backup** (CONTEXT §10): nếu chưa có `info/exclude.launcher-bak` thì copy file exclude hiện tại sang đó TRƯỚC khi sửa.
    - **Idempotent**: đọc nội dung, chỉ append pattern CHƯA có (so từng dòng đã trim), dưới marker `# launcher: local env excludes (managed)`; giữ nguyên nội dung cũ; KHÔNG nhân đôi.
    - Trả `{ ok, excludePath, added:[...], already:[...] }` — serializable, KHÔNG throw (lỗi → `{ ok:false, message }`). Export trong `module.exports`.
  - Wire **tự động** cho selfpointrest với `['.env-prod', '.env-test']` (chỉ repo có env như selfpointrest):
    - `src/main/orchestrator/env.js`: trong `applyEnv` (sau khi copy env xong) gọi `git.ensureLocalExcludes(repoId, ['.env-prod','.env-test'])`.
    - Chạy cả khi **mở panel** (không cần bấm gì): fold vào hàm đọc env-status mà `EnvSelector` gọi lúc mount cho selfpointrest (TÁI DÙNG ipc sẵn có nếu được; chỉ thêm ipc `env:ensureExcludes` + preload khi thật cần). Mục tiêu: chỉ cần selfpointrest được chọn/mở env là 2 file được bảo vệ.
  - **Áp dụng NGAY** trên selfpointrest thật: gọi `ensureLocalExcludes('selfpointrest', ['.env-prod','.env-test'])` một lần (idempotent + đã backup). **CHỈ append `info/exclude`** — TUYỆT ĐỐI không chạy `clean -fd`/`reset --hard` trên repo thật.
  - Acceptance:
    - Sau khi chạy trên repo thật: `git -C <selfpointrest> check-ignore -v .env-prod .env-test` → cả 2 bị ignore bởi `info/exclude`; `git -C <selfpointrest> status --short` KHÔNG còn `?? .env-prod`/`?? .env-test`; `git -C <selfpointrest> clean -fdn` (DRY-RUN) KHÔNG liệt kê 2 file.
    - Gọi lần 2 → `added:[]`, exclude không nhân đôi dòng (idempotent).
    - `node --check` git.js/env.js(/ipc.js); `npm run build:renderer` PASS (nếu đụng renderer).
  - Verify (AN TOÀN — KHÔNG destructive trên repo thật):
    - Fixture git tạm dưới `C:\tmp\...`: `git init`, tạo `.env-prod`/`.env-test` untracked → `ensureLocalExcludes` → assert exclude cập nhật + idempotent lần 2 + `git clean -fdn` không liệt kê + backup tồn tại. (Phần fixture KHÔNG đụng managed repo.)
    - Trên selfpointrest thật CHỈ: append (đã backup) + lệnh READ-ONLY (`check-ignore`, `status`, `clean -fdn`).
  - Files: `src/main/orchestrator/git.js`, `src/main/orchestrator/env.js`, `src/renderer/components/EnvSelector.jsx`, (nếu cần) `src/main/ipc.js` + `src/main/preload.js`. · Deps: —
  - **DONE (Coder TO1, 2026-07-02):** Đã bảo vệ `.env-prod`/`.env-test` của selfpointrest khỏi nút Discard all (`git clean -fd`) qua git local exclude — tự động + đã áp dụng ngay trên repo thật.
    - `git.js`: thêm `async ensureLocalExcludes(repoId, patterns, options={})` (+ export). Resolve cwd = `repoCwd(repoId)` (registry, giống các hàm git khác); `options.cwd` là hook **CHỈ dùng cho test/fixture**. Định vị exclude bằng `git rev-parse --git-path info/exclude` chạy tại cwd → `path.resolve(cwd, rel)` (robust worktree/submodule); `fs.mkdir(dir,{recursive})` + đọc file (ENOENT → coi như rỗng). **Idempotent**: so từng dòng đã trim (Set) → chỉ append pattern chưa có, dưới marker `# launcher: local env excludes (managed)`, giữ EOL hiện có, không nhân đôi. **Backup**: chỉ khi có gì để append + `<exclude>.launcher-bak` chưa tồn tại → ghi nội dung PRE-EDIT vào `.launcher-bak` TRƯỚC khi sửa. Trả `{ ok, excludePath, added, already }`; lỗi → `{ ok:false, message }`; KHÔNG throw. Thêm `require('node:fs/promises')` + `node:path` vào đầu file.
    - Wire **tự động** (KHÔNG cần bấm) qua `env.js`, TÁI DÙNG ipc sẵn có → **KHÔNG thêm ipc/preload/EnvSelector**: thêm `PROTECTED_ENV_EXCLUDES=['.env-prod','.env-test']` + helper `ensureProtectedEnvExcludes(options)` (bọc try/catch, nuốt lỗi → không phá env flow; nếu test truyền `options.selfpointrestDir` thì forward thành `{cwd}` để fixture tự chứa). Gọi trong `applySelfpointrestEnv` (sau `ensureClientsDir`, tức sau copy env) và trong `getSelfpointrestEnvStatus` (ngay sau resolve dir — hàm mà `EnvSelector` gọi lúc mount qua ipc `env:getStatus`). ⇒ Chỉ cần mở panel env selfpointrest HOẶC Apply env là 2 file được bảo vệ. Không có circular require (`env→git→repos`; `git` KHÔNG require `env`).
    - **Áp dụng NGAY trên repo thật** (chỉ append `info/exclude`, KHÔNG chạy `clean -fd`/`reset --hard`): `node -e "...ensureLocalExcludes('selfpointrest',['.env-prod','.env-test'])"` → `{ok:true, added:['.env-prod','.env-test'], already:[]}`.
    - **Verify (output thật):**
      - Fixture tạm `C:\tmp\to1-fix` (git init + 2 file untracked + exclude có sẵn `*.log`): call1 `added=[both]`; call2 `added=[]`, `already=[both]` (idempotent); mỗi pattern + marker xuất hiện ĐÚNG 1 lần; nội dung cũ (`# pre-existing`, `*.log`) được giữ; `.launcher-bak` tồn tại & = nội dung PRE-EDIT; `git clean -fdn` KHÔNG liệt kê 2 file; `check-ignore -v` trỏ `info/exclude`. ALL PASS. (Đã xóa fixture sau test; KHÔNG đụng managed repo.)
      - Repo thật `sp-local-workspace/servers/selfpointrest` (read-only sau append): `check-ignore -v .env-prod .env-test` → `.git/info/exclude:8:.env-prod` / `:9:.env-test`; `status --short` KHÔNG còn `?? .env-prod/.env-test`; `clean -fdn` KHÔNG liệt kê 2 file; `.git/info/exclude.launcher-bak` present; call lần 2 `added:[]`; line-count prod=1/test=1/marker=1; `status --porcelain` không thấy `info/exclude` (nằm dưới `.git`, working tree KHÔNG bẩn). KHÔNG in nội dung `.env*`.
      - `node --check` git.js + env.js → OK. KHÔNG đụng renderer nên bỏ qua `build:renderer` (không cần).

### Definition of Done (Phase O)
- [x] `.env-prod`/`.env-test` của selfpointrest được git **ignore cục bộ** qua `.git/info/exclude` → **Discard all (`clean -fd`) KHÔNG xóa**; Reset tracked vốn đã an toàn.
- [x] Launcher **tự động** đảm bảo exclude cho selfpointrest (khi mở/Apply env) → chạy được trên máy mới mà không cần thao tác tay.
- [x] Idempotent + có backup `info/exclude`; không đụng file tracked / không làm bẩn working tree; không log secret.
- [x] Đã áp dụng ngay trên selfpointrest thật (verify bằng `check-ignore`/`status`/`clean -fdn`).

**Ưu tiên làm ngay:** `TO1`.
