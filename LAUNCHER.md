# 🚀 Local Dev Launcher — Hướng dẫn chạy app

> App desktop (Electron + React/Vite) để khởi động & quản lý môi trường dev local của SelfPoint từ **một cửa sổ**: chọn repo → chọn branch → fetch/pull → cài deps → bật & chờ VPN → chọn env cho selfpointrest → build/run đúng thứ tự → stream log → **stop/restart**.
>
> File này dành cho **người dùng launcher** (chạy app). Phần *AI prompt pack* (Leader/Coder/Reviewer) nằm ở [`README.md`](./README.md) — không liên quan tới việc chạy app.

---

## 1. Yêu cầu môi trường (Prerequisites)

Chạy trên **Windows** (đã test trên Windows 11). Cần chuẩn bị:

| Thành phần | Yêu cầu | Ghi chú |
|---|---|---|
| **Node.js** | **20.x** | `sp-local-workspace` cần đúng **20.18.0**; `new-frontend` cần 20+. Nếu dùng nvm-windows, switch về 20.x trước khi mở app. |
| **pnpm** | bật qua `corepack enable` | `new-frontend` (stor-web) dùng `pnpm`. Chạy `corepack enable` một lần trong PowerShell (Admin) để có `pnpm` trên PATH. |
| **Git** | có trên PATH | Launcher gọi `git` CLI trực tiếp (fetch/checkout/pull/branch). |
| **OpenVPN GUI** | `C:\Program Files\OpenVPN\bin\openvpn-gui.exe` | Backend cần VPN (Azure VPN) để truy cập DB/ES nội bộ. |
| **File `.ovpn`** | **xin từ đồng đội** | Launcher **KHÔNG** tự import config VPN. Tải Azure VPN client + lấy file `.ovpn` từ team, import vào OpenVPN GUI thủ công một lần. Sau đó launcher chỉ **detect / mở GUI / chờ kết nối**. |

> ⚠️ Thư mục `C:\Program Files\OpenVPN\config\` thường rỗng lúc đầu — phải tự import `.ovpn` (xem README của `sp-local-workspace`). Đây là bước **một lần**, ngoài phạm vi launcher.

Hai workspace mà launcher quản lý (đường dẫn cố định trong registry):

| Workspace | Đường dẫn | PM | Branch mặc định |
|---|---|---|---|
| sp-local-workspace | `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` | npm | `master` |
| new-frontend | `C:\Users\TrungPhung\Downloads\repositories\new-frontend` | pnpm (Nx) | `new-frontend-dev-prod` |

---

## 2. Cài đặt & chạy (từ máy sạch)

```powershell
# 1. Vào thư mục launcher
cd C:\Users\TrungPhung\Downloads\personal-trung-phung\local-starter

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
2. Kiểm tra danh sách repo ở cột trái. Nếu không thấy đủ 9 repo, kiểm tra lại 2 workspace:
   - `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace`
   - `C:\Users\TrungPhung\Downloads\repositories\new-frontend`
3. Chọn repo muốn chạy. Click vào từng repo để mở panel chi tiết ở cột phải.
4. Ở **Branch**, bấm **Fetch**, chọn branch cần dùng, rồi **Checkout/Pull**. Nếu app báo repo đang dirty, hãy commit/stash thủ công trong repo đó trước.
5. Ở **Deps**, bấm **Check deps**. Nếu thiếu hoặc stale, bấm **Install if needed**. Dùng **Force reinstall** khi muốn ép cài lại.
6. Nếu chạy backend, vào **VPN**, nhập probe host/port nội bộ nếu có, bấm **Check** hoặc **Connect**, đăng nhập OpenVPN khi GUI mở lên. Nếu chỉ chạy UI thuần, có thể bấm **Skip**.
7. Nếu chạy `selfpointrest`, vào **Env - selfpointrest**, chọn `prod` hoặc `test`, rồi bấm **Apply env**.
8. Vào **Run**, chọn tùy chọn build cần thiết rồi bấm **Build & Start**. Theo dõi log ngay trong app.
9. Khi xong việc, dùng **Stop** cho từng repo hoặc **Stop all** để dừng toàn bộ process con.

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
| **F1** | Chọn repo | StatusTable + RepoList | Danh sách 9 repo, nhóm theo workspace; chọn 1 hoặc nhiều repo để vận hành. |
| **F2** | Chọn branch | BranchPicker (mỗi repo) | Picker hiển thị branch local + remote, **preselect** mặc định (`master` / `new-frontend-dev-prod`); nếu default không tồn tại → chọn từ list thật. |
| **F3** | Fetch & Pull | BranchPicker | `git fetch --all --prune` → checkout → pull **an toàn** (chỉ pull khi working tree sạch; bẩn → cảnh báo, không overwrite). |
| **F4** | Install deps | DepsPanel | Cài **khi thiếu/stale** (npm trong từng repo `sp`; `pnpm install` ở **root** `new-frontend`); nút **force reinstall**; stream output; báo lỗi rõ nếu postinstall (gulp buildAll/bower) hoặc Husky fail. |
| **F5** | VPN | VpnStatus | Detect VPN (probe TCP `host:port` nội bộ — **bạn tự nhập** host probe; fallback `Get-NetAdapter`). Nếu down → mở `openvpn-gui.exe` + **native notification** "Hãy đăng nhập VPN" + poll tới khi up. Có nút **Skip** (chỉ chạy UI thì không cần VPN). |
| **F6** | Env selfpointrest | EnvSelector | Chọn **prod / test** (mặc định **prod**) → backup `.env` hiện tại (`.env.bak-<timestamp>`) → copy `.env-prod`/`.env-test` → `.env`; đảm bảo `clients_dir="../../public"`. **Không in nội dung `.env` ra log.** |
| **F7** | Build & Run | RunControls | Build/run đúng thứ tự. selfpointrest: install→`buildAll`→(tùy chọn build UI Back Office/Kikar/Prutah qua script selfpointrest)→`npm start` (3000). Override `PORT` khi trùng. |
| **F8** | Indexer edits | IndexerPanel | Mở `test/products.js` & `test/specials.js` bằng editor mặc định, **và/hoặc** nhập preset (retailerId / productIds / special) → patch **idempotent + backup**; nút **Restart** indexer. |
| **F9** | Stop all | StatusTable / RunControls | Dừng **toàn bộ** process đã start (kill **cả cây process** bằng `taskkill /T /F`), giải phóng port. |
| **F10** | Restart | RunControls / IndexerPanel | Restart từng repo (đặc biệt indexer: kill cây cũ → start lại với `--max-old-space-size=3000`). |
| **F11** | Log & trạng thái | RunControls (log stream) + StatusTable | Mỗi repo stream stdout/stderr realtime; bảng trạng thái hiện state (`stopped/installing/building/running/crashed`) + port + branch. Process tự chết → state chuyển `crashed`. |
| **F12** | Lưu cấu hình | tự động (store.js) | Nhớ lựa chọn lần trước (repo, branch, env, port override, VPN probe host) trong `userData` → mở lại app khôi phục đúng. |

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
- VPN probe **host:port** do bạn nhập (vd host DB/ES nội bộ) — không hardcode. Launcher chỉ detect + mở GUI + chờ; **không** tự import `.ovpn`.

