---
name: ⬆️ Version Upgrade
about: เสนอการ upgrade version ของ dependency, framework, runtime หรือ system component
title: "[Upgrade] <package/system> from vX.Y.Z → vA.B.C"
labels: ["upgrade", "dependencies"]
assignees: []
---

## 🎯 Target

| Item | Current | Target |
| --- | --- | --- |
| Package / System | `<name>` | `<name>` |
| Version | `vX.Y.Z` | `vA.B.C` |
| Release Date | `YYYY-MM-DD` | `YYYY-MM-DD` |

**References:**
- Changelog: <!-- url -->
- Migration Guide: <!-- url -->
- Security Advisory (ถ้ามี): <!-- url -->

---

## 📌 Motivation

<!-- เหตุผลที่ต้อง upgrade -->
- [ ] 🔒 Security patch / CVE fix
- [ ] 🐛 Bug fix ที่กระทบ production
- [ ] ✨ ต้องใช้ feature ใหม่
- [ ] 📅 End of Life (EOL) ของ version ปัจจุบัน
- [ ] ⚡ Performance improvement
- [ ] 🧹 Tech debt / keep up to date

**รายละเอียด:**
<!-- อธิบายเพิ่มเติม -->

---

## 🔍 Scope & Impact

**Modules / Files ที่คาดว่าจะกระทบ:**
- [ ] `src/modules/...`
- [ ] `prisma/schema.prisma`
- [ ] `test/...`
- [ ] `docker-compose.yml` / `Dockerfile`
- [ ] CI/CD (`.github/workflows/`)

**Breaking Changes:**
<!-- list breaking changes จาก migration guide -->
1. 
2. 

---

## ⚠️ Risk Assessment

| Aspect | Level (Low/Med/High) | Note |
| --- | --- | --- |
| Code Change Surface | | |
| Runtime Behavior | | |
| Data Migration Needed | | |
| Downtime Required | | |

---

## 🔄 Rollback Plan

<!-- ถ้า upgrade fail หลัง deploy จะ revert ยังไง -->
- [ ] Revert commit + redeploy ภายใน X นาที
- [ ] Restore DB จาก backup (ถ้ามี migration)
- [ ] เอกสาร runbook: <!-- link -->

---

## ✅ Acceptance Criteria

- [ ] Build ผ่าน (`npm run build`)
- [ ] Unit tests ผ่านครบ (`jest --coverage`)
- [ ] Coverage ไม่ลดจาก baseline
- [ ] E2E tests ผ่าน (`app.e2e-spec.ts`)
- [ ] Docker build สำเร็จ
- [ ] ทดสอบบน dev environment แล้ว
- [ ] อัปเดต `CHANGELOG.md`
- [ ] อัปเดต documentation ใน `docs/` (ถ้าจำเป็น)

---

## 📋 Implementation Plan

1. [ ] สร้าง branch `upgrade/<package>-<version>`
2. [ ] Bump version + แก้ breaking changes
3. [ ] รัน test ครบทุก suite
4. [ ] เปิด PR (link issue นี้ด้วย `Closes #<num>`)
5. [ ] Code review
6. [ ] Deploy → staging → production
7. [ ] Monitor 24-48 ชม.

---

## 🔗 Related

- Related issues: #
- Related PRs: #
- Milestone: <!-- e.g. phase-2 -->
