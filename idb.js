const DB_NAME = "AppDatabase";
const DB_VERSION = 1;

// --- State ---
let _dbPromise = null;
let _dbVersion = DB_VERSION;
const _registeredStores = new Set();

// FIX 2: Tách registerStore ra riêng — đăng ký store TRƯỚC khi mở DB
// Tránh race condition khi nhiều store gọi initDB cùng lúc
const registerStore = (storeName) => {
  _registeredStores.add(storeName);
};

// FIX 3: initDB chỉ chịu trách nhiệm mở DB một lần với toàn bộ store đã đăng ký
// Không còn close() db giữa chừng nữa → tránh abort transaction đang chạy
const initDB = (storeName) => {
  if (storeName) registerStore(storeName);

  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, _dbVersion);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const name of _registeredStores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, {
            keyPath: null,
            autoIncrement: true,
          });
        }
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);

    // FIX 4: onblocked — thay vì reject cứng, log cảnh báo và chờ
    request.onblocked = () => {
      console.warn(
        "[DB] Đang bị block bởi tab khác. Hãy đóng các tab cũ đang dùng database này."
      );
      // Không reject ngay — trình duyệt sẽ tự retry khi tab kia đóng/upgrade xong
    };
  });

  return _dbPromise;
};

// --- Hàm để mở thêm store sau khi DB đã được khởi tạo ---
// Dùng khi cần thêm store động (ít gặp, nhưng hỗ trợ đầy đủ)
const addStore = async (storeName) => {
  if (_registeredStores.has(storeName)) {
    const db = await initDB();
    if (db.objectStoreNames.contains(storeName)) return db;
  }

  // Cần nâng version để tạo store mới — chờ transaction hiện tại xong
  const currentDb = await initDB();
  currentDb.close();
  _dbPromise = null;
  _dbVersion++;
  registerStore(storeName);
  return initDB();
};

// --- CRUD ---

// FIX 1: Đổi signature thành (storeName, data, key?) — key là optional
// Trước đây là (storeName, key, data) khiến utils.js truyền object vào key, data = undefined
const addData = async (storeName, data, key) => {
  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    // Nếu key undefined → IndexedDB tự sinh key (autoIncrement)
    const request = key !== undefined ? store.add(data, key) : store.add(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

const putData = async (storeName, key, data) => {
  if (key === undefined || key === null) {
    throw new Error("putData yêu cầu truyền key. Dùng addData để thêm mới.");
  }

  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data, key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

const patchData = async (storeName, key, data) => {
  if (key === undefined || key === null) {
    throw new Error("patchData yêu cầu truyền key. Dùng addData để thêm mới.");
  }

  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    const getRequest = store.get(key);

    getRequest.onsuccess = () => {
      if (getRequest.result === undefined) {
        reject(new Error(`Không tìm thấy record với key "${key}"`));
        return;
      }

      const merged = { ...getRequest.result, ...data };
      const putRequest = store.put(merged, key);

      putRequest.onsuccess = () => resolve(putRequest.result);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

const getData = async (storeName, key) => {
  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

const getAllData = async (storeName) => {
  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

// FIX 5: getAllDataWithKeys — không dùng spread trực tiếp lên cursor.value
// để tránh lỗi khi value là primitive hoặc array
const getAllDataWithKeys = async (storeName) => {
  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const results = [];
    const request = store.openCursor();

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const value = cursor.value;
        // Chỉ spread nếu value là plain object, còn lại wrap vào { value }
        const entry =
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { _key: cursor.key, ...value }
            : { _key: cursor.key, value };
        results.push(entry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

const deleteData = async (storeName, key) => {
  const db = await initDB(storeName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction bị abort"));
  });
};

export {
  registerStore,  
  initDB,
  addStore,
  addData,
  putData,
  patchData,
  getData,
  getAllData,
  getAllDataWithKeys,
  deleteData
};