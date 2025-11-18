Page({
  data: {
    // 服务地址
    pythonServer: 'http://localhost:8789',
    javaServer: 'http://localhost:8788',
    
    // 文件信息
    tempFilePath: '',
    filename: '',
    fileSize: '',
    fileType: '',
    
    // 转换状态
    converting: false,
    convertedUrl: '',
    
    // 转换结果
    result: null
  },

  onLoad() {
    console.log('PPT转换页面加载');
  },

  /**
   * 选择文件（PDF或PPT）
   */
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'ppt', 'pptx'],
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length) {
          const file = res.tempFiles[0];
          
          // 检查文件大小（60MB限制）
          const maxSize = 60 * 1024 * 1024;
          if (file.size > maxSize) {
            wx.showToast({
              icon: 'none',
              title: '文件超过60MB限制',
              duration: 2000
            });
            return;
          }
          
          // 检测文件类型
          const fileType = this.detectFileType(file.name);
          if (!fileType) {
            wx.showToast({
              icon: 'none',
              title: '仅支持PDF和PPT文件',
              duration: 2000
            });
            return;
          }
          
          console.log('选择文件:', file.name, '类型:', fileType, '大小:', (file.size / 1024).toFixed(2) + 'KB');
          
          this.setData({
            tempFilePath: file.path,
            filename: file.name,
            fileSize: this.formatFileSize(file.size),
            fileType: fileType,
            convertedUrl: '',
            result: null
          });
        }
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          icon: 'none',
          title: '选择文件失败'
        });
      }
    });
  },

  /**
   * 检测文件类型
   */
  detectFileType(filename) {
    if (!filename) return null;
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'ppt';
    return null;
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  /**
   * 开始转换
   */
  startConvert() {
    const { tempFilePath, fileType } = this.data;
    
    if (!tempFilePath) {
      wx.showToast({
        icon: 'none',
        title: '请先选择文件'
      });
      return;
    }
    
    if (fileType === 'pdf') {
      this.convertPdfToPpt();
    } else if (fileType === 'ppt') {
      this.convertPptToPdf();
    }
  },

  /**
   * PDF转PPT（Python服务）
   */
  convertPdfToPpt() {
    const { tempFilePath, filename, pythonServer } = this.data;
    
    this.setData({ converting: true });
    wx.showLoading({ title: 'PDF转PPT中...', mask: true });
    
    console.log('开始PDF转PPT:', filename);
    
    wx.uploadFile({
      url: pythonServer + '/pdf/to-ppt',
      filePath: tempFilePath,
      name: 'file',
      formData: {
        dpi: '200',
        quality: '92'
      },
      success: (res) => {
        console.log('转换响应:', res.statusCode, res.data);
        
        try {
          const data = JSON.parse(res.data);
          
          if (data.error) {
            wx.showToast({
              icon: 'none',
              title: data.error,
              duration: 3000
            });
            return;
          }
          
          // 格式化文件大小
          if (data.size) {
            data.fileSizeFormatted = this.formatFileSize(data.size);
          }
          
          this.setData({
            convertedUrl: pythonServer + data.url,
            result: data,
            converting: false
          });
          
          wx.showToast({
            icon: 'success',
            title: '转换成功',
            duration: 2000
          });
          
          console.log('PDF转PPT成功:', data);
          
        } catch (err) {
          console.error('解析响应失败:', err);
          wx.showToast({
            icon: 'none',
            title: '解析响应失败'
          });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        wx.showToast({
          icon: 'none',
          title: '转换失败，请检查服务'
        });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ converting: false });
      }
    });
  },

  /**
   * PPT转PDF（Java服务）
   */
  convertPptToPdf() {
    const { tempFilePath, filename, javaServer } = this.data;
    
    this.setData({ converting: true });
    wx.showLoading({ title: 'PPT转PDF中...', mask: true });
    
    console.log('开始PPT转PDF:', filename);
    
    wx.uploadFile({
      url: javaServer + '/ppt/topdf',
      filePath: tempFilePath,
      name: 'file',
      success: (res) => {
        console.log('转换响应:', res.statusCode, res.data);
        
        try {
          const data = JSON.parse(res.data);
          
          if (data.error) {
            wx.showToast({
              icon: 'none',
              title: data.error,
              duration: 3000
            });
            return;
          }
          
          // 格式化文件大小
          if (data.size) {
            data.fileSizeFormatted = this.formatFileSize(data.size);
          }
          
          this.setData({
            convertedUrl: javaServer + data.url,
            result: data,
            converting: false
          });
          
          wx.showToast({
            icon: 'success',
            title: '转换成功',
            duration: 2000
          });
          
          console.log('PPT转PDF成功:', data);
          
        } catch (err) {
          console.error('解析响应失败:', err);
          wx.showToast({
            icon: 'none',
            title: '解析响应失败'
          });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        wx.showToast({
          icon: 'none',
          title: '转换失败，请检查服务'
        });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ converting: false });
      }
    });
  },

  /**
   * 下载/预览文件
   */
  downloadFile() {
    const { convertedUrl, fileType } = this.data;
    
    if (!convertedUrl) {
      wx.showToast({
        icon: 'none',
        title: '没有可下载的文件'
      });
      return;
    }
    
    wx.showLoading({ title: '准备下载...', mask: true });
    
    wx.downloadFile({
      url: convertedUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath;
          const targetFileType = fileType === 'pdf' ? 'pptx' : 'pdf';
          
          wx.openDocument({
            filePath: filePath,
            fileType: targetFileType,
            success: () => {
              console.log('打开文档成功');
            },
            fail: (err) => {
              console.error('打开文档失败:', err);
              wx.showToast({
                icon: 'none',
                title: '无法打开文件'
              });
            }
          });
        }
      },
      fail: (err) => {
        console.error('下载失败:', err);
        wx.showToast({
          icon: 'none',
          title: '下载失败'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  /**
   * 重新转换
   */
  resetConvert() {
    this.setData({
      tempFilePath: '',
      filename: '',
      fileSize: '',
      fileType: '',
      convertedUrl: '',
      result: null,
      converting: false
    });
  }
});
