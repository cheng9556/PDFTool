Page({
  data: { serverUrl: 'http://localhost:8787', files: [] },
  addPdf() {
    wx.chooseMessageFile({ count: 9, type: 'file', extension: ['pdf'], success: (r) => {
      const list = this.data.files.concat(r.tempFiles.map(f => ({ path: f.path, name: f.name })));
      this.setData({ files: list.slice(0, 30) });
    }});
  },
  async startMerge() {
    const { files, serverUrl } = this.data;
    if (!files.length) return;
    wx.showLoading({ title: '合并中' });
    try {
      const init = await new Promise((resolve, reject) => wx.request({ url: `${serverUrl}/pdf/merge/init`, method: 'POST', success: r => resolve(r.data), fail: reject }));
      const id = init.id;
      for (let i = 0; i < files.length; i++) {
        await new Promise((resolve, reject) => wx.uploadFile({ url: `${serverUrl}/pdf/merge/upload?id=${id}&index=${i}`, filePath: files[i].path, name: 'file', success: () => resolve(true), fail: reject }));
      }
      const commit = await new Promise((resolve, reject) => wx.request({ url: `${serverUrl}/pdf/merge/commit?id=${id}`, method: 'POST', success: r => resolve(r.data), fail: reject }));
      const url = `${serverUrl}${commit.url}`;
      wx.setClipboardData({ data: url, success: () => wx.showToast({ icon: 'none', title: '已复制下载链接' }) });
    } catch (e) { wx.showToast({ icon: 'none', title: '合并失败' }); }
    finally { wx.hideLoading(); }
  }
});


