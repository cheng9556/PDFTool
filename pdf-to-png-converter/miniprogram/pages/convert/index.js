Page({
  data: {
    serverUrl: 'http://localhost:8787',
    tempFilePath: '',
    images: []
  },

  choosePdf() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length) {
          this.setData({ tempFilePath: res.tempFiles[0].path });
        }
      }
    });
  },

  uploadPdf() {
    const { tempFilePath, serverUrl } = this.data;
    if (!tempFilePath) return;
    wx.showLoading({ title: '上传中' });
    wx.uploadFile({
      url: `${serverUrl}/convert`,
      filePath: tempFilePath,
      name: 'file',
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          const id = data.id;
          const imgs = (data.pages || []).map(p => ({
            name: p.name,
            width: p.width,
            height: p.height,
            url: `${serverUrl}/files/${id}/${p.name}`
          }));
          this.setData({ images: imgs });
        } catch (e) {
          wx.showToast({ icon: 'none', title: '解析响应失败' });
        }
      },
      fail: () => wx.showToast({ icon: 'none', title: '上传失败' }),
      complete: () => wx.hideLoading()
    });
  }
});


