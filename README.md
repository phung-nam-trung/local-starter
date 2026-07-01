# Local Dev Launcher — AI Prompt Pack

Bộ **prompt + workflow** cho **Claude Code** và **Codex**, kèm app Electron **"Local Dev Launcher"** đã được sinh trong repo này — công cụ khởi động môi trường dev local cho hệ thống SelfPoint (switch branch → fetch/pull → cài deps → bật & chờ VPN → chọn env → build/run đúng thứ tự → stop/restart).

> ⚠️ Repo này vẫn là **AI prompt pack** làm nguồn thật cho workflow Leader/Coder/Reviewer, đồng thời hiện có code launcher Electron trong `src/`. Tài liệu chạy app nằm ở `LAUNCHER.md`; tài liệu workflow AI nằm trong file này + `ai/`.

> 🚀 **Chỉ muốn CHẠY app launcher** (Electron) chứ không quan tâm AI pack? Xem [`LAUNCHER.md`](./LAUNCHER.md) — prerequisites theo OS (Node 20.x, Git, `corepack enable`, VPN client Windows/macOS/Linux), workspace roots configurable với fallback default, `npm install` → `npm start`, và đầy đủ tính năng F1–F12 + lưu ý port/VPN.

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
├── .claude/
    ├── commands/              ← /launcher-plan, /launcher-code, /launcher-review
    └── agents/                ← launcher-leader, launcher-coder, launcher-reviewer
└── .codex/
    └── agents/                ← launcher-leader, launcher-coder, launcher-reviewer
```

**Một nguồn sự thật:** nội dung thật nằm ở `ai/CONTEXT.md` + `ai/prompts/*`. Các file `CLAUDE.md`, `AGENTS.md`, `.claude/*`, `.codex/*` chỉ trỏ tới chúng — sửa thì sửa ở `ai/`.

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

Codex tự đọc `AGENTS.md`. Cách khuyến nghị là dùng sub-agent specs trong `.codex/agents/`:

1. `launcher-leader` → sinh `plan.md`.
2. `launcher-coder <TASK-ID>` → làm đúng một task.
3. `launcher-reviewer <TASK-ID>` → review task, ra PASS/FAIL.
4. Lặp tới Definition of Done.

Để tiết kiệm quota/ngữ cảnh: các spec Codex yêu cầu sub-agent tự đọc `ai/CONTEXT.md`, `plan.md`, và prompt nguồn; không cần fork toàn bộ hội thoại, không override model trừ khi bạn yêu cầu rõ. Có thể chạy song song nhiều `launcher-coder` chỉ khi task không phụ thuộc nhau và không đụng cùng file; reviewer chỉ chạy sau khi coder báo DONE.

Fallback nếu môi trường Codex không tự nạp `.codex/agents`: paste trực tiếp `ai/prompts/01-leader-plan.md`, `ai/prompts/02-coder.md` hoặc `ai/prompts/03-reviewer.md` như trước.

## Bắt đầu nhanh

1. Mở `local-starter/` bằng Claude Code (hoặc Codex).
2. (Khuyến nghị) đọc lướt `ai/CONTEXT.md` để biết pack đã nắm gì về 9 repo của bạn.
3. Chạy `/launcher-plan` (Claude) hoặc dùng `launcher-leader` (Codex).
4. Mở `plan.md`, bắt đầu vòng Coder ↔ Reviewer.

## Hai workspace được launcher quản lý

Launcher cho cấu hình 2 workspace root trong `WorkspaceSettings`. Nếu chưa cấu hình, app fallback về đường dẫn mặc định dưới đây để tương thích config cũ; onboarding chỉ chặn Start/Build/Install khi fallback hoặc root đã lưu không hợp lệ.

| Workspace | Persisted config field | Fallback mặc định | PM | Branch mặc định |
|---|---|---|---|---|
| sp-local-workspace | `workspaceRoots.spLocalWorkspace` | `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` | npm (Node 20.18.0) | `master` |
| new-frontend | `workspaceRoots.newFrontend` | `C:\Users\TrungPhung\Downloads\repositories\new-frontend` | pnpm (Nx) | `new-frontend-dev-prod` |

Chi tiết 9 repo, port, env, VPN, indexer… xem `ai/CONTEXT.md`.

## Cập nhật pack

- Repo/lệnh/port đổi → sửa **`ai/CONTEXT.md`**.
- Quy trình/khung kế hoạch đổi → sửa `ai/prompts/*` hoặc `ai/templates/plan.template.md`.
- Không cần sửa `CLAUDE.md`/`AGENTS.md`/`.claude/*`/`.codex/*` (chỉ là wrapper trỏ tới `ai/`).
