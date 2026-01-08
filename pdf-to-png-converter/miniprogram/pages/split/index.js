// PDF文件拆分页面
// 使用全局配置
const config = require('../../utils/config');
const serverUrl = config.pythonServer;

Page({
  data: {
    // 文件信息
    pdfFile: null,
    fileName: '',
    fileSize: 0,
    fileSizeFormatted: '0 KB',
    totalPages: 0,
    
    // 拆分模式
    splitMode: 'by_pages',  // by_pages, by_count, by_ranges
    
    // 按页数拆分
    pagesPerFile: 1,
    
    // 按份数拆分
    fileCount: 2,
    
    // 按范围拆分
    ranges: '',
    rangesPlaceholder: '例如: 1-5,6-10,11-15',
    
    // 状态
    splitting: false,
    splitComplete: false,
    
    // 拆分结果
    splitFiles: [],
    splitCount: 0,
    conversionTime: ''
  },

  // 选择PDF文件
  choosePdf: function() {
    const that = this;
    
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: function(res) {
        const file = res.tempFiles[0];
        
        // 检查文件类型
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          wx.showToast({
            title: '只支持PDF文件',
            icon: 'none'
          });
          return;
        }
        
        // 检查文件大小（最大100MB）
        if (file.size > 100 * 1024 * 1024) {
          wx.showToast({
            title: '文件过大（最大100MB）',
            icon: 'none'
          });
          return;
        }
        
        that.setData({
          pdfFile: file.path,
          fileName: file.name,
          fileSize: file.size,
          fileSizeFormatted: that.formatFileSize(file.size),
          splitComplete: false,
          totalPages: 0
        });
        
        // 获取PDF页数
        that.getPdfPageCount(file.path);
      },
      fail: function() {
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 切换拆分模式
  switchMode: function(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      splitMode: mode,
      splitComplete: false
    });
  },

  // 页数输入
  onPagesChange: function(e) {
    var value = e.detail.value;
    // 允许用户输入过程中的值，包括空字符串
    if (value === '' || value === null || value === undefined) {
      this.setData({
        pagesPerFile: ''
      });
      return;
    }
    
    var numValue = parseInt(value);
    if (isNaN(numValue)) {
      numValue = 1;
    }
    
    this.setData({
      pagesPerFile: numValue
    });
  },

  // 份数输入
  onCountChange: function(e) {
    var value = e.detail.value;
    // 允许用户输入过程中的值，包括空字符串
    if (value === '' || value === null || value === undefined) {
      this.setData({
        fileCount: ''
      });
      return;
    }
    
    var numValue = parseInt(value);
    if (isNaN(numValue)) {
      numValue = 2;
    }
    
    this.setData({
      fileCount: numValue
    });
  },

  // 范围输入
  onRangesInput: function(e) {
    this.setData({
      ranges: e.detail.value
    });
  },

  // 开始拆分
  startSplit: function() {
    const that = this;
    
    if (!that.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }
    
    // 验证输入
    if (that.data.splitMode === 'by_pages') {
      var pages = parseInt(that.data.pagesPerFile);
      if (isNaN(pages) || pages < 1) {
        wx.showToast({
          title: '请输入有效的页数（至少1页）',
          icon: 'none'
        });
        return;
      }
      if (pages > 1000) {
        wx.showToast({
          title: '每个文件页数不能超过1000',
          icon: 'none'
        });
        return;
      }
    } else if (that.data.splitMode === 'by_count') {
      var count = parseInt(that.data.fileCount);
      if (isNaN(count) || count < 2) {
        wx.showToast({
          title: '请输入有效的份数（至少2份）',
          icon: 'none'
        });
        return;
      }
      if (count > 100) {
        wx.showToast({
          title: '拆分份数不能超过100',
          icon: 'none'
        });
        return;
      }
    } else if (that.data.splitMode === 'by_ranges') {
      if (!that.data.ranges.trim()) {
        wx.showToast({
          title: '请输入页码范围',
          icon: 'none'
        });
        return;
      }
    }
    
    that.setData({
      splitting: true,
      splitComplete: false
    });
    
    wx.showLoading({
      title: '拆分中...',
      mask: true
    });
    
    // 准备表单数据
    var formData = {
      split_mode: that.data.splitMode
    };
    
    if (that.data.splitMode === 'by_pages') {
      var pages = parseInt(that.data.pagesPerFile) || 1;
      formData.pages_per_file = pages.toString();
    } else if (that.data.splitMode === 'by_count') {
      var count = parseInt(that.data.fileCount) || 2;
      formData.file_count = count.toString();
    } else if (that.data.splitMode === 'by_ranges') {
      formData.ranges = that.data.ranges;
    }
    
    // 上传文件并拆分
    wx.uploadFile({
      url: serverUrl + '/pdf/split',
      filePath: that.data.pdfFile,
      name: 'file',
      formData: formData,
      success: function(res) {
        wx.hideLoading();
        
        const data = JSON.parse(res.data);
        
        if (res.statusCode === 200 && data.split_files) {
          // 格式化文件大小
          var formattedFiles = [];
          for (var i = 0; i < data.split_files.length; i++) {
            var file = data.split_files[i];
            file.sizeFormatted = (file.size / 1024).toFixed(2);
            formattedFiles.push(file);
          }
          
          that.setData({
            splitting: false,
            splitComplete: true,
            totalPages: data.total_pages,
            splitCount: data.split_count,
            splitFiles: formattedFiles,
            conversionTime: data.conversion_time
          });
          
          wx.showToast({
            title: '拆分成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: data.error || '拆分失败',
            icon: 'none'
          });
          that.setData({ splitting: false });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({
          title: '拆分失败',
          icon: 'none'
        });
        that.setData({ splitting: false });
      }
    });
  },

  // 下载单个文件
  downloadFile: function(e) {
    const that = this;
    const index = e.currentTarget.dataset.index;
    const file = that.data.splitFiles[index];
    
    wx.showLoading({
      title: '下载中...',
      mask: true
    });
    
    wx.downloadFile({
      url: serverUrl + file.url,
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
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

  // 批量下载所有文件
  downloadAll: function() {
    const that = this;
    const files = that.data.splitFiles;
    
    if (files.length === 0) {
      return;
    }
    
    wx.showLoading({
      title: `下载中 0/${files.length}`,
      mask: true
    });
    
    let downloaded = 0;
    
    files.forEach(function(file, index) {
      wx.downloadFile({
        url: serverUrl + file.url,
        success: function(res) {
          if (res.statusCode === 200) {
            wx.saveFile({
              tempFilePath: res.tempFilePath,
              success: function() {
                downloaded++;
                wx.showLoading({
                  title: `下载中 ${downloaded}/${files.length}`,
                  mask: true
                });
                
                if (downloaded === files.length) {
                  wx.hideLoading();
                  wx.showToast({
                    title: `已下载${files.length}个文件`,
                    icon: 'success'
                  });
                }
              }
            });
          }
        }
      });
    });
  },

  // 获取PDF页数
  getPdfPageCount: function(filePath) {
    const that = this;
    
    wx.showLoading({
      title: '读取页数...',
      mask: true
    });
    
    wx.uploadFile({
      url: serverUrl + '/pdf/page-count',
      filePath: filePath,
      name: 'file',
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          const data = JSON.parse(res.data);
          if (data.page_count) {
            that.setData({
              totalPages: data.page_count
            });
          }
        } else {
          console.log('获取页数失败');
        }
      },
      fail: function() {
        wx.hideLoading();
        console.log('获取页数失败');
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

  // 重新选择文件
  resetFile: function() {
    this.setData({
      pdfFile: null,
      fileName: '',
      fileSize: 0,
      splitComplete: false,
      splitFiles: []
    });
  }
});
