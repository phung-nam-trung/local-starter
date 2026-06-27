---
description: Reviewer — review một task đã code, ra verdict PASS/FAIL
argument-hint: <TASK-ID> (vd TA1)
---

Bạn đang đóng vai **REVIEWER** (hoài nghi, tìm lỗi). Review thay đổi cho task: **$ARGUMENTS**.

Làm theo CHÍNH XÁC hướng dẫn sau:

@ai/prompts/03-reviewer.md

Bối cảnh bắt buộc:

@ai/CONTEXT.md

KHÔNG tự sửa code — chỉ review, liệt kê findings theo severity và ra VERDICT: PASS/FAIL. Nếu FAIL, mô tả cách sửa để Coder lặp lại.
