Page({
  data: { serverUrl: 'http://localhost:8787', tempFilePath: '', filename: '', order: '' },
  choosePdf() { wx.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf'], success: (r) => this.setData({ tempFilePath: r.tempFiles[0].path, filename: r.tempFiles[0].name }) }); },
  onOrder(e) { this.setData({ order: e.detail.value }); },
  submit() {
    const { serverUrl, tempFilePath, order } = this.data;
    if (!tempFilePath) return;
    wx.showLoading({ title: '处理中' });
    wx.uploadFile({
      url: `${serverUrl}/pdf/reorder`, filePath: tempFilePath, name: 'file', formData: { order },
      success: (res) => { try { const data = JSON.parse(res.data); const url = `${serverUrl}${data.url}`; wx.setClipboardData({ data: url }); } catch { wx.showToast({ icon: 'none', title: '解析失败' }); } },
      fail: () => wx.showToast({ icon: 'none', title: '请求失败' }),
      complete: () => wx.hideLoading()
    });
  }
});


