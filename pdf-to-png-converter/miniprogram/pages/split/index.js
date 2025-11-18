Page({
  data: { serverUrl: 'http://localhost:8787', tempFilePath: '', filename: '' },
  choosePdf() { wx.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf'], success: (r) => this.setData({ tempFilePath: r.tempFiles[0].path, filename: r.tempFiles[0].name }) }); },
  submit() {
    const { serverUrl, tempFilePath } = this.data;
    if (!tempFilePath) return;
    wx.showLoading({ title: '拆分中' });
    wx.uploadFile({
      url: `${serverUrl}/pdf/split`, filePath: tempFilePath, name: 'file',
      success: (res) => { try { const data = JSON.parse(res.data); wx.setClipboardData({ data: (data.urls || []).map(u => `${serverUrl}${u}`).join('\n') }); } catch { wx.showToast({ icon: 'none', title: '解析失败' }); } },
      fail: () => wx.showToast({ icon: 'none', title: '请求失败' }),
      complete: () => wx.hideLoading()
    });
  }
});


