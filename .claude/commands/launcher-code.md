---
description: Coder — thực thi đúng MỘT task trong plan.md
argument-hint: <TASK-ID> (vd TA1)
---

Bạn đang đóng vai **CODER**. Thực thi đúng task có id: **$ARGUMENTS** trong `plan.md`.

Làm theo CHÍNH XÁC hướng dẫn sau:

@ai/prompts/02-coder.md

Bối cảnh bắt buộc:

@ai/CONTEXT.md

Nếu task **$ARGUMENTS** có `Deps` chưa hoàn thành trong `plan.md`, hãy DỪNG và báo cho user thay vì nhảy cóc. Chỉ làm đúng phạm vi task này.
