# Lab 3 — Peer Review Record

**Author:** Thanawat Suntarawattana — 67070501022 — GitHub: [@Maibokdaimhai](https://github.com/Maibokdaimhai)  
**Peer reviewer:** Tanadet Nuchaikaew — 67070501081 — GitHub: [@Kawi-HBLI](https://github.com/Kawi-HBLI)  
**Partner I reviewed:** Songwit Rueangsawat — 67070501060 — GitHub: [@R1NNE0](https://github.com/R1NNE0)

---

## Pull Requests I Authored (Reviewed by Partner)

| PR # | Feature Branch | Summary | Reviewer Verdict |
| :--- | :--- | :--- | :--- |
| #34 | `feature/lab3-spec-and-tests` | Add Sprint 3 engineering specification, test plan, UI spec, and API spec (Issue #25). | Merged into lab3-staging; final review comment pending recording |
| Pending | `refactor/lab3-backend-layers` | Separate backend layers while preserving Lab 2 behavior (Issue #26). | Pending review |

---

### PR #34: `docs(lab-03): define Sprint 3 engineering contract and test plan`

- **PR Link:** https://github.com/Maibokdaimhai/TokTickIT/pull/34
- **Reviewer Comment I Received(1):**
  ```text
  Reviewed all four planning documents against the Lab 3 worksheet. The main requirements, authorization matrix, status transitions, migration approach, and AC traceability are covered.
  Please address these contract gaps before implementation:

  1. Document the required seed account counts and representative tickets, public comments, and internal notes from Section 5.3, with verification coverage.
  2. Define how IT Staff retrieve eligible active owners for reassignment; /admin/users is Administrator-only.
  3. Explicitly define Staff/Admin attachment download and metadata access; the current attachment routes are Requester-only.
     Please update the relevant specifications and planned tests accordingly.
  ```
- **How I responded(1):**
  ```text
  Thank you for the review. I addressed all three gaps in commit e7c6dbf, pushed to feature/lab3-spec-and-tests:

  1. Documented the required seed account counts and representative tickets, public comments, and internal notes, with seed verification and rerun coverage.
  2. Defined GET /api/staff/eligible-owners for IT Staff/Admin reassignment choices, including active-role filtering and server-side revalidation.
  3. Defined Staff/Admin read-only attachment metadata and download access, preserving Requester ownership checks and removed-file restrictions.
     I also cross-checked the specifications and planned tests for consistency. Implementation tests remain marked Planned; documentation checks passed.
     Please review the updated contract when you have a moment.
  ```
- **Reviewer Comment I Received(2):**
  ```text
  Reviewed the latest updates. All requested changes have been addressed, and the contracts and test coverage are clear and consistent. Approved.
  ```
- **How I responded(1):**
  ```text
  Thank mak mak merge hai noi
  ```

---

### PR (number pending): `refactor(server): establish layered backend architecture for Lab 3`

- **PR Link:** Pending user-created PR from `refactor/lab3-backend-layers` to `lab3-staging` (Issue #26).
- **Reviewer Comment I Received(1):**
  ```text
  Pending actual review.
  ```
- **How I responded(1):**
  ```text
  Pending actual response posted by the author.
  ```

---

## Pull Requests I Reviewed for My Partner

### PR: Pending

- **Link PR:** Pending.
- **My comment:**
  ```text
  Pending actual review.
  ```
- **Partner's response:**
  ```text
  Pending actual response.
  ```
