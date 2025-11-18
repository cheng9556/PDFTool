Page({
  data: { serverUrl: 'http://localhost:8787', tempFilePath: '', filename: '', angles: ['90', '180', '270'], angleIndex: 0, pages: '' },
  choosePdf() { wx.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf'], success: r => this.setData({ tempFilePath: r.tempFiles[0].path, filename: r.tempFiles[0].name }) }); },
  onAngle(e) { this.setData({ angleIndex: Number(e.detail.value) }); },
  onPages(e) { this.setData({ pages: e.detail.value }); },
  submit() {
    const { serverUrl, tempFilePath, angleIndex, angles, pages } = this.data;
    if (!tempFilePath) return;
    wx.showLoading({ title: '处理中' });
    wx.uploadFile({
      url: `${serverUrl}/pdf/rotate`,
      filePath: tempFilePath,
      name: 'file',
      formData: { angle: angles[angleIndex], pages },
      success: (res) => {
        try { const data = JSON.parse(res.data); const url = `${serverUrl}${data.url}`; wx.setClipboardData({ data: url, success: () => wx.showToast({ icon: 'none', title: '已复制下载链接' }) }); }
        catch { wx.showToast({ icon: 'none', title: '解析失败' }); }
      },
      fail: () => wx.showToast({ icon: 'none', title: '请求失败' }),
      complete: () => wx.hideLoading()
    });
  }
});


