App({
  onLaunch() {},
  // 供各功能页添加本地转换记录（存储24小时，前端本地）
  addLocalRecord(record) {
    try {
      const store = require('./utils/records');
      store.add(record);
    } catch (e) {
      console.warn('addLocalRecord failed', e);
    }
  },
});


