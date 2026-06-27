# Local Dev Launcher — AI Prompt Pack

Bộ **prompt + workflow** giúp **Claude Code** và **Codex** tự xây một app **"Local Dev Launcher"** — công cụ khởi động môi trường dev local cho hệ thống SelfPoint (switch branch → fetch/pull → cài deps → bật & chờ VPN → chọn env → build/run đúng thứ tự → stop/restart).

> ⚠️ Repo này **không chứa** launcher. Nó chứa *cách để AI tạo ra launcher*: một file context chuẩn + 3 vai trò (Leader/Coder/Reviewer) + tích hợp sẵn cho Claude Code và Codex. Stack của launcher sẽ do **Leader** đề xuất trong `plan.md`.

## Mô hình hoạt động

```
            ┌─────────┐   đọc CONTEXT + verify repo thực tế
            │ LEADER  │ ─────────────────────────────► plan.md  (chọn stack, chia task)
            └─────────┘
                 │  với mỗi task trong plan.md:
                 ▼
        ┌──────────────────┐      DONE      ┌──────────────────┐
        │  CODER  (làm 1    │ ─────────────► │ REVIEWER (review │
        │  task, tự verify) │ ◄───── FAIL ── │  → PASS/FAIL)    │
        └──────────────────┘   sửa & lặp     └──────────────────┘
                 │  lặp tới khi PASS, sang task tiếp theo
                 ▼
        Definition of Done trong plan.md
```

## Cấu trúc pack

```
local-starter/
├── README.md                  ← bạn đang đọc
├── CLAUDE.md                  ← Claude Code tự nạp
├── AGENTS.md                  ← Codex tự nạp
├── ai/
│   ├── CONTEXT.md             ← ⭐ NGUỒN SỰ THẬT: repo, lệnh, port, env, VPN, indexer, F1–F12
│   ├── prompts/
│   │   ├── 01-leader-plan.md  ← prompt Leader (→ plan.md)
│   │   ├── 02-coder.md        ← prompt Coder (1 task)
│   │   └── 03-reviewer.md     ← prompt Reviewer (1 task)
│   └── templates/
│       └── plan.template.md   ← khung plan.md
└── .claude/
    ├── commands/              ← /launcher-plan, /launcher-code, /launcher-review
    └── agents/                ← launcher-leader, launcher-coder, launcher-reviewer
```

**Một nguồn sự thật:** nội dung thật nằm ở `ai/CONTEXT.md` + `ai/prompts/*`. Các file `CLAUDE.md`, `AGENTS.md`, `.claude/*` chỉ trỏ tới chúng — sửa thì sửa ở `ai/`.

## Dùng với Claude Code

Chạy ở thư mục `local-starter/`:

1. `/launcher-plan` → sinh **`plan.md`** (Leader chọn stack + chia task).
2. Xem `plan.md`, lấy task id (vd `TA1`). Với mỗi task:
   - `/launcher-code TA1` → Coder làm.
   - `/launcher-review TA1` → Reviewer ra PASS/FAIL. FAIL → `/launcher-code TA1` lại.
3. Lặp theo "Thứ tự thực thi đề xuất" trong `plan.md`.

Có thể giao **subagent** chạy song song cho các task không phụ thuộc nhau:
> "Dùng subagent `launcher-coder` làm TB1 và TC1 song song, rồi `launcher-reviewer` review từng cái."

## Dùng với Codex

Codex tự đọc `AGENTS.md`. Vì không có slash command, bạn **paste prompt**:

1. Paste toàn bộ `ai/prompts/01-leader-plan.md` → Codex sinh `plan.md`.
2. Paste `ai/prompts/02-coder.md`, thay `<TASK-ID>` → làm task.
3. Paste `ai/prompts/03-reviewer.md`, thay `<TASK-ID>` → review.
4. Lặp tới Definition of Done.

## Bắt đầu nhanh

1. Mở `local-starter/` bằng Claude Code (hoặc Codex).
2. (Khuyến nghị) đọc lướt `ai/CONTEXT.md` để biết pack đã nắm gì về 10 repo của bạn.
3. Chạy `/launcher-plan` (Claude) hoặc paste `01-leader-plan.md` (Codex).
4. Mở `plan.md`, bắt đầu vòng Coder ↔ Reviewer.

## Hai workspace được launcher quản lý

| Workspace | Đường dẫn | PM | Branch mặc định |
|---|---|---|---|
| sp-local-workspace | `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` | npm (Node 20.18.0) | `master` |
| new-frontend | `C:\Users\TrungPhung\Downloads\repositories\new-frontend` | pnpm (Nx) | `new-frontend-dev-prod` |

Chi tiết 9 repo, port, env, VPN, indexer… xem `ai/CONTEXT.md`.

## Cập nhật pack

- Repo/lệnh/port đổi → sửa **`ai/CONTEXT.md`**.
- Quy trình/khung kế hoạch đổi → sửa `ai/prompts/*` hoặc `ai/templates/plan.template.md`.
- Không cần sửa `CLAUDE.md`/`AGENTS.md`/`.claude/*` (chỉ là wrapper trỏ tới `ai/`).
