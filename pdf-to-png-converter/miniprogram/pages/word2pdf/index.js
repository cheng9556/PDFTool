// Java后端服务地址 (JodConverter + LibreOffice)
const SERVER_URL = 'http://localhost:8788';

Page({
  data: {
    wordFile: null,
    fileName: '',
    fileSize: '',
    converting: false,
    pdfUrl: '',
    error: ''
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['doc', 'docx'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (file.size > 50 * 1024 * 1024) {
          wx.showToast({ title: '文件不能超过50MB', icon: 'none' });
          return;
        }
        
        this.setData({
          wordFile: file.path,
          fileName: file.name,
          fileSize: this.formatFileSize(file.size),
          pdfUrl: '',
          error: ''
        });
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({ title: '选择文件失败', icon: 'none' });
      }
    });
  },

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  convertToPdf() {
    if (!this.data.wordFile || this.data.converting) return;

    this.setData({ converting: true, error: '', pdfUrl: '' });

    wx.uploadFile({
      url: `${SERVER_URL}/word/topdf`,
      filePath: this.data.wordFile,
      name: 'file',
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.error) {
            this.setData({ error: data.error, converting: false });
            wx.showToast({ title: '转换失败', icon: 'none' });
          } else {
            this.setData({ 
              pdfUrl: SERVER_URL + data.url, 
              converting: false 
            });
            wx.showToast({ title: '转换成功', icon: 'success' });
          }
        } catch (e) {
          console.error('解析响应失败:', e, res.data);
          this.setData({ 
            error: '解析响应失败', 
            converting: false 
          });
          wx.showToast({ title: '转换失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        this.setData({ 
          error: '网络错误，请检查Java服务器是否启动 (端口8788)', 
          converting: false 
        });
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  downloadPdf() {
    if (!this.data.pdfUrl) return;

    wx.downloadFile({
      url: this.data.pdfUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf',
            success: () => {
              console.log('打开文档成功');
            },
            fail: (err) => {
              console.error('打开文档失败:', err);
              wx.showToast({ title: '无法打开PDF文件', icon: 'none' });
            }
          });
        }
      },
      fail: (err) => {
        console.error('下载失败:', err);
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  }
});
