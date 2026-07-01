# 🚀 Local Dev Launcher — Hướng dẫn chạy app

> App desktop (Electron + React/Vite) để khởi động & quản lý môi trường dev local của SelfPoint từ **một cửa sổ**: chọn repo → chọn branch → fetch/pull → cài deps → bật & chờ VPN → chọn env cho selfpointrest → build/run đúng thứ tự → stream log → **stop/restart**.
>
> File này dành cho **người dùng launcher** (chạy app). Phần *AI prompt pack* (Leader/Coder/Reviewer) nằm ở [`README.md`](./README.md) — không liên quan tới việc chạy app.

---

## 1. Yêu cầu môi trường (Prerequisites)

Launcher đã verify chính trên **Windows 11**. Code Phase K đã tách phần OS-specific để chạy trên **Windows / macOS / Linux**; Linux/macOS vẫn cần nghiệm thu end-to-end thật cho VPN client, opener và group-kill.

| Thành phần | Yêu cầu | Ghi chú |
|---|---|---|
| **Node.js** | **20.x** | `sp-local-workspace` cần đúng **20.18.0**; `new-frontend` cần 20+. Dùng nvm/nvm-windows/asdf/Volta tùy OS, miễn `node --version` là 20.x trước khi mở app. |
| **Git** | có trên PATH | Launcher gọi `git` CLI trực tiếp (fetch/checkout/pull/branch). |
| **pnpm** | bật qua `corepack enable` | `new-frontend` (stor-web) dùng `pnpm`. Chạy `corepack enable` một lần để có `pnpm` trên PATH. |
| **VPN client** | theo OS | Backend cần VPN để truy cập DB/ES nội bộ. Launcher chỉ detect / mở client / chờ kết nối; không import profile hoặc secret VPN. |

VPN client khuyến nghị theo OS:

| OS | Mặc định / gợi ý | Ghi chú |
|---|---|---|
| Windows | OpenVPN GUI `C:\Program Files\OpenVPN\bin\openvpn-gui.exe` | Import file `.ovpn` từ team vào OpenVPN GUI thủ công một lần. |
| macOS | Tunnelblick (`open -a Tunnelblick`) | Có thể override trong VPN panel bằng `clientPath`/`clientArgs` nếu dùng client khác. |
| Linux | cấu hình trong VPN panel, ví dụ `nmcli`, `openvpn3`, hoặc `openvpn` | Không có default an toàn; cần nhập `VPN client path/command` và args phù hợp với máy. |

Hai workspace mà launcher quản lý được chọn trong app:

| Workspace | Persisted config field | Fallback mặc định | Marker validate |
|---|---|---|---|
| sp-local-workspace | `workspaceRoots.spLocalWorkspace` | `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` | `servers/selfpointrest` + `public` |
| new-frontend | `workspaceRoots.newFrontend` | `C:\Users\TrungPhung\Downloads\repositories\new-frontend` | `apps/stor-web` + `nx.json` hoặc `pnpm-lock.yaml` |

Nếu chưa cấu hình, app thử fallback về đường dẫn mặc định để tương thích config cũ. Nếu fallback hoặc root đã lưu không hợp lệ, onboarding sẽ yêu cầu chọn 2 root hợp lệ trước khi cho Start/Build/Install.

---

## 2. Cài đặt & chạy (từ máy sạch)

```powershell
# 1. Vào thư mục launcher
cd <path-to-local-starter>

# 2. Cài dependencies của launcher (electron, vite, react)
npm install

# 3. Mở app
npm start
```

`npm start` chạy `electron .`. Ở chế độ dev (chưa đóng gói), main process tự khởi động **Vite dev server in-process** rồi nạp renderer — không cần lệnh phụ. Đóng cửa sổ → app thoát sạch.

**Script có sẵn (`package.json`):**

| Lệnh | Việc |
|---|---|
| `npm start` | Mở cửa sổ Electron (dev: tự bật Vite dev server). **← cách chạy chính.** |
| `npm run build:renderer` | Build renderer (Vite) ra `dist/renderer/` — dùng cho bản đóng gói (production load `dist/renderer/index.html`). |
| `npm run preview:renderer` | Preview bản renderer đã build (Vite preview). |

> Launcher tự cài deps cho **các repo được quản lý** (npm / pnpm) ngay trong app (mục **Deps**). `npm install` ở bước 2 chỉ cài deps của **bản thân launcher**.

---

## Quy trình sử dụng nhanh

### Lần đầu trước khi bấm Start

1. Mở app bằng `npm start`.
2. Nếu app hiện onboarding **Cấu hình vị trí 2 workspace**, chọn hoặc nhập 2 root:
   - `sp-local-workspace` phải có `servers/selfpointrest` và `public`.
   - `new-frontend` phải có `apps/stor-web` và `nx.json` hoặc `pnpm-lock.yaml`.
