# CONTEXT.md — Local Dev Launcher

> **Đây là "single source of truth" (nguồn sự thật duy nhất).** Mọi agent (Leader / Coder / Reviewer), trên Claude Code lẫn Codex, PHẢI đọc file này trước khi làm bất cứ việc gì. Khi có mâu thuẫn giữa các file, file này thắng — **trừ** README/`package.json` thực tế trong repo (xem §10: luôn verify lại trước khi tin).

---

## 1. Mục tiêu

Xây một **app "Local Dev Launcher"** giúp dev khởi động môi trường local cho hệ thống SelfPoint. Thay vì làm thủ công từng repo, launcher cho phép: chọn repo → chọn branch → fetch/pull → cài dependencies còn thiếu → bật & chờ VPN → (chọn env cho backend) → build/run đúng thứ tự → và **stop/restart** khi cần.

**Quan trọng:** Stack của launcher (Electron / Web dashboard / CLI…) **chưa chốt** — Leader sẽ phân tích và đề xuất trong `plan.md`. CONTEXT này mô tả *cái cần làm*, không ép *cách làm*.

---

## 2. Hai workspace & đường dẫn

Launcher quản lý 2 **workspace root** bên ngoài repo này. Từ Phase K, các root này **cấu hình được** trong app thay vì chỉ hardcode theo máy hiện tại:

- Config rỗng/config cũ → launcher resolve bằng fallback mặc định trước; nếu root resolved (fallback hoặc user đã lưu) không hợp lệ thì `WorkspaceSettings` hiển thị onboarding và **chặn Start/Build/Install** tới khi chọn đủ 2 root hợp lệ.
- User chọn thư mục bằng folder picker IPC `workspace:pickFolder`, hoặc nhập tay rồi lưu qua `workspace:setRoots`.
- Root được lưu trong config `workspaceRoots.spLocalWorkspace` và `workspaceRoots.newFrontend`; `repos.js` apply root hiện hành để tính `path`/`installCwd`/`runCwd`.
- Validation dùng `store.validateRoot`: `sp-local-workspace` cần marker `servers/selfpointrest` + `public`; `new-frontend` cần `apps/stor-web` + (`nx.json` hoặc `pnpm-lock.yaml`).
- Nếu config chưa có root (config cũ/back-compat), launcher fallback về đường dẫn mặc định dưới đây.

| Workspace | Persisted config field | Fallback mặc định | Package manager | Node | Tooling |
|---|---|---|---|---|---|
| **sp-local-workspace** | `workspaceRoots.spLocalWorkspace` | `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` | **npm** | **20.18.0** | root `npm install` cho builder; UI Back Office/Kikar/Prutah build tại ROOT bằng `build-backend`/`build-kikar`/`build-prutah`; `servers/selfpointrest` chỉ `buildAll`/`npm start` và serve output |
| **new-frontend** | `workspaceRoots.newFrontend` | `C:\Users\TrungPhung\Downloads\repositories\new-frontend` | **pnpm@10.12.1** | **20+** | Nx 22 monorepo, Next.js 16, Husky |

> Launcher đặt ở `C:\Users\TrungPhung\Downloads\personal-trung-phung\local-starter` và **quản lý các repo bên ngoài** qua workspace root user chọn (hoặc fallback mặc định). Không di chuyển/sửa file bên trong managed workspace ngoài những gì đặc tả ở đây (đổi tên `.env`, sửa code indexer).

---

## 3. Bảng repo (sự thật đã verify từ README + package.json)

Tất cả đường dẫn dưới đây tương đối so với workspace root tương ứng ở §2.

### 3.1 sp-local-workspace — Backend (servers)

