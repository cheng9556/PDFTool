// 文本转PDF页面
const serverUrl = 'http://localhost:8789';

Page({
  data: {
    inputMode: 'text', // 'text' 或 'file'
    textContent: '',
    fileName: '',
    fileSize: 0,
    fileSizeFormatted: '0 KB',
    
    // 配置参数
    fontSize: 12,
    lineSpacing: 1.5,
    
    // 转换状态
    converting: false,
    progress: 0,
    
    // 转换结果
    converted: false,
    resultFile: null,
    resultPages: 0,
    resultSize: 0,
    resultSizeFormatted: '0 KB',
    resultChars: 0,
    conversionTime: ''
  },

  // 切换输入模式
  switchMode: function(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      inputMode: mode,
      textContent: '',
      fileName: '',
      fileSize: 0,
      converted: false
    });
  },

  // 输入文本
  onTextInput: function(e) {
    const text = e.detail.value;
    this.setData({
      textContent: text,
      converted: false
    });
  },

  // 选择TXT文件
  chooseTxtFile: function() {
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['txt'],
      success: function(res) {
        const file = res.tempFiles[0];
        
        // 检查文件扩展名
        if (!file.name.toLowerCase().endsWith('.txt')) {
          wx.showToast({
            title: '只支持TXT文件',
            icon: 'none'
          });
          return;
        }
        
        // 检查文件大小（最大10MB）
        if (file.size > 10 * 1024 * 1024) {
          wx.showToast({
            title: '文件过大（最大10MB）',
            icon: 'none'
          });
          return;
        }
        
        that.setData({
          fileName: file.name,
          fileSize: file.size,
          fileSizeFormatted: that.formatFileSize(file.size),
          textContent: file.path,
          converted: false
        });
      },
      fail: function() {
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 字体大小调整
  onFontSizeChange: function(e) {
    this.setData({
      fontSize: parseInt(e.detail.value)
    });
  },

  // 行间距调整
  onLineSpacingChange: function(e) {
    this.setData({
      lineSpacing: parseFloat(e.detail.value)
    });
  },

  // 开始转换
  startConvert: function() {
    const that = this;
    
    // 验证输入
    if (this.data.inputMode === 'text') {
      if (!this.data.textContent.trim()) {
        wx.showToast({
          title: '请输入文本内容',
          icon: 'none'
        });
        return;
      }
    } else {
      if (!this.data.fileName) {
        wx.showToast({
          title: '请选择TXT文件',
          icon: 'none'
        });
        return;
      }
    }
    
    this.setData({
      converting: true,
      progress: 0,
      converted: false
    });
    
    wx.showLoading({
      title: '转换中...',
      mask: true
    });
    
    // 准备上传数据
    const formData = {
      font_size: this.data.fontSize.toString(),
      line_spacing: this.data.lineSpacing.toString()
    };
    
    if (this.data.inputMode === 'text') {
      // 直接文本转换
      this.convertText(this.data.textContent, formData);
    } else {
      // TXT文件转换
      this.convertFile(this.data.textContent, formData);
    }
  },

  // 直接文本转换
  convertText: function(text, formData) {
    const that = this;
    
    wx.request({
      url: serverUrl + '/text/to-pdf',
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        text: text,
        font_size: formData.font_size,
        line_spacing: formData.line_spacing
      },
      success: function(res) {
        if (res.statusCode === 200 && res.data.url) {
          that.handleConvertSuccess(res.data);
        } else {
          that.handleConvertError(res.data.error || '转换失败');
        }
      },
      fail: function(err) {
        console.error('转换失败:', err);
        that.handleConvertError('网络请求失败');
      }
    });
  },

  // TXT文件转换
  convertFile: function(filePath, formData) {
    const that = this;
    
    wx.uploadFile({
      url: serverUrl + '/text/to-pdf',
      filePath: filePath,
      name: 'file',
      formData: formData,
      success: function(res) {
        const data = JSON.parse(res.data);
        if (res.statusCode === 200 && data.url) {
          that.handleConvertSuccess(data);
        } else {
          that.handleConvertError(data.error || '转换失败');
        }
      },
      fail: function(err) {
        console.error('转换失败:', err);
        that.handleConvertError('网络请求失败');
      }
    });
  },

  // 处理转换成功
  handleConvertSuccess: function(data) {
    wx.hideLoading();
    
    this.setData({
      converting: false,
      converted: true,
      resultFile: data.filename,
      resultPages: data.pages,
      resultSize: data.size,
      resultSizeFormatted: this.formatFileSize(data.size),
      resultChars: data.characters,
      conversionTime: data.conversion_time
    });
    
    wx.showToast({
      title: '转换成功',
      icon: 'success'
    });
  },

  // 处理转换失败
  handleConvertError: function(error) {
    wx.hideLoading();
    
    this.setData({
      converting: false,
      converted: false
    });
    
    wx.showToast({
      title: error || '转换失败',
      icon: 'none',
      duration: 2000
    });
  },

  // 下载PDF
  downloadPdf: function() {
    const that = this;
    
    wx.showLoading({
      title: '下载中...',
      mask: true
    });
    
    wx.downloadFile({
      url: serverUrl + '/download/' + this.data.resultFile,
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          // 保存到本地
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: function(saveRes) {
              wx.showToast({
                title: '下载成功',
                icon: 'success'
              });
              
              // 打开文件
              wx.openDocument({
                filePath: saveRes.savedFilePath,
                fileType: 'pdf',
                success: function() {
                  console.log('打开文档成功');
                }
              });
            },
            fail: function() {
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
      }
    });
  },

  // 格式化文件大小
  formatFileSize: function(bytes) {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  },

  // 重新转换
  resetConvert: function() {
    this.setData({
      textContent: '',
      fileName: '',
      fileSize: 0,
      converted: false,
      resultFile: null
    });
  }
});


