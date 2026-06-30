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

## 5. Main Agent Plans, Sub-Agents Implement

**The main agent never writes code. It plans, delegates, and verifies.**

For every task:
- Produce a technical plan first: requirements, affected files/components, approach, risks or edge cases.
- Do not write or edit implementation code yourself, no matter how small the change looks.
- Delegate execution to a coder sub-agent. Hand it a clear brief: scope, files to touch, and the success criteria from Section 4.
- Review the sub-agent's output against the plan and success criteria. If something's wrong, send it back with specific feedback - don't fix it yourself.
The main agent's job ends at the plan and the review. Implementation always happens in a sub-agent.

## 6. Token Optimization Policy

**Use the smallest model that can do the job.**

| Role | Default model | Override to larger when |
|------|--------------|------------------------|
| Leader | opus | Always — orchestration needs full reasoning |
| Coder | sonnet | Task requires deep multi-file reasoning |
| Reviewer | sonnet | Simple diff review; use opus for security/arch reviews |

Rules:
- Pass only the context the sub-agent needs. Never dump entire repo into an agent call.
- Leader writes a scoped brief (affected files, acceptance criteria) — not a full transcript.
- Coder reads only the files listed in its brief plus what `git diff` shows.
- Reviewer reads only the diff + the acceptance criteria section of plan.md.
- Prefer one focused agent call over multiple exploratory ones.

## 7. Claude/Codex Handoff

**Stop cleanly before quota or token exhaustion.**

- Both Claude and Codex must check remaining usage/quota/token before starting, before long-running work, and before finalizing.
- If remaining quota/token is low, stop at a safe boundary before exhaustion. Do not begin new risky edits.
- Before handing off, update `plan.md` with `Codex đã hoàn thành [...]` or `Claude đã hoàn thành [...]`, completed work, remaining work, touched files, verification, commit/push status, and exact next steps for the other agent.
- If there are local safe completed changes, commit and push them before handoff. If blocked by caller instruction, credentials, conflicts, or unsafe unrelated changes, record that status in `plan.md`.
- The receiving agent must read `plan.md`, inspect `git status --short --branch`, and sync from remote (`git fetch`, then pull/rebase as appropriate) before editing.
- To avoid conflicts, claim the current task/files in `plan.md`; after a handoff, do not edit the same file/section without reading the latest note.

## 8. Karpathy Guidelines (Kim Chỉ Nam)

All agents follow the Karpathy coding principles as the operating compass:

- **Don't over-engineer.** Solve the stated problem, nothing more.
- **Make it work first, then make it right.** Ship a simple correct solution before optimizing.
- **Read the code, not just the spec.** Understand what exists before changing it.
- **Surgical edits.** Change the minimum number of lines needed.
- **Verify with evidence.** Run tests, check output — don't assume it works.
- **Name things clearly.** Good names eliminate the need for comments.
- **Surface uncertainty.** If something is unclear, stop and ask rather than guess.

Reference: https://github.com/multica-ai/andrej-karpathy-skills

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

## Handoff khi gần hết quota
- Khi Codex/Claude gần hết quota hoặc context (khoảng 99%), PHẢI cập nhật `plan.md` với mục handoff ngắn: `Codex/Claude đã làm đến <TASK-ID>`, task nào đã có Reviewer `PASS`, task nào chỉ mới tick nhưng cần review lại.
- Nếu user yêu cầu commit snapshot, commit sau khi đã ghi handoff vào `plan.md`; message commit phải nêu mốc tiến độ (vd `handoff: codex progress through TE1`).
- Không tin checkbox `[x]` một cách mù quáng: task chỉ được coi là sẵn sàng để agent kế tiếp dựa vào khi có báo cáo Reviewer `PASS` hoặc handoff note nói rõ cần review lại.
- Trước khi bàn giao cho agent khác, chạy verify tối thiểu có thể chạy an toàn (`node --check`, `npm.cmd run build:renderer`, hoặc smoke temp fixture); nếu không chạy được thì ghi blocker/rủi ro vào `plan.md`.

## Ràng buộc bắt buộc (trích CONTEXT §10)
- **Windows/PowerShell**: path có space bọc nháy; stop phải **kill cả cây process** (`taskkill /T /F` hoặc tương đương).
- **Không** in/log/commit secret; không in nội dung `.env*`.
- Sửa trong `repositories/*` (đổi `.env`, patch indexer) phải **idempotent + backup**, không phá git working tree.
- Không mở rộng phạm vi; không `commit`/`push` trừ khi được yêu cầu.
- Lệnh build/run phải khớp **README + package.json thực tế** (verify, đừng tin trí nhớ).

## Hai workspace được quản lý (ngoài repo này)
- `C:\Users\TrungPhung\Downloads\repositories\sp-local-workspace` (npm, Node 20.18.0) — branch mặc định **`master`**.
- `C:\Users\TrungPhung\Downloads\repositories\new-frontend` (pnpm, Nx) — branch mặc định **`new-frontend-dev-prod`**.