| # | Repo | Path | Vai trò | Install | Build | Start | Port |
|---|---|---|---|---|---|---|---|
| 1 | **selfpointrest** | `sp-local-workspace/servers/selfpointrest` | Backend chính | `npm install` *(postinstall tự chạy `buildAll`)* | `npm run buildAll` (`npx gulp buildAll`) | `npm start` (`node server.js`) | **3000** (https 3001) |
| 2 | **loyalty** | `sp-local-workspace/servers/loyalty` | Backend loyalty | `npm install` | — (không có) | `npm start` (`node lib/server`) | **4000** |
| 3 | **indexer-queue-subscriber** | `sp-local-workspace/servers/indexer-queue-subscriber` | Indexer (Elasticsearch) | `npm install` | — | `npm start` (`node --max-old-space-size=3000 ./server.js`) | **4002** |
| 4 | **token-service** | `sp-local-workspace/servers/token-service` | Token (TypeScript) | `npm install` | `npm run build` (`tsc` → `dist/`) | `npm start` (`cleanBuild && node dist/index.js`) | **4001** (set qua `.env`; code mặc định 4000) |

### 3.2 sp-local-workspace — UI (public)

| # | Repo | Path | Vai trò | Install | Build | Start/Serve | Port |
|---|---|---|---|---|---|---|---|
| 5 | **backend (Back Office)** | `sp-local-workspace/public/backend` | UI Back Office (AngularJS + Gulp) | `npm install` *(postinstall `bower install`)* | ROOT `sp-local-workspace`: `npm run build-backend` *(alternative thủ công: `public/backend` `npm run build-local`)* | **build-only** → selfpointrest serve ở `/backend` | — |
| 6 | **frontend** | `sp-local-workspace/public/frontend` | UI Frontend (AngularJS) | `npm install` *(postinstall `bower install --config.directory=libs`)* | ROOT `sp-local-workspace`: `npm run build-kikar` / `npm run build-prutah` | **build-only** → selfpointrest serve ở `/kikar`, `/prutah` | livereload 35999 (dev) |
| 7 | **mobile** | `sp-local-workspace/public/mobile` | UI web mobile (AngularJS + Cordova) | `npm install` *(postinstall `bower`)* | `npm run build` (`gulp web:build`) | `npm run serve` (`gulp web:serve`) | **9000** |
| 8 | **collection** | `sp-local-workspace/public/collection` | UI collection (AngularJS + Cordova) | `npm install` *(postinstall `bower`)* | `npm run build` | `npm run serve` | **9000** ⚠️ |

> **Build UI để selfpointrest serve (verified 2026-07-01):** dùng script ở ROOT **`sp-local-workspace`**: `npm run build-backend`, `npm run build-kikar`, `npm run build-prutah` (`node builder <client> build [-t <template>]`). ROOT cần `npm install` trước vì builder dùng deps của `sp-local-workspace/package.json`; `public/backend` và `public/frontend` vẫn cần `npm install` riêng để có deps/bower assets cho client.
> - `backend`/`frontend` **không có dev server riêng** → build rồi để selfpointrest serve ở `/backend`, `/kikar`, `/prutah`.
> - `public/backend` có `npm run build-local` là alternative thủ công nếu cần; launcher path chính vẫn là các script build ở ROOT `sp-local-workspace`.
> - `mobile`/`collection` chạy **standalone dev** bằng `npm run serve` (gulp `web:serve`, port 9000).
> - ⚠️ `public/frontend` **KHÔNG** có script `node builder --template=...` hay `node livereload run` (livereload 35999 chỉ là chế độ dev template, không phải npm script). Build template bằng root scripts `build-kikar`/`build-prutah`.

### 3.3 new-frontend

| # | Repo | Path | Vai trò | Install | Build | Start | Port |
|---|---|---|---|---|---|---|---|
| 9 | **stor-web** | `new-frontend/apps/stor-web` | New UI mobile (Next.js, Nx) | `pnpm install` (ở root `new-frontend`) | `pnpm nx build stor-web` | `pnpm nx serve stor-web` | **3002** |

> **Lưu ý:** `pnpm install` chạy **1 lần ở root** `new-frontend` (monorepo), không phải trong `apps/stor-web`. Lệnh `nx` cũng chạy từ root.

---

## 4. Branch mặc định & quy ước Git

