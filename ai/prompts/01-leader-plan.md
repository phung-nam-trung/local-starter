# Prompt — LEADER (Planning → plan.md)

> **Cách dùng:** Paste toàn bộ nội dung dưới đây vào Claude Code hoặc Codex (hoặc dùng `/launcher-plan` trên Claude Code). Chạy ở thư mục `local-starter/`.

---

Bạn là **Tech Lead / Planner** cho dự án "Local Dev Launcher". Nhiệm vụ DUY NHẤT của bạn ở bước này là **lập kế hoạch** và **xuất ra file `plan.md`**. **TUYỆT ĐỐI KHÔNG viết code launcher** ở bước này (chỉ được tạo/sửa `plan.md`).

## Bối cảnh bắt buộc đọc trước

1. Đọc kỹ `ai/CONTEXT.md` — đây là nguồn sự thật. Nắm: 9 repo, đường dẫn, lệnh install/build/run, port & xung đột, branch mặc định, cơ chế `.env` selfpointrest, quan hệ "selfpointrest serve UI", indexer cần sửa code + restart, flow VPN, và đặc tả tính năng F1–F12.
2. Đọc khung `ai/templates/plan.template.md` — `plan.md` của bạn PHẢI theo đúng cấu trúc này.
3. **Verify thực địa:** mở README + `package.json` của các repo chính trong `C:\Users\TrungPhung\Downloads\repositories\...` để xác nhận lệnh còn đúng. Nếu lệch với CONTEXT → ưu tiên repo thực tế và ghi chú điểm lệch trong plan (mục Giả định & Rủi ro).

## Việc bạn phải làm

### Bước 1 — Chốt stack
So sánh ngắn gọn 3 phương án (**Electron** / **Web dashboard Node+browser** / **CLI/TUI**) theo các tiêu chí: phù hợp "app có UI chọn repo/branch + thông báo", khả năng quản lý nhiều **long-running process** trên Windows, gọi `git` + `openvpn-gui.exe`, stream log, tốc độ phát triển & bảo trì. **Chọn 1** và nêu lý do ngắn gọn, dứt khoát. (Điền bảng so sánh trong template.)

> Gợi ý cân nhắc (không bắt buộc theo): Electron hợp nhất với yêu cầu "app + native notification + 1 cửa sổ quản lý"; Web dashboard nhẹ và dễ iterate; CLI đơn giản nhưng yếu về "thông báo/UX chọn branch". Hãy tự quyết dựa trên đánh đổi.

### Bước 2 — Thiết kế kiến trúc
Mô tả ngắn: orchestrator quản lý process (spawn kèm `cwd`, lưu PID, **kill cả cây process** khi stop — xem CONTEXT §10.2), git layer, VPN layer, config store (F12), state model (stopped/installing/building/running/crashed).

### Bước 3 — Chia phase & task
Theo các phase trong template (Scaffold → Git/Branch → Deps → VPN → Env → Build/Run → Indexer/Restart → Stop/Status/Logs → Persist → Đóng gói). Mỗi task PHẢI:
- Có **id** (T<chữ phase><số>, vd `TA1`), mô tả 1 việc rõ ràng, **đủ nhỏ để 1 Coder làm trong một lượt**.
- Có **Acceptance** (đo được) và **Verify** (cách kiểm chứng cụ thể: lệnh gì, kỳ vọng gì).
- Ghi **Files** dự kiến đụng và **Deps** (task phụ thuộc).
- Bám sát đặc tả F1–F12 trong CONTEXT §11 và thứ tự build/run §12.

### Bước 4 — Hoàn thiện
Điền **Definition of Done**, **Giả định & Rủi ro**, **Thứ tự thực thi đề xuất**.

## Quy tắc

- Chỉ ghi ra **`plan.md`** ở thư mục `local-starter/`. Không tạo file khác, không viết code.
- Bám sát sự thật trong CONTEXT; mọi lệnh build/run phải khớp repo thực tế (đã verify ở Bước 0).
- Tôn trọng các "gotcha": đổi `.env` an toàn có backup, không log secret; xử lý trùng port 4000/9000; indexer cần sửa code + restart; VPN detect+poll; UI backend/frontend build-only do selfpointrest serve.
- Plan phải để một Coder **không có ngữ cảnh hội thoại** vẫn làm được từng task chỉ nhờ đọc `plan.md` + `ai/CONTEXT.md`.
- Viết bằng tiếng Việt (giữ thuật ngữ kỹ thuật/lệnh bằng English).

## Đầu ra

Một file **`plan.md`** hoàn chỉnh theo `ai/templates/plan.template.md`. Sau khi ghi xong, in ra màn hình: tóm tắt stack đã chọn + số lượng task mỗi phase + 3 task nên làm đầu tiên.
