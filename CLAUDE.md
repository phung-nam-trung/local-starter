# CLAUDE.md

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

# CLAUDE.md — Local Dev Launcher (AI prompt pack)

Repo này **không phải** launcher. Nó là **bộ prompt + workflow** để chính Claude Code (và Codex) xây ra launcher đó theo mô hình **Leader → plan.md → (Coder ↔ Reviewer)**.

## Đọc trước mọi việc
- **`ai/CONTEXT.md`** = nguồn sự thật duy nhất (9 repo, lệnh build/run, port & xung đột, `.env` selfpointrest, VPN, indexer, branch mặc định, đặc tả F1–F12). LUÔN đọc trước.
- Khung kế hoạch: `ai/templates/plan.template.md`.

## Quy trình (vòng lặp)
1. **Plan:** `/launcher-plan` → Leader đọc CONTEXT + verify README/package.json thực tế → chọn stack → ghi **`plan.md`**.
2. **Code:** `/launcher-code <TASK-ID>` (vd `/launcher-code TA1`) → Coder làm đúng 1 task, tự verify, tick `[x]`.
3. **Review:** `/launcher-review <TASK-ID>` → Reviewer ra **PASS/FAIL**. FAIL → quay lại bước 2 cho tới khi PASS.
4. Lặp 2–3 theo "Thứ tự thực thi đề xuất" trong `plan.md` tới Definition of Done.

## Subagents (chạy độc lập / song song)
`launcher-leader`, `launcher-coder`, `launcher-reviewer` (trong `.claude/agents/`). Có thể giao việc song song cho các task **không phụ thuộc nhau** (tôn trọng `Deps` trong `plan.md`).

## Handoff khi gần hết quota/context
- Khi Claude hoặc Codex gần hết quota/context (khoảng 99%), cập nhật `plan.md` với mốc rõ: `Codex/Claude đã làm đến <TASK-ID>`, task nào đã có Reviewer **PASS**, task nào chỉ mới tick nhưng cần review lại.
- Nếu user yêu cầu commit snapshot, commit sau khi đã ghi handoff vào `plan.md`; message commit phải nêu mốc tiến độ (vd `handoff: codex progress through TE1`).
- Không dựa mù quáng vào checkbox `[x]`: task chỉ đáng tin để làm tiếp khi có Reviewer **PASS** hoặc handoff note nói rõ cần review lại.
- Trước khi bàn giao, chạy verify tối thiểu có thể chạy an toàn (`node --check`, `npm.cmd run build:renderer`, hoặc smoke fixture); nếu không chạy được thì ghi rõ blocker/rủi ro.

## Ràng buộc bắt buộc (trích CONTEXT §10)
- **Windows/PowerShell**: path có space phải bọc nháy; stop phải **kill cả cây process** (`taskkill /T /F` / tree-kill).
- **Không log/commit secret**; không in nội dung `.env*`.
- Sửa trong `repositories/*` (đổi `.env`, patch indexer) phải **idempotent + backup**, không phá git working tree.
- **Không tự ý mở rộng phạm vi**; không `commit`/`push` trừ khi user yêu cầu.
- Lệnh build/run phải khớp **README + package.json thực tế** (verify, đừng tin trí nhớ).

## Hai workspace được quản lý (ngoài repo này)
- `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` (npm, Node 20.18.0) — mặc định branch **`master`**.
- `C:\Users\TrungPhung\Downloads\repositories\new-frontend` (pnpm, Nx) — mặc định branch **`new-frontend-dev-prod`**.