3. Bấm **Save** cho từng root. Khi cả hai root `valid`, app mới hiện StatusTable/RepoList.
4. Chọn repo muốn chạy. Click vào từng repo để mở panel chi tiết ở cột phải.
5. Ở **Branch**, bấm **Fetch**, chọn branch cần dùng, rồi **Checkout/Pull**. Nếu app báo repo đang dirty, hãy commit/stash hoặc dùng hành động reset/discard có xác nhận trong BranchPicker.
6. Ở **Deps**, bấm **Check deps**. Nếu thiếu hoặc stale, bấm **Install if needed**. Dùng **Force reinstall** khi muốn ép cài lại.
7. Nếu chạy backend, vào **VPN**, nhập probe host/port nội bộ nếu có, cấu hình client path/args nếu OS cần, bấm **Check** hoặc **Connect**, rồi đăng nhập VPN trong client. Nếu chỉ chạy UI thuần, có thể bấm **Skip**.
8. Nếu chạy `selfpointrest`, vào **Env - selfpointrest**, chọn `prod` hoặc `test`, rồi bấm **Apply env**.
9. Vào **Run**, chọn tùy chọn build cần thiết rồi bấm **Build & Start**. Theo dõi log ngay trong app.
10. Khi xong việc, dùng **Stop** cho từng repo hoặc **Stop all** để dừng toàn bộ process con.

### Luồng thường dùng

**Chạy selfpointrest + Back Office/Kikar/Prutah**

1. Chọn `selfpointrest`.
2. Kết nối VPN.
3. Chọn env `prod` hoặc `test`.
4. Check/install deps nếu cần.
5. Trong RunControls, chọn UI muốn build: Back Office, Kikar, Prutah.
6. Bấm **Build & Start**.
7. Mở:
   - `http://localhost:3000/backend`
   - `http://localhost:3000/kikar`
   - `http://localhost:3000/prutah`

**Chạy stor-web**

1. Chọn `stor-web`.
2. Fetch/checkout branch trong BranchPicker.
3. Check/install deps. Lưu ý `pnpm install` chạy ở root `new-frontend`.
4. Bấm **Build & Start**.
5. Mở `http://localhost:3002`.

**Chạy mobile hoặc collection**

1. Chọn `mobile` hoặc `collection`.
2. Không chọn cả hai cùng lúc nếu đều dùng port mặc định `9000`.
3. Check/install deps nếu cần.
4. Bấm **Build & Start**.
5. Mở `http://localhost:9000`.

**Chạy indexer**

1. Chọn `indexer-queue-subscriber`.
2. Kết nối VPN.
3. Mở **Indexer** panel.
4. Bấm mở file test để sửa tay, hoặc nhập preset `retailerId`, `productIds`, `special`.
5. Bấm apply preset. App sẽ backup file trước khi patch.
6. Bấm **Restart indexer** sau mỗi lần sửa vì repo này không có nodemon.

---

## 3. Tính năng (F1–F12)

Mọi thao tác làm trong cửa sổ launcher. Bảng trạng thái tổng nằm trên cùng (StatusTable), từng repo có card riêng (RepoList) với các panel con.