| Workspace | Branch mặc định | Ghi chú |
|---|---|---|
| sp-local-workspace (mọi repo) | **`master`** | Không có nhánh `release`. Có nhiều nhánh feature `SP-xxxxx` |
| new-frontend | **`new-frontend-dev-prod`** | Branch hiện tại trên máy là `development`; cũng có nhánh feature `SFV2-xxxx` |

**Hành vi Git mong muốn của launcher cho mỗi repo đã chọn:**
1. `git fetch --all --prune`.
2. Hiển thị danh sách branch (local + remote) cho user chọn; **preselect** branch mặc định ở trên.
3. Nếu branch mặc định không tồn tại → KHÔNG fail, mà để user chọn từ danh sách thực tế (fallback picker).
4. `git checkout <branch>` rồi `git pull` (mặc định chỉ khi working tree sạch — nếu có thay đổi local thì cảnh báo, không tự ý overwrite).
5. Nếu working tree bẩn, launcher phải cho user chọn hành động rõ ràng trước khi checkout/pull:
   - **Reset tracked changes về `HEAD` hiện tại:** chạy `git reset --hard HEAD` để bỏ thay đổi tracked/index, **không** reset về `origin/<branch>` và không đụng untracked files.
   - **Discard toàn bộ local changes:** chạy `git reset --hard HEAD` + `git clean -fd` để bỏ tracked + untracked non-ignored files. Trước khi chạy phải hiển thị preview an toàn (`git status --short`, `git clean -fdn`), yêu cầu xác nhận theo từng repo, và không in nội dung file secret.
   - Các hành động này **không được tự động chạy**; chỉ chạy khi user xác nhận vì có thể mất dữ liệu chưa commit.
6. ⚠️ Cẩn thận: launcher **chủ động sửa** một số file (đổi tên `.env`, code indexer §7). Phải xử lý để các sửa đổi này không chặn checkout/pull (vd dùng `git stash` có kiểm soát, cảnh báo user, hoặc reset/discard có xác nhận) — Leader cần thiết kế rõ.

---

## 5. selfpointrest — xử lý `.env` (BẮT BUỘC trước khi run)

Trong `servers/selfpointrest` có **3 file**:
- `.env` — file đang active (được `dotenv` nạp khi `node server.js`).
- `.env-prod` — trỏ DB **production**.
- `.env-test` — trỏ DB **test**.

**Cơ chế:** trước khi start selfpointrest, launcher cho user chọn **prod** hoặc **test** (mặc định **prod**), rồi **copy/đổi tên file tương ứng → `.env`**.

**Yêu cầu an toàn (Leader phải thiết kế):**
- Trước khi ghi đè `.env`, **backup** `.env` hiện tại (vd `.env.bak-<timestamp>`) để không mất cấu hình cá nhân.
- Nên **copy** (`copy .env-prod .env`) thay vì rename (giữ lại `.env-prod`/`.env-test` để lần sau còn chọn lại).
- Đảm bảo trong `.env` có dòng `clients_dir="../../public"` (xem §6) — nếu thiếu thì cảnh báo/thêm.
- KHÔNG in nội dung `.env*` ra log (chứa secret: DB password, API key).
- Hiển thị rõ cho user: "đang dùng env = prod/test" trước khi start.

---

## 6. Quan hệ "selfpointrest serve UI" (ảnh hưởng thứ tự build)

selfpointrest **phục vụ các UI tĩnh đã build**:
- UI **backend (Back Office)** → truy cập ở `http://localhost:3000/backend`
- UI **frontend** template **Kikar** → `http://localhost:3000/kikar`
- UI **frontend** template **Prutah** → `http://localhost:3000/prutah`

Điều kiện: trong `.env` của selfpointrest phải có `clients_dir="../../public"` (trỏ tới thư mục `public/` chứa output build của backend/frontend).

