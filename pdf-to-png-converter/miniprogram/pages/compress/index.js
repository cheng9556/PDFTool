// pages/compress/index.js
var serverUrl = 'http://localhost:8789';

Page({
  data: {
    serverUrl: serverUrl,
    pdfFile: '',
    fileName: '',
    fileSize: 0,
    fileSizeFormatted: '',
    // 压缩级别选项
    compressionLevels: [
      { value: 'low', label: '低压缩率', desc: '约20%压缩', ratio: '~20%' },
      { value: 'medium', label: '中压缩率', desc: '约50%压缩', ratio: '~50%' },
      { value: 'high', label: '高压缩率', desc: '约80%压缩', ratio: '~80%' }
    ],
    selectedLevel: 'medium',  // 默认选中中压缩率
    processing: false,  // 是否正在处理
    processComplete: false,  // 处理是否完成
    processResult: null  // 处理结果
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: 'PDF压缩'
    });
  },

  // 选择PDF文件
  choosePdf: function() {
    var that = this;
    
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: function(res) {
        if (res.tempFiles && res.tempFiles.length) {
          var file = res.tempFiles[0];
          
          // 检查文件大小
          if (file.size > 100 * 1024 * 1024) {
            wx.showToast({
              title: '文件不能超过100MB',
              icon: 'none'
            });
            return;
          }
          
          that.setData({
            pdfFile: file.path,
            fileName: file.name,
            fileSize: file.size,
            fileSizeFormatted: that.formatFileSize(file.size),
            processing: false,
            processComplete: false,
            processResult: null
          });
        }
      },
      fail: function() {
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 选择压缩级别
  selectLevel: function(e) {
    var level = e.currentTarget.dataset.level;
    this.setData({
      selectedLevel: level
    });
  },

  // 开始压缩
  startCompress: function() {
    var that = this;
    
    if (!that.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }
    
    that.setData({
      processing: true,
      processComplete: false
    });
    
    wx.showLoading({
      title: '压缩中...',
      mask: true
    });
    
    wx.uploadFile({
      url: serverUrl + '/pdf/compress',
      filePath: that.data.pdfFile,
      name: 'file',
      formData: {
        'compression_level': that.data.selectedLevel
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          try {
            var data = JSON.parse(res.data);
            if (data.success) {
              that.setData({
                processing: false,
                processComplete: true,
                processResult: {
                  filename: data.filename,
                  downloadUrl: serverUrl + data.url,
                  originalSize: data.original_size,
                  compressedSize: data.compressed_size,
                  compressionRatio: data.compression_ratio,
                  compressionLevel: data.compression_level,
                  imageCount: data.image_count,
                  totalPages: data.total_pages,
                  elapsedTime: data.elapsed_time
                }
              });
            } else {
              wx.showToast({
                title: data.error || '压缩失败',
                icon: 'none',
                duration: 3000
              });
              that.setData({
                processing: false
              });
            }
          } catch(e) {
            console.error('解析响应失败:', e);
            wx.showToast({
              title: '处理响应失败',
              icon: 'none'
            });
            that.setData({
              processing: false
            });
          }
        } else {
          var errorMsg = '压缩失败';
          try {
            var errorData = JSON.parse(res.data);
            errorMsg = errorData.error || errorMsg;
          } catch(e) {}
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 3000
          });
          that.setData({
            processing: false
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('压缩失败:', err);
        wx.showToast({
          title: '网络请求失败，请检查服务是否运行',
          icon: 'none',
          duration: 3000
        });
        that.setData({
          processing: false
        });
      }
    });
  },

  // 下载结果
  downloadResult: function() {
    var that = this;
    if (!that.data.processResult) return;
    
    var downloadUrl = that.data.processResult.downloadUrl;
    
    wx.showLoading({
      title: '下载中...',
      mask: true
    });
    
    wx.downloadFile({
      url: downloadUrl,
      success: function(res) {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            success: function() {
              wx.showToast({
                title: '打开成功',
                icon: 'success'
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
      fail: function(err) {
        wx.hideLoading();
        console.error('下载失败:', err);
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
      }
    });
  },

  // 重置文件
  resetFile: function() {
    this.setData({
      pdfFile: '',
      fileName: '',
      fileSize: 0,
      fileSizeFormatted: '',
      processing: false,
      processComplete: false,
      processResult: null
    });
  },

  // 格式化文件大小
  formatFileSize: function(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
});