| # | Tính năng | Ở đâu trong UI | Mô tả |
|---|---|---|---|
| **F1** | Chọn repo | WorkspaceSettings + StatusTable + RepoList | Xác nhận 2 workspace root resolved hợp lệ (fallback hoặc user chọn), rồi xem danh sách 9 repo nhóm theo workspace; chọn 1 hoặc nhiều repo để vận hành. |
| **F2** | Chọn branch | BranchPicker (mỗi repo) | Picker hiển thị branch local + remote, **preselect** mặc định (`master` / `new-frontend-dev-prod`); nếu default không tồn tại → chọn từ list thật. |
| **F3** | Fetch & Pull | BranchPicker | `git fetch --all --prune` → checkout → pull **an toàn** (chỉ pull khi working tree sạch; bẩn → cảnh báo, không overwrite). |
| **F4** | Install deps | DepsPanel | Cài **khi thiếu/stale** (npm trong từng repo `sp`; `pnpm install` ở **root** `new-frontend`); nút **force reinstall**; stream output; báo lỗi rõ nếu postinstall (gulp buildAll/bower) hoặc Husky fail. |
| **F5** | VPN | VpnStatus | Detect VPN bằng probe TCP `host:port` nội bộ — **bạn tự nhập** host probe; nếu không có probe thì fallback adapter theo OS (Windows `Get-NetAdapter`, macOS `ifconfig`, Linux `ip -o link show`). Nếu down → mở VPN client theo OS/config (`clientPath`/`clientArgs`) + **native notification** "Hãy đăng nhập VPN" + poll tới khi up. Có nút **Skip** (chỉ chạy UI thì không cần VPN). |
| **F6** | Env selfpointrest | EnvSelector | Chọn **prod / test** (mặc định **prod**) → backup `.env` hiện tại (`.env.bak-<timestamp>`) → copy `.env-prod`/`.env-test` → `.env`; đảm bảo `clients_dir="../../public"`. **Không in nội dung `.env` ra log.** |
| **F7** | Build & Run | RunControls | Build/run đúng thứ tự. selfpointrest: install→`buildAll`→(tùy chọn build UI Back Office/Kikar/Prutah qua script selfpointrest)→`npm start` (3000). Override `PORT` khi trùng. |
| **F8** | Indexer edits | IndexerPanel | Mở `test/products.js` & `test/specials.js` bằng editor mặc định, **và/hoặc** nhập preset (retailerId / productIds / special) → patch **idempotent + backup**; nút **Restart** indexer. |
| **F9** | Stop all | StatusTable / RunControls | Dừng **toàn bộ** process đã start, giải phóng port: Windows dùng `taskkill /T /F`, macOS/Linux dùng detached process group `SIGTERM` → `SIGKILL`. |
| **F10** | Restart | RunControls / IndexerPanel | Restart từng repo (đặc biệt indexer: kill cây cũ → start lại với `--max-old-space-size=3000`). |
| **F11** | Log & trạng thái | RunControls (log stream) + StatusTable | Mỗi repo stream stdout/stderr realtime; bảng trạng thái hiện state (`stopped/installing/building/running/crashed`) + port + branch. Process tự chết → state chuyển `crashed`. |
| **F12** | Lưu cấu hình | tự động (store.js) | Nhớ lựa chọn lần trước (workspace roots, repo, branch, env, port override, VPN probe host, VPN client path/args) trong `userData` → mở lại app khôi phục đúng. |

### Thứ tự build/run khuyến nghị

```
1. (Nếu chạy backend cần DB) → bảo đảm VPN đã kết nối (F5)
2. selfpointrest: chọn env prod/test (F6) → install (nếu thiếu) → buildAll
     → (tùy chọn) build-backend / build-kikar / build-prutah để xem UI
     → npm start (port 3000; UI ở /backend, /kikar, /prutah)
3. loyalty (4000), token-service (4001), indexer (4002, sau khi sửa code) — song song được
4. UI độc lập: mobile (9000) HOẶC collection (9000), stor-web (3002)
```

---

## 4. Lưu ý vận hành (port & VPN)

**Bảng port:**

| Port | Repo | Ghi chú |
|---|---|---|
| 3000 / 3001 | selfpointrest | http / https; serve UI tĩnh ở `/backend`, `/kikar`, `/prutah` |
| 3002 | stor-web (new-frontend) | UI thuần, không cần VPN |
| 4000 | loyalty | backend, cần VPN |
| 4001 | token-service | set qua `.env` (PORT=4001) → **không trùng** loyalty 4000 |
| 4002 | indexer-queue-subscriber | backend, cần VPN; sửa code → restart thủ công |
| 9000 | **mobile** *và* **collection** | ⚠️ **trùng** — đừng chạy cả hai cùng lúc (launcher cảnh báo nếu chọn cả hai) |
| 35999 | frontend livereload | chỉ chế độ dev template, ngoài luồng run cơ bản |

**VPN:**

- **Backend** (selfpointrest, loyalty, indexer, token-service) **cần VPN** để truy cập DB/ES nội bộ → kết nối VPN (F5) trước khi run.
- **UI thuần** (build/serve: mobile, collection, stor-web, build UI Back Office/Frontend) **không cần VPN** → có thể **Skip** ở bước VPN.
- VPN probe **host:port** do bạn nhập (vd host DB/ES nội bộ) — không hardcode. Nếu không nhập probe, launcher fallback kiểm adapter theo OS.
- VPN client mở theo OS/config: Windows OpenVPN GUI mặc định, macOS Tunnelblick mặc định, Linux cần `clientPath`/`clientArgs`. Launcher **không** tự import `.ovpn`/profile.

**An toàn:**

- Launcher **không bao giờ in nội dung `.env*`** ra log (chứa secret).
- Mọi thao tác sửa file trong managed workspace (đổi `.env`, patch indexer) đều **idempotent + có backup**, không phá git working tree.
- Stop = kill **cả cây process** → Windows `taskkill /T /F`, macOS/Linux detached process group `SIGTERM` rồi `SIGKILL` nếu cần; mục tiêu là không để node/gulp/next mồ côi giữ port.