**Hệ quả cho launcher:**
- Muốn xem UI Back Office / Frontend → phải **build tại ROOT `sp-local-workspace`** (`npm run build-backend` / `build-kikar` / `build-prutah`; output vào `servers/selfpointrest/build/<client>`) **rồi** chạy selfpointrest từ `servers/selfpointrest`. Hai UI này **không có dev server riêng** (frontend chỉ có livereload 35999 ở chế độ dev template, không phải npm script chuẩn).
- Trước build UI Back Office / Frontend, launcher phải kiểm tra/install ROOT `sp-local-workspace` (deps cho `node builder`) và `public/backend`/`public/frontend` tương ứng; `npm run buildAll` và `npm start` của selfpointrest vẫn chạy tại `servers/selfpointrest`.
- `mobile` và `collection` thì **độc lập** — chạy dev server riêng ở port 9000.
- `stor-web` (new-frontend) độc lập — port 3002.

---

## 7. indexer-queue-subscriber — sửa code trước khi run + restart

Repo này **không chạy "ngay"** mà thường cần chỉnh test trước:
- `servers/indexer-queue-subscriber/test/products.js` — chứa `retailerId` hardcode (vd `1249`) và mảng `productIds` (vd `[20097284, 4501409, ...]`). Dev thường đổi sang retailer/product cần index.
- `servers/indexer-queue-subscriber/test/specials.js` — dùng `config.get('test:retailer')` và `config.get('test:special')`. Cần set giá trị phù hợp.
- Có thể comment `queue.subscribe()` (trong `server.js`) để chỉ test REST mà không tiêu thụ queue.
- **Không có nodemon** → mỗi lần đổi code phải **restart thủ công**. Launcher cần cung cấp nút/cơ chế **restart** riêng cho repo này (kill process cũ → start lại).

**Cách launcher nên hỗ trợ (Leader thiết kế chi tiết):**
- Cho user **mở nhanh** 2 file trên (mở bằng editor mặc định) **và/hoặc** cho user nhập preset (retailerId, productIds, special) rồi launcher patch vào file một cách an toàn (idempotent, có backup).
- Sau khi user sửa xong → launcher start (hoặc restart) repo.
- Chạy với `--max-old-space-size=3000` đúng như `npm start`.

---

## 8. Port & xung đột

| Port | Repo |
|---|---|
| 3000 / 3001 | selfpointrest (http/https) |
| 3002 | stor-web |
| 4000 | loyalty |
| 4001 | token-service (set qua `.env` PORT) |
| 4002 | indexer-queue-subscriber |
| 9000 | **mobile** *và* **collection** ⚠️ trùng |
| 35999 | frontend livereload |

**Xử lý xung đột (Leader thiết kế):**
- token-service **đã** được set `PORT=4001` trong `.env` của nó → **không trùng** loyalty (4000); không cần override. (Launcher vẫn nên hỗ trợ override `PORT` mỗi repo như tùy chọn chung.)
- mobile & collection đều 9000 → hiếm khi chạy cùng lúc nhưng phải cảnh báo nếu user chọn cả hai.
- Trước khi start một repo, launcher nên **kiểm tra port có đang bận không** (và báo rõ repo nào đang giữ port).

---

## 9. VPN (Azure VPN; client theo OS)

