# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

# AGENTS.md — Local Dev Launcher (AI prompt pack)

> File này để Codex (và các agent khác) tự nạp. Claude Code dùng `CLAUDE.md` + `.claude/` với cùng nội dung.

Repo này **không phải** launcher mà là **bộ prompt/workflow** để xây launcher đó, theo mô hình **Leader → plan.md → (Coder ↔ Reviewer)**.

## Bắt buộc đọc trước
- **`ai/CONTEXT.md`** — nguồn sự thật duy nhất: 9 repo + đường dẫn + lệnh install/build/run + port & xung đột + `.env` selfpointrest + VPN + indexer + branch mặc định + đặc tả tính năng F1–F12. LUÔN đọc trước khi làm bất cứ gì.
- `ai/templates/plan.template.md` — khung của `plan.md`.

## Quy trình cho Codex
1. **Plan:** dùng sub-agent `launcher-leader` (spec: `.codex/agents/launcher-leader.md`) → verify README/`package.json` thực tế → chọn stack → ghi **`plan.md`**.
2. **Code:** dùng sub-agent `launcher-coder` với `<TASK-ID>` (vd `TA1`) → làm đúng 1 task → tick `[x]` trong `plan.md`.
3. **Review:** dùng sub-agent `launcher-reviewer` với `<TASK-ID>` → ra **PASS/FAIL**. FAIL → quay lại bước 2 tới khi PASS.
4. Lặp 2–3 theo "Thứ tự thực thi đề xuất" trong `plan.md`.

Nếu môi trường Codex không tự nạp `.codex/agents`, paste nội dung file agent tương ứng vào prompt sub-agent.

## Codex sub-agents & quota
- `launcher-leader`: spawn dạng `worker`, không fork toàn bộ hội thoại, chỉ được ghi `plan.md`.
- `launcher-coder`: spawn dạng `worker`, 1 task/sub-agent; chỉ chạy song song khi `Deps` đã xong và write-set không trùng nhau.
- `launcher-reviewer`: spawn dạng `explorer`, không sửa code; có thể review song song các task độc lập đã code xong.
- Để tối ưu quota Codex hiện có: không override model/reasoning/service tier trừ khi user yêu cầu rõ; để agent tự đọc `ai/CONTEXT.md`, `plan.md`, và prompt nguồn thay vì nhồi toàn bộ ngữ cảnh hội thoại.

## Ràng buộc bắt buộc (trích CONTEXT §10)
- **Windows/PowerShell**: path có space bọc nháy; stop phải **kill cả cây process** (`taskkill /T /F` hoặc tương đương).
- **Không** in/log/commit secret; không in nội dung `.env*`.
- Sửa trong `repositories/*` (đổi `.env`, patch indexer) phải **idempotent + backup**, không phá git working tree.
- Không mở rộng phạm vi; không `commit`/`push` trừ khi được yêu cầu.
- Lệnh build/run phải khớp **README + package.json thực tế** (verify, đừng tin trí nhớ).

## Hai workspace được quản lý (ngoài repo này)
- `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` (npm, Node 20.18.0) — branch mặc định **`master`**.
- `C:\Users\TrungPhung\Downloads\repositories\new-frontend` (pnpm, Nx) — branch mặc định **`new-frontend-dev-prod`**.