---

## Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Onboarding báo workspace root invalid/missing | Chọn đúng root: `sp-local-workspace` phải có `servers/selfpointrest` + `public`; `new-frontend` phải có `apps/stor-web` + `nx.json` hoặc `pnpm-lock.yaml`. |
| Windows PowerShell báo `npm.ps1 cannot be loaded because running scripts is disabled` | Chạy bằng `npm.cmd ...` thay vì `npm ...`, hoặc chỉnh Execution Policy theo policy của máy. Đây chỉ là vấn đề Windows/PowerShell; macOS/Linux dùng `npm`/`pnpm` bình thường. |
| App báo repo dirty khi Checkout/Pull | Vào repo tương ứng, tự `git status`, rồi commit/stash/discard thủ công. Launcher không tự overwrite thay đổi local. |
| Fetch/Pull lỗi network hoặc auth | Kiểm tra VPN, quyền Git remote, token/SSH key, rồi chạy lại Fetch/Pull. |
| Backend start lỗi DB/ES | Kiểm tra VPN đã connected thật chưa; nhập probe host/port nội bộ rồi bấm Check/Connect lại. |
| VPN client không mở | Windows: kiểm tra OpenVPN GUI hoặc nhập path đúng. macOS: cài Tunnelblick hoặc override `clientPath`. Linux: nhập lệnh/args phù hợp (`nmcli`, `openvpn3`, `openvpn`, v.v.) trong VPN panel. |
| `pnpm` không tìm thấy khi chạy stor-web | Chạy `corepack enable`, mở lại terminal/app, rồi thử lại. |
| Cài deps fail ở bower/gulp/Husky | Xem log trong DepsPanel, sửa nguyên nhân trong repo con, rồi bấm Retry hoặc Force reinstall. |
| Port bận (`EADDRINUSE`) | Dùng StatusTable/RunControls để Stop repo đang giữ port, hoặc tự kiểm bằng `netstat`. Với `mobile`/`collection`, chỉ chạy một repo trên port 9000. |
| Stop xong vẫn còn process node/gulp/next | Dùng **Stop all**. Nếu vẫn còn, kiểm tra Task Manager/Activity Monitor/`ps` và kill tay process mồ côi, rồi báo lại để kiểm tra runner. |
| selfpointrest không thấy `/backend`, `/kikar`, `/prutah` | Đảm bảo đã chọn build UI tương ứng trước khi start selfpointrest; kiểm tra `.env` có `clients_dir="../../public"`. |
| Không muốn đụng env thật khi test | Không bấm Apply env trong selfpointrest. EnvSelector chỉ đổi `.env` khi bấm Apply và luôn backup trước. |

---

## 5. Đóng gói cross-platform (tùy chọn)

`npm start` là cách chạy chính. **Không bắt buộc** đóng gói. Nếu muốn tạo app native, dùng [`electron-builder`](https://www.electron.build/) thủ công — hiện **không** thêm sẵn vào `package.json` để giữ launcher nhẹ.

```bash
# 1. Build renderer ra dist/renderer (production main process nạp file này)
npm run build:renderer

# 2. Đóng gói theo OS/target mong muốn
npx --yes electron-builder --win portable --config.directories.output=release --config.files="src/**/*" --config.files="dist/**/*" --config.files="package.json" --config.extraMetadata.main=src/main/main.js
npx --yes electron-builder --mac dmg --config.directories.output=release --config.files="src/**/*" --config.files="dist/**/*" --config.files="package.json" --config.extraMetadata.main=src/main/main.js
npx --yes electron-builder --linux AppImage --config.directories.output=release --config.files="src/**/*" --config.files="dist/**/*" --config.files="package.json" --config.extraMetadata.main=src/main/main.js
```

- Dùng `--win`, `--mac`, hoặc `--linux` theo nền tảng cần build; thực tế nên build target trên OS tương ứng, đặc biệt macOS nếu cần ký/notarize.
- Windows: `portable` tạo `.exe` chạy ngay; có thể đổi thành `nsis` nếu muốn bộ cài.
- macOS: ví dụ `dmg`; Linux: ví dụ `AppImage`.
- Lần đầu `electron-builder` tải binary nền tảng (vài trăm MB) nên có thể chậm. Output ở `release/`.
- Bản đóng gói chạy ở chế độ production (`app.isPackaged === true`) → nạp `dist/renderer/index.html` thay vì Vite dev server, nên **phải** chạy `build:renderer` trước.

> Nếu muốn cố định cấu hình đóng gói, có thể thêm khối `"build"` (electron-builder) vào `package.json` và devDep `electron-builder` sau.
