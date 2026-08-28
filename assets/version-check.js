/**
 * version-check.js
 * -----------------
 * ตรวจสอบเวอร์ชันของเว็บเทียบกับ version.json บน server
 * ถ้าไม่ตรงกัน (มีเวอร์ชันใหม่กว่า) จะล้างแคชที่เกี่ยวข้องแล้ว reload หน้าอัตโนมัติ
 * เพื่อให้ผู้ใช้ทุกเครื่องเห็นข้อมูล/โค้ดชุดล่าสุดตรงกันเสมอ
 *
 * วิธีติดตั้ง: ใส่ <script src="assets/version-check.js"></script>
 * เป็น script แรกสุดใน <head> หรือต้นๆ ของ <body> (ก่อน app-core.js อื่นๆ)
 */
(function () {
  var STORAGE_KEY = "dlf_app_version";
  var RELOAD_FLAG_KEY = "dlf_app_reloading";

  // กัน infinite reload loop กรณี version.json เข้าไม่ถึงหรือ error ซ้ำๆ
  if (sessionStorage.getItem(RELOAD_FLAG_KEY) === "1") {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
    return;
  }

  // ใส่ timestamp กัน request นี้เองโดนแคช
  fetch("version.json?t=" + Date.now(), { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("version.json fetch failed: " + res.status);
      return res.json();
    })
    .then(function (data) {
      var serverVersion = data.version;
      var localVersion = localStorage.getItem(STORAGE_KEY);

      if (!serverVersion) return;

      if (localVersion && localVersion !== serverVersion) {
        console.log(
          "[version-check] พบเวอร์ชันใหม่ (" +
            localVersion +
            " -> " +
            serverVersion +
            ") กำลังล้างแคชและโหลดใหม่..."
        );
        clearStaleCachesAndReload(serverVersion);
      } else {
        // ครั้งแรกที่เปิด หรือเวอร์ชันตรงกันอยู่แล้ว แค่บันทึกไว้
        localStorage.setItem(STORAGE_KEY, serverVersion);
      }
    })
    .catch(function (err) {
      // network พลาด/ยังไม่มี version.json ก็ไม่เป็นไร ปล่อยผ่านเงียบๆ
      console.warn("[version-check]", err.message);
    });

  function clearStaleCachesAndReload(newVersion) {
    var tasks = [];

    // ล้าง Cache Storage API (กรณีมี service worker หรือ cache อื่นค้างอยู่)
    if (window.caches && caches.keys) {
      tasks.push(
        caches.keys().then(function (names) {
          return Promise.all(names.map(function (name) { return caches.delete(name); }));
        })
      );
    }

    // ยกเลิก service worker เก่า (ถ้ามี) เพื่อไม่ให้ยึด cache ต่อ
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      tasks.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
        })
      );
    }

    Promise.all(tasks)
      .catch(function () {
        /* เก็บ error เงียบๆ ไม่ให้ block การ reload */
      })
      .then(function () {
        localStorage.setItem(STORAGE_KEY, newVersion);
        sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
        // force reload จาก server ไม่ใช้แคช
        window.location.reload(true);
      });
  }
})();
