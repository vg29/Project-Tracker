# Security Specification — AAI Desk

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `userId == request.auth.uid`, and `request.auth.token.email_verified == true` is required for all reads and writes.
2. `UserProfile.designation` is strictly locked to `"Assistant Manager (IT)"`.
3. Every `ProjectDocument` under `/users/{userId}/projects/{projectId}/documents/{docId}` must reference an existing parent project at `/users/{userId}/projects/{projectId}` on creation (`exists()`), with `data.projectId == projectId` and `fileSize <= 524288`.
4. If a `Task` specifies a non-empty `projectId`, that parent project must exist under `/users/{userId}/projects/{projectId}` on creation.
5. `ownerId` and `createdAt` are immutable across all updates; `createdAt` and `updatedAt` must match `request.time`.
6. No blanket reads (`allow list` checks `resource.data.ownerId == request.auth.uid`); all document IDs are validated with `isValidId()`.

## 2. Dirty Dozen Adversarial Payloads
1. **Unauthenticated read/write**: `auth == null` reading `/users/u1/tasks/t1` -> `PERMISSION_DENIED`.
2. **Unverified email write**: `auth.uid == 'u1', email_verified: false` creating project -> `PERMISSION_DENIED`.
3. **Cross-user access**: `auth.uid == 'u2'` reading `/users/u1/profile/info` -> `PERMISSION_DENIED`.
4. **Owner spoofing**: `u1` creating task with `ownerId: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow / ghost field**: `u1` creating task with extra `isAdmin: true` -> `PERMISSION_DENIED` (blocked by `hasOnly()`).
6. **Privilege / designation escalation**: `u1` creating/updating profile with `designation: "Director"` -> `PERMISSION_DENIED`.
7. **ID poisoning**: `u1` writing `/users/u1/tasks/bad$id..` -> `PERMISSION_DENIED` (blocked by `isValidId`).
8. **Orphaned document**: `u1` creating document under `/users/u1/projects/nonexistent/documents/rfp` -> `PERMISSION_DENIED`.
9. **Oversized file payload (DoW)**: `u1` uploading `ProjectDocument` with `fileSize: 9999999` or `dataUrl.size() > 750000` -> `PERMISSION_DENIED`.
10. **Client-spoofed timestamp**: `u1` creating project with `createdAt: "2020-01-01"` instead of `request.time` -> `PERMISSION_DENIED`.
11. **Immortal field mutation**: `u1` updating `task.ownerId` or `task.createdAt` -> `PERMISSION_DENIED`.
12. **Blanket list query**: `u2` listing `/users/u1/tasks` -> `PERMISSION_DENIED`.