- Backend (selfpointrest, loyalty, indexer, token-service) cần VPN để truy cập dịch vụ nội bộ. UI thuần (build/serve) thì không.
- Launcher **không** tự lấy/import file `.ovpn` hoặc profile VPN. User phải chuẩn bị client/profile riêng theo OS.
- Windows default: OpenVPN GUI `C:\Program Files\OpenVPN\bin\openvpn-gui.exe`; thư mục config `C:\Program Files\OpenVPN\config\` có thể rỗng lúc đầu, cần import `.ovpn` thủ công từ team.
- macOS default: `open -a Tunnelblick` (có thể override bằng config).
- Linux: không có default an toàn; user cấu hình `vpn.clientPath`/`vpn.clientArgs` (vd `nmcli`, `openvpn3`, hoặc client nội bộ). `vpn.exePath` cũ vẫn là alias back-compat cho `clientPath`.

**Flow VPN mong muốn của launcher:**
1. **Detect** đã kết nối VPN chưa bằng adapter VPN đang `Up` theo OS: Windows `Get-NetAdapter`, macOS `ifconfig`, Linux `ip -o link show`. Launcher không mở kết nối thử tới host nội bộ để dò trạng thái VPN.
2. Nếu **chưa** kết nối → chạy VPN client theo OS/config (`launchVpnClient` với `clientPath`/`clientArgs`) và **hiển thị thông báo "Hãy đăng nhập VPN"**. Trên Linux nếu chưa cấu hình client, báo rõ để user nhập `clientPath`/`clientArgs`.
3. **Poll adapter** (vd mỗi 2–3s, có timeout) tới khi adapter VPN `Up` → mới tiếp tục start backend.
4. Cho phép user **bỏ qua** VPN nếu chỉ chạy UI (build/serve không cần DB).

> Launcher chỉ detect + mở/focus client + chờ; không quản lý secret/profile VPN.

---

## 10. Quy tắc cho mọi AI agent (Claude Code & Codex)

1. **Luôn verify trước khi tin.** Trước khi đưa một lệnh build/run vào plan hoặc code, MỞ `package.json` (và README) của repo đó để xác nhận script còn đúng. README + `package.json` thực tế **thắng** CONTEXT nếu lệch — và khi lệch, ghi chú lại để cập nhật CONTEXT.
2. **Shell & package-manager theo OS.** Môi trường hiện đã verify chính trên Windows 11, nhưng code phải giữ đúng cho Windows/macOS/Linux. Đường dẫn có space phải được truyền an toàn (ưu tiên `cwd`/args thay vì ghép chuỗi). `npm.cmd`/`pnpm.cmd` chỉ dùng trên Windows (`platform.pmCommand`); macOS/Linux dùng `npm`/`pnpm`. pnpm nên bật qua `corepack enable`.
3. **Process management cross-platform.** Các lệnh start là **long-running dev server**. Launcher phải spawn với `cwd` đúng repo, capture stdout/stderr để stream log, lưu PID, hỗ trợ **stop từng repo**, **stop all**, **restart** (đặc biệt indexer §7), và xử lý process tự chết (crash) → cập nhật trạng thái. Stop phải kill **cả cây process**: Windows dùng `taskkill /PID <pid> /T /F`; POSIX (macOS/Linux) spawn long-running process với `detached:true`, rồi kill process group bằng `SIGTERM` → timeout → `SIGKILL`.
4. **Mở file/editor theo OS.** Không hardcode `cmd /c start` ngoài Windows. Dùng helper tương đương `platform.openPath`: Windows `cmd /c start "" <path>`, macOS `open <path>`, Linux `xdg-open <path>`.
5. **VPN client theo OS.** Detect VPN chỉ dựa vào adapter VPN `Up` theo OS: Windows `Get-NetAdapter`, macOS `ifconfig`, Linux `ip -o link show`; lỗi phải trả `connected:false`, không throw. Launch VPN qua `vpn.clientPath`/`vpn.clientArgs` (giữ `exePath` cũ là alias): Windows default OpenVPN GUI, macOS default `open -a Tunnelblick`, Linux bắt buộc user cấu hình client (`nmcli`/`openvpn3`/client khác).
6. **Cài dependencies "còn thiếu".** Mặc định chỉ `install` khi cần (vd `node_modules` chưa có, hoặc lockfile mới hơn `node_modules`). Cho phép user ép cài lại. new-frontend chạy **Husky** khi `pnpm install` → coi chừng hook lỗi làm install fail (cần xử lý/giải thích).
7. **Node version.** sp-local-workspace cần Node 20.18.0; new-frontend cần Node 20+. Nếu user dùng nvm/nvm-windows/asdf, launcher nên kiểm tra version và cảnh báo nếu lệch.
8. **Bí mật.** KHÔNG in/log nội dung `.env*`. KHÔNG commit secret. KHÔNG hardcode credential.
9. **Phạm vi.** KHÔNG mở rộng ngoài task được giao. KHÔNG refactor lan man. KHÔNG commit/push trừ khi user yêu cầu.
10. **Idempotent & an toàn.** Mọi thao tác sửa file trong managed workspace (đổi `.env`, patch indexer) phải idempotent, có backup, và không phá working tree git.

---

## 11. Đặc tả tính năng Launcher (yêu cầu nghiệm thu)

Launcher (bất kể stack nào) phải làm được:

- [ ] **F1 — Chọn repo:** danh sách 9 repo (§3) có checkbox; chọn 1 hoặc nhiều để vận hành. Nhóm theo workspace.
- [ ] **F2 — Chọn branch:** với mỗi repo đã chọn, hiển thị branch picker, preselect mặc định (§4), cho đổi branch.
- [ ] **F3 — Fetch & Pull:** `git fetch --all --prune` + checkout + pull an toàn (§4), báo lỗi rõ ràng nếu working tree bẩn; cho phép user xác nhận `reset --hard HEAD` hoặc discard local changes để unblock checkout/pull.
- [ ] **F4 — Install deps:** cài **khi thiếu** (npm cho sp-local-workspace, pnpm ở root cho new-frontend), có nút ép cài lại; xử lý postinstall (gulp buildAll / bower) và Husky (§10).
- [ ] **F5 — VPN:** detect adapter VPN `Up` theo OS → nếu chưa kết nối thì mở VPN client theo OS/config + thông báo để user tự authen + poll adapter tới khi kết nối (§9); cho bỏ qua nếu chỉ chạy UI.
- [ ] **F6 — Env selfpointrest:** chọn prod/test (mặc định prod), copy → `.env` có backup, đảm bảo `clients_dir` (§5).
- [ ] **F7 — Build & Run đúng thứ tự:** theo §12; build UI trước khi selfpointrest serve; override port khi trùng (§8).
- [ ] **F8 — Indexer:** hỗ trợ sửa `test/products.js` & `test/specials.js` (mở file hoặc patch preset) + **restart** (§7).
- [ ] **F9 — Stop all:** dừng toàn bộ process đã start (kill cả cây process), giải phóng port.
- [ ] **F10 — Restart:** restart từng repo (đặc biệt indexer).
- [ ] **F11 — Log & trạng thái:** stream log mỗi repo; hiển thị trạng thái (stopped / installing / building / running / crashed) + port + branch hiện tại.
- [ ] **F12 — Lưu cấu hình:** nhớ lựa chọn lần trước (workspace roots, repo, branch, env, port override, VPN client path/args) để lần sau nhanh hơn.

---

## 12. Thứ tự build/run khuyến nghị

```
1. (Nếu chọn backend cần DB)  → Bảo đảm VPN đã kết nối (F5)
2. selfpointrest:
     - chọn env prod/test → .env (F6)
     - install selfpointrest (nếu thiếu) → `npm run buildAll` tại `servers/selfpointrest`
     - nếu muốn xem UI Back Office / Frontend:
         kiểm tra/install ROOT `sp-local-workspace` + `public/backend`/`public/frontend`
         tại ROOT `sp-local-workspace`:
           npm run build-backend                        (→ /backend)
           npm run build-kikar | npm run build-prutah   (→ /kikar | /prutah)
     - `npm start` tại `servers/selfpointrest` (port 3000, serve output UI đã build)
3. loyalty (4000), token-service (4001), indexer (4002, sau khi sửa code) — chạy song song được
4. UI độc lập: mobile (9000), collection (9000), stor-web (3002)
```

Repo độc lập (không phụ thuộc nhau) có thể start song song. selfpointrest nên xong build UI trước khi user mở `/backend`, `/kikar`, `/prutah`.

---

## 13. Tham chiếu nhanh các file trong pack này

- Khung kế hoạch Leader phải xuất: `ai/templates/plan.template.md`
- Prompt Leader (planning → `plan.md`): `ai/prompts/01-leader-plan.md`
- Prompt Coder (làm 1 task): `ai/prompts/02-coder.md`
- Prompt Reviewer (review 1 task): `ai/prompts/03-reviewer.md`
- Cách dùng tổng thể (Claude Code & Codex): `README.md`
