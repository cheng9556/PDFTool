Page({
  data: {
    serverUrl: 'http://localhost:8788',
    images: []
  },

  chooseImages() {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const list = this.data.images.concat(res.tempFilePaths);
        // 限制最多35张
        if (list.length > 35) {
          wx.showToast({
            title: '最多选择35张图片',
            icon: 'none',
            duration: 2000
          });
          this.setData({ images: list.slice(0, 35) });
        } else {
          this.setData({ images: list });
        }
      }
    });
  },

  async startConvert() {
    const { images, serverUrl } = this.data;
    if (!images.length) return;
    
    wx.showLoading({ title: '转换中', mask: true });
    
    try {
      // 初始化会话
      const init = await new Promise((resolve, reject) => {
        wx.request({ 
          url: `${serverUrl}/image/topdf/session/init`, 
          method: 'POST', 
          success: r => resolve(r.data), 
          fail: reject 
        });
      });
      
      const id = init.id;
      
      // 逐个上传图片
      for (let i = 0; i < images.length; i++) {
        wx.showLoading({ 
          title: `上传中 (${i + 1}/${images.length})`, 
          mask: true 
        });
        
        await new Promise((resolve, reject) => {
          wx.uploadFile({
            url: `${serverUrl}/image/topdf/session/upload?id=${id}&index=${i}`,
            name: 'file',
            filePath: images[i],
            success: () => resolve(true),
            fail: reject
          });
        });
      }
      
      // 提交合并
      wx.showLoading({ title: '合并中...', mask: true });
      
      const commit = await new Promise((resolve, reject) => {
        wx.request({ 
          url: `${serverUrl}/image/topdf/session/commit?id=${id}`, 
          method: 'POST', 
          success: r => resolve(r.data), 
          fail: reject 
        });
      });
      
      // 下载并打开PDF
      const pdfUrl = `${serverUrl}${commit.url}`;
      
      wx.downloadFile({ 
        url: pdfUrl, 
        success: (d) => {
          wx.openDocument({ 
            filePath: d.tempFilePath,
            fileType: 'pdf',
            success: () => {
              wx.showToast({
                title: '转换成功',
                icon: 'success',
                duration: 2000
              });
            },
            fail: () => {
              // 打开失败，复制链接
              wx.setClipboardData({ data: pdfUrl });
            }
          });
        }, 
        fail: () => {
          wx.setClipboardData({ data: pdfUrl });
        }
      });
      
    } catch (e) {
      console.error('转换失败:', e);
      wx.showToast({ 
        icon: 'none', 
        title: '转换失败，请重试' 
      });
    } finally {
      wx.hideLoading();
    }
  }
});


