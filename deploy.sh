#!/usr/bin/env bash
#
# deploy.sh — Auto cache-busting ก่อน push ขึ้น GitHub Pages
#
# วิธีใช้:
#   1. วางไฟล์นี้ไว้ที่ root ของ repo (โฟลเดอร์เดียวกับ index.html)
#   2. รัน: bash deploy.sh
#   3. สคริปต์จะ:
#        - สร้างเลขเวอร์ชันใหม่ (จาก git commit hash ถ้ามี, ไม่งั้นใช้ timestamp)
#        - เขียนเลขเวอร์ชันลง version.json
#        - แทนที่ ?v=... ท้ายไฟล์ assets/*.js และ assets/*.css ใน index.html
#        - commit + push ให้อัตโนมัติ (ถ้าอยู่ใน git repo)
#
# หมายเหตุ: ไฟล์จาก CDN ภายนอก (Chart.js, Firebase, Google Fonts ฯลฯ)
# ไม่ต้องแตะ เพราะ URL มี version อยู่แล้วในตัว (เช่น /4.4.1/ หรือ /10.12.0/)

set -e

INDEX_FILE="index.html"

if [ ! -f "$INDEX_FILE" ]; then
  echo "❌ ไม่พบ $INDEX_FILE ในโฟลเดอร์นี้ — รันสคริปต์จาก root ของ repo"
  exit 1
fi

# ---- 1. สร้างเลขเวอร์ชัน ----
if git rev-parse --short HEAD >/dev/null 2>&1; then
  VERSION=$(git rev-parse --short HEAD)-$(date +%H%M%S)
else
  VERSION=$(date +%Y%m%d%H%M%S)
fi

echo "🔖 เวอร์ชันใหม่: $VERSION"

# ---- 2. เขียน version.json ----
cat > version.json <<EOF
{
  "version": "${VERSION}",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
echo "✅ อัปเดต version.json แล้ว"

# ---- 3. แทนที่ ?v=... ในไฟล์ local ทุกไฟล์ (js/css ใต้ assets/) ----
sed -i -E "s#(assets/[a-zA-Z0-9_.-]+\.(js|css))(\?v=[^\"']*)?#\1?v=${VERSION}#g" "$INDEX_FILE"
echo "✅ อัปเดต cache-busting ใน $INDEX_FILE แล้ว"

# ---- 4. commit + push (ข้ามได้ด้วย SKIP_PUSH=1 bash deploy.sh) ----
if [ -z "$SKIP_PUSH" ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add "$INDEX_FILE" version.json
  git commit -m "deploy: bump cache version to ${VERSION}" || echo "ℹ️ ไม่มีอะไรเปลี่ยนให้ commit"
  git push
  echo "🚀 push ขึ้น GitHub Pages แล้ว รอสัก 1-2 นาทีให้ CDN อัปเดต"
else
  echo "ℹ️ ข้ามขั้นตอน commit/push (ไม่ได้อยู่ใน git repo หรือกำหนด SKIP_PUSH=1)"
fi