**An toàn:**

- Launcher **không bao giờ in nội dung `.env*`** ra log (chứa secret).
- Mọi thao tác sửa file trong `repositories/*` (đổi `.env`, patch indexer) đều **idempotent + có backup**, không phá git working tree.
- Stop = kill **cả cây process** (`taskkill /T /F`) → không để node/gulp/next mồ côi giữ port.

---

## Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| PowerShell báo `npm.ps1 cannot be loaded because running scripts is disabled` | Chạy bằng `npm.cmd ...` thay vì `npm ...`, hoặc chỉnh Execution Policy theo policy của máy. |
| App báo repo dirty khi Checkout/Pull | Vào repo tương ứng, tự `git status`, rồi commit/stash/discard thủ công. Launcher không tự overwrite thay đổi local. |
| Fetch/Pull lỗi network hoặc auth | Kiểm tra VPN, quyền Git remote, token/SSH key, rồi chạy lại Fetch/Pull. |
| Backend start lỗi DB/ES | Kiểm tra VPN đã connected thật chưa; nhập probe host/port nội bộ rồi bấm Check/Connect lại. |
| OpenVPN GUI không mở | Kiểm tra đường dẫn `C:\Program Files\OpenVPN\bin\openvpn-gui.exe`; nếu cài chỗ khác, nhập path đúng trong VPN panel. |
| `pnpm` không tìm thấy khi chạy stor-web | Chạy `corepack enable`, mở lại terminal/app, rồi thử lại. |
| Cài deps fail ở bower/gulp/Husky | Xem log trong DepsPanel, sửa nguyên nhân trong repo con, rồi bấm Retry hoặc Force reinstall. |
| Port bận (`EADDRINUSE`) | Dùng StatusTable/RunControls để Stop repo đang giữ port, hoặc tự kiểm bằng `netstat`. Với `mobile`/`collection`, chỉ chạy một repo trên port 9000. |
| Stop xong vẫn còn process node/gulp/next | Dùng **Stop all**. Nếu vẫn còn, kiểm tra Task Manager và kill tay process mồ côi, rồi báo lại để kiểm tra runner. |
| selfpointrest không thấy `/backend`, `/kikar`, `/prutah` | Đảm bảo đã chọn build UI tương ứng trước khi start selfpointrest; kiểm tra `.env` có `clients_dir="../../public"`. |
| Không muốn đụng env thật khi test | Không bấm Apply env trong selfpointrest. EnvSelector chỉ đổi `.env` khi bấm Apply và luôn backup trước. |

---

## 5. Đóng gói thành app Windows (tùy chọn)

`npm start` là cách chạy chính. **Không bắt buộc** đóng gói. Nếu muốn ra file `.exe` chạy độc lập, dùng [`electron-builder`](https://www.electron.build/) — **không** thêm sẵn vào `package.json` để giữ launcher nhẹ.

```powershell
# 1. Build renderer ra dist/renderer (production main process nạp file này)
npm run build:renderer

# 2. Đóng gói (không lưu vào devDependencies)
npx --yes electron-builder --win portable --config.directories.output=release `
  --config.files="src/**/*" --config.files="dist/**/*" --config.files="package.json" `
  --config.extraMetadata.main=src/main/main.js
```

- Target `portable` → 1 file `.exe` chạy ngay; đổi `--win portable` thành `--win nsis` nếu muốn bộ cài.
- ⚠️ Lần đầu `electron-builder` tải binary nền tảng (vài trăm MB) → chậm. Output ở `release/`.
- Bản đóng gói chạy ở chế độ production (`app.isPackaged === true`) → nạp `dist/renderer/index.html` thay vì Vite dev server, nên **phải** chạy `build:renderer` trước.

> Nếu muốn cố định cấu hình đóng gói, có thể thêm khối `"build"` (electron-builder) vào `package.json` và devDep `electron-builder` sau — hiện chưa thêm để tránh dep nặng.
