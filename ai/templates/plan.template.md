<!--
KHUNG CHUẨN cho plan.md — Leader PHẢI xuất theo đúng cấu trúc này.
- Giữ nguyên các heading.
- Mỗi task là một checkbox `- [ ] T<id>` kèm Acceptance + Verify.
- Coder sẽ tick `[x]` khi xong; Reviewer kiểm tra Acceptance.
- Xóa các comment <!-- ... --> trong bản plan.md cuối cùng nếu muốn cho gọn.
-->

# Plan — Local Dev Launcher

> Sinh bởi Leader. Nguồn ngữ cảnh: `ai/CONTEXT.md` + README/`package.json` thực tế của các repo.
> Ngày tạo: <YYYY-MM-DD> · Tác giả: Leader (AI)

## 0. Tóm tắt

<2–4 câu: launcher làm gì, cho ai, đầu ra cuối cùng là gì.>

## 1. Stack đã chọn (kèm lý do)

| Tiêu chí | Electron | Web dashboard (Node+browser) | CLI/TUI |
|---|---|---|---|
| Phù hợp "app + thông báo" | | | |
| Độ phức tạp build | | | |
| Quản lý nhiều process | | | |
| Tốc độ phát triển | | | |

**Lựa chọn: `<stack>`.**
**Lý do:** <2–4 câu vì sao thắng các phương án khác, gắn với yêu cầu trong CONTEXT (UI chọn repo/branch, stream log, gọi git + openvpn-gui, quản lý long-running process trên Windows).>

**Thư viện/khung chính dự kiến:** <vd Electron + Vite + React; hoặc Express + WebSocket + HTML; ... + thư viện git, tree-kill, ...>

## 2. Kiến trúc tổng quan

<Sơ đồ/đoạn mô tả ngắn: tiến trình chính, cách spawn & theo dõi process con, nơi lưu config, luồng dữ liệu UI ↔ orchestrator.>

- **Process orchestrator:** <cách spawn/track/kill cây process trên Windows>
- **Git layer:** <thư viện hoặc gọi `git` CLI>
- **VPN layer:** <cách detect + mở openvpn-gui + poll>
- **Config store:** <nơi lưu lựa chọn của user — F12>
- **State model:** <các trạng thái repo: stopped/installing/building/running/crashed>

## 3. Phases & Tasks

> Quy ước: `- [ ] T<id>: <việc>` · `Acceptance:` (điều kiện nghiệm thu, đo được) · `Verify:` (cách kiểm chứng cụ thể) · `Files:` (file/khu vực dự kiến đụng) · `Deps:` (task phụ thuộc).

### Phase A — Scaffold dự án
- [ ] **TA1: <khởi tạo project theo stack đã chọn>**
  - Acceptance: <vd app build & mở được cửa sổ rỗng / server lên port X>
  - Verify: <lệnh chạy + kết quả mong đợi>
  - Files: <...>
  - Deps: —

### Phase B — Git & Branch (F2, F3)
- [ ] **TB1: <list/fetch/checkout/pull an toàn, preselect branch mặc định master / new-frontend-dev-prod>**
  - Acceptance: <...>
  - Verify: <...>

### Phase C — Dependencies (F4)
- [ ] **TC1: <cài khi thiếu cho npm (sp-local-workspace) & pnpm root (new-frontend); xử lý postinstall + Husky>**
  - Acceptance / Verify: <...>

### Phase D — VPN (F5)
- [ ] **TD1: <detect → mở openvpn-gui → poll tới khi kết nối; cho phép skip nếu chỉ chạy UI>**
  - Acceptance / Verify: <...>

### Phase E — Env selfpointrest (F6)
- [ ] **TE1: <chọn prod/test, backup .env, copy → .env, đảm bảo clients_dir, không log secret>**
  - Acceptance / Verify: <...>

### Phase F — Build & Run (F7)
- [ ] **TF1: <selfpointrest: buildAll + (build UI backend/frontend nếu chọn) + start 3000>**
- [ ] **TF2: <loyalty / token-service / indexer: start + override PORT khi trùng 4000>**
- [ ] **TF3: <mobile / collection (9000) + stor-web (3002, pnpm nx serve)>**
  - Acceptance / Verify cho từng task: <...>

### Phase G — Indexer edits + Restart (F8, F10)
- [ ] **TG1: <hỗ trợ sửa test/products.js & test/specials.js (mở file hoặc patch preset có backup) + restart>**
  - Acceptance / Verify: <...>

### Phase H — Stop & Status & Logs (F9, F11)
- [ ] **TH1: <stop all (kill cây process, giải phóng port) + stream log + bảng trạng thái>**
  - Acceptance / Verify: <...>

### Phase I — Persist config (F12)
- [ ] **TI1: <lưu/khôi phục lựa chọn repo/branch/env/port/VPN probe>**

### Phase J — Đóng gói & tài liệu
- [ ] **TJ1: <script chạy/đóng gói + README sử dụng>**

## 4. Definition of Done

- [ ] Tất cả F1–F12 trong `ai/CONTEXT.md` §11 đạt.
- [ ] Khởi động được ≥1 backend (selfpointrest) + ≥1 UI từ launcher.
- [ ] Stop all dừng sạch, không còn process/port treo.
- [ ] Restart indexer hoạt động sau khi sửa code.
- [ ] Không log secret; không sửa ngoài phạm vi.
- [ ] README chạy được từ máy sạch.

## 5. Giả định & Rủi ro

| Giả định | Nếu sai thì |
|---|---|
| Branch mặc định tồn tại | fallback picker (CONTEXT §4) |
| VPN probe host do user cấu hình | hướng dẫn user nhập trong onboarding |
| Node 20.x + pnpm corepack sẵn sàng | kiểm tra & cảnh báo (CONTEXT §10.5) |

| Rủi ro | Giảm thiểu |
|---|---|
| Kill process con sót trên Windows | dùng tree-kill/taskkill /T (CONTEXT §10.2) |
| Postinstall/Husky lỗi | bắt lỗi, hiển thị log, cho retry |
| Trùng port 4000/9000 | override PORT + kiểm tra port bận (CONTEXT §8) |

## 6. Thứ tự thực thi đề xuất

<Liệt kê task theo thứ tự nên làm, tôn trọng Deps. Ưu tiên: scaffold → orchestrator core → git → deps → run 1 repo end-to-end → mở rộng → VPN/env/indexer → stop/restart → UI/UX → đóng gói.>
