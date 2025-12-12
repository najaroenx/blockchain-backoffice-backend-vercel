## 📋 Description

<!-- อธิบายสิ่งที่เปลี่ยนแปลงในครั้งนี้ -->

## 🎯 Type of Change

- [ ] 🐛 Bug fix (การแก้ไข bug ที่ไม่ทำให้ระบบเดิมเสีย)
- [ ] ✨ New feature (เพิ่ม feature ใหม่)
- [ ] 💥 Breaking change (การเปลี่ยนแปลงที่ทำให้ระบบเดิมต้องปรับ)
- [ ] 📝 Documentation update
- [ ] ♻️ Refactoring
- [ ] 🔧 Configuration change
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix

## 🔄 API Changes

<!-- ถ้ามีการเปลี่ยนแปลง API ให้ระบุด้านล่าง -->

### New Endpoints
- [ ] ไม่มี endpoint ใหม่
- [ ] มี endpoint ใหม่ (โปรดระบุ):
  ```
  GET  /path/to/endpoint
  POST /path/to/endpoint
  ```

### Modified Endpoints
- [ ] ไม่มีการแก้ไข endpoint เดิม
- [ ] มีการแก้ไข (โปรดระบุ):
  ```
  GET /path/to/endpoint - เปลี่ยน response structure
  ```

### Removed Endpoints
- [ ] ไม่มีการลบ endpoint
- [ ] ลบ endpoint (โปรดระบุ):
  ```
  DELETE /deprecated/endpoint
  ```

### Request/Response Changes
<!-- ถ้ามีการเปลี่ยน structure ของ request/response ให้แสดงตัวอย่าง -->

**Before:**
```json
{
  "oldField": "value"
}
```

**After:**
```json
{
  "newField": {
    "nested": "value"
  }
}
```

## ⛓️ Blockchain Changes

- [ ] ไม่มีการเปลี่ยนแปลง Smart Contract interaction
- [ ] มีการเปลี่ยนแปลง (โปรดระบุ):
  - [ ] เพิ่ม/แก้ไข Contract ABI
  - [ ] เปลี่ยน Transaction flow
  - [ ] เพิ่ม/ลด Gas usage
  - [ ] เปลี่ยน Event listening

## 🗄️ Database Changes

- [ ] ไม่มีการเปลี่ยนแปลง schema
- [ ] มีการเปลี่ยนแปลง schema (migration):
  ```
  npx prisma migrate dev --name migration_name
  ```
- [ ] ต้อง seed ข้อมูลใหม่: `npx prisma db seed`

## 📱 Impact on Frontend/Mobile

<!-- สำคัญ! ให้ทีม Frontend/Mobile รับทราบ -->

- [ ] ไม่กระทบ Frontend/Mobile
- [ ] กระทบ Frontend/Mobile (โปรดแจ้ง):
  - [ ] ต้องอัปเดต API service
  - [ ] ต้องเปลี่ยน data model
  - [ ] ต้องเพิ่ม error handling
  - [ ] ต้องเปลี่ยน UI/UX flow

**รายละเอียด:**
<!-- อธิบายให้ชัดเจนว่า Frontend ต้องทำอะไร -->

## 🧪 Testing

- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] E2E tests passed (ถ้ามี)
- [ ] Manual testing completed
- [ ] Postman collection updated (ถ้ามี)

**Test scenarios:**
1. 
2. 

## 📸 Screenshots/Logs

<!-- ถ้ามี Postman response หรือ logs แสดงผลการทำงาน -->

## ✅ Checklist

- [ ] โค้ดผ่าน linting และ formatting
- [ ] เพิ่ม/อัปเดต tests
- [ ] เพิ่ม/อัปเดต documentation
- [ ] อัปเดต Swagger/API docs (ถ้ามี)
- [ ] อัปเดต README (ถ้าจำเป็น)
- [ ] ตรวจสอบ security vulnerabilities
- [ ] ตรวจสอบ performance impact
- [ ] Branch อัปเดตจาก `main`/`develop` แล้ว

## 🔗 Related Issues/PRs

<!-- ใส่ link ไปยัง issue หรือ PR ที่เกี่ยวข้อง -->

Closes #issue_number
Related to #pr_number

## 🚀 Deployment Notes

<!-- คำแนะนำพิเศษสำหรับ deployment (ถ้ามี) -->

- [ ] ต้อง run migration ก่อน deploy
- [ ] ต้อง update environment variables
- [ ] ต้อง restart services
- [ ] ต้อง clear cache
- [ ] ต้อง redeploy smart contracts

**Environment variables:**
```
NEW_ENV_VAR=value
```

## 📣 Release Notes

<!-- ข้อความสำหรับ changelog/release notes -->

**Added:**
- 

**Changed:**
- 

**Fixed:**
- 

**Removed:**
- 

---

## 👥 Reviewers

@frontend-team @qa-team @blockchain-team

**Note to reviewers:** 
<!-- ข้อความพิเศษถึง reviewer (ถ้ามี) -->