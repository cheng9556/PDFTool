// pages/merge/index.js
// 使用全局配置
const config = require('../../utils/config');
var serverUrl = config.pythonServer;

Page({
  data: {
    pdfFiles: [],           // 已选择的PDF文件列表
    maxFiles: 20,           // 最多选择文件数
    maxPages: 100,          // 最多合并页数
    maxSize: 50,            // 最大总大小(MB)
    totalPages: 0,          // 当前总页数
    totalSize: 0,           // 当前总大小(字节)
    merging: false,         // 是否正在合并
    mergeResult: null,      // 合并结果
    expandedFile: null      // 当前展开的文件索引
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: 'PDF文件合并'
    });
  },

  // 选择PDF文件
  choosePDF: function() {
    var that = this;
    
    // 检查文件数量限制
    if (that.data.pdfFiles.length >= that.data.maxFiles) {
      wx.showToast({
        title: '最多选择' + that.data.maxFiles + '个文件',
        icon: 'none'
      });
      return;
    }
    
    wx.chooseMessageFile({
      count: that.data.maxFiles - that.data.pdfFiles.length,
      type: 'file',
      extension: ['pdf'],
      success: function(res) {
        var files = res.tempFiles;
        var newFiles = [];
        
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          
          // 验证文件大小
          if (that.data.totalSize + file.size > that.data.maxSize * 1024 * 1024) {
            wx.showToast({
              title: '文件总大小超过' + that.data.maxSize + 'MB',
              icon: 'none'
            });
            break;
          }
          
          newFiles.push({
            path: file.path,
            name: file.name,
            size: file.size,
            sizeFormatted: that.formatFileSize(file.size),
            pageCount: 0,
            selectedPages: 'all',  // 默认选择全部页
            loading: true
          });
        }
        
        if (newFiles.length > 0) {
          var allFiles = that.data.pdfFiles.concat(newFiles);
          that.setData({
            pdfFiles: allFiles
          });
          
          // 获取每个新文件的页数
          for (var j = 0; j < newFiles.length; j++) {
            that.getPdfPageCount(that.data.pdfFiles.length - newFiles.length + j);
          }
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

  // 获取PDF页数
  getPdfPageCount: function(fileIndex) {
    var that = this;
    var file = that.data.pdfFiles[fileIndex];
    
    wx.uploadFile({
      url: serverUrl + '/pdf/page-count',
      filePath: file.path,
      name: 'file',
      success: function(res) {
        if (res.statusCode === 200) {
          var data = JSON.parse(res.data);
          var updateKey = 'pdfFiles[' + fileIndex + ']';
          
          that.setData({
            [updateKey + '.pageCount']: data.page_count,
            [updateKey + '.loading']: false
          });
          
          // 更新总页数
          that.updateTotalStats();
        }
      },
      fail: function() {
        var updateKey = 'pdfFiles[' + fileIndex + ']';
        that.setData({
          [updateKey + '.loading']: false,
          [updateKey + '.pageCount']: 0
        });
      }
    });
  },

  // 更新总统计
  updateTotalStats: function() {
    var that = this;
    var totalPages = 0;
    var totalSize = 0;
    
    for (var i = 0; i < that.data.pdfFiles.length; i++) {
      var file = that.data.pdfFiles[i];
      totalSize += file.size;
      
      if (file.selectedPages === 'all') {
        totalPages += file.pageCount;
      } else {
        // 计算选中的页数
        var selectedCount = that.countSelectedPages(file.selectedPages, file.pageCount);
        totalPages += selectedCount;
      }
    }
    
    that.setData({
      totalPages: totalPages,
      totalSize: totalSize
    });
  },

  // 计算选中的页数
  countSelectedPages: function(pagesStr, totalPages) {
    if (!pagesStr || pagesStr === 'all') {
      return totalPages;
    }
    
    var count = 0;
    var parts = pagesStr.split(',');
    
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf('-') >= 0) {
        var range = part.split('-');
        var start = parseInt(range[0]);
        var end = parseInt(range[1]);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          count += (end - start + 1);
        }
      } else {
        var page = parseInt(part);
        if (!isNaN(page)) {
          count++;
        }
      }
    }
    
    return count;
  },

  // 删除文件
  deleteFile: function(e) {
    var that = this;
    var index = e.currentTarget.dataset.index;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个文件吗？',
      success: function(res) {
        if (res.confirm) {
          var files = that.data.pdfFiles;
          files.splice(index, 1);
          
          that.setData({
            pdfFiles: files,
            expandedFile: null
          });
          
          that.updateTotalStats();
        }
      }
    });
  },

  // 切换文件展开/收起
  toggleFileExpand: function(e) {
    var index = e.currentTarget.dataset.index;
    var expandedFile = this.data.expandedFile === index ? null : index;
    
    this.setData({
      expandedFile: expandedFile
    });
  },

  // 页码选择输入变化
  onPagesInput: function(e) {
    var that = this;
    var index = e.currentTarget.dataset.index;
    var value = e.detail.value;
    
    var updateKey = 'pdfFiles[' + index + '].selectedPages';
    that.setData({
      [updateKey]: value
    });
    
    that.updateTotalStats();
  },

  // 选择全部页
  selectAllPages: function(e) {
    var index = e.currentTarget.dataset.index;
    var updateKey = 'pdfFiles[' + index + '].selectedPages';
    
    this.setData({
      [updateKey]: 'all'
    });
    
    this.updateTotalStats();
  },

  // 文件上移
  moveUp: function(e) {
    var index = e.currentTarget.dataset.index;
    if (index === 0) return;
    
    var files = this.data.pdfFiles;
    var temp = files[index];
    files[index] = files[index - 1];
    files[index - 1] = temp;
    
    this.setData({
      pdfFiles: files
    });
  },

  // 文件下移
  moveDown: function(e) {
    var index = e.currentTarget.dataset.index;
    if (index === this.data.pdfFiles.length - 1) return;
    
    var files = this.data.pdfFiles;
    var temp = files[index];
    files[index] = files[index + 1];
    files[index + 1] = temp;
    
    this.setData({
      pdfFiles: files
    });
  },

  // 开始合并
  startMerge: function() {
    var that = this;
    
    // 验证
    if (that.data.pdfFiles.length === 0) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }
    
    if (that.data.pdfFiles.length < 2) {
      wx.showToast({
        title: '至少需要2个PDF文件',
        icon: 'none'
      });
      return;
    }
    
    if (that.data.totalPages > that.data.maxPages) {
      wx.showToast({
        title: '总页数超过' + that.data.maxPages + '页限制',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否所有文件都已加载页数
    for (var i = 0; i < that.data.pdfFiles.length; i++) {
      if (that.data.pdfFiles[i].loading || that.data.pdfFiles[i].pageCount === 0) {
        wx.showToast({
          title: '文件信息加载中，请稍候',
          icon: 'none'
        });
        return;
      }
    }
    
    that.setData({
      merging: true
    });
    
    wx.showLoading({
      title: '合并中...',
      mask: true
    });
    
    // 准备上传数据
    var formData = {
      pages_config: JSON.stringify(
        that.data.pdfFiles.map(function(file, index) {
          return {
            file_index: index,
            pages: file.selectedPages
          };
        })
      )
    };
    
    // 创建上传任务
    that.uploadFilesForMerge(formData);
  },

  // 上传文件并合并
  uploadFilesForMerge: function(formData) {
    var that = this;
    var uploadedFiles = [];
    var currentIndex = 0;
    
    // 递归上传每个文件到临时目录
    function uploadNextFile() {
      if (currentIndex >= that.data.pdfFiles.length) {
        // 所有文件上传完成，调用合并API
        that.callMergeAPI(uploadedFiles);
        return;
      }
      
      var file = that.data.pdfFiles[currentIndex];
      var fileIndex = currentIndex;
      
      wx.showLoading({
        title: '上传中 ' + (currentIndex + 1) + '/' + that.data.pdfFiles.length,
        mask: true
      });
      
      wx.uploadFile({
        url: serverUrl + '/pdf/upload-temp',
        filePath: file.path,
        name: 'file',
        formData: {
          file_index: fileIndex,
          selected_pages: file.selectedPages
        },
        success: function(res) {
          if (res.statusCode === 200) {
            var data = JSON.parse(res.data);
            uploadedFiles.push({
              file_id: data.file_id,
              file_index: fileIndex,
              selected_pages: file.selectedPages
            });
            
            currentIndex++;
            uploadNextFile();
          } else {
            wx.hideLoading();
            that.setData({
              merging: false
            });
            wx.showToast({
              title: '文件上传失败',
              icon: 'none'
            });
          }
        },
        fail: function() {
          wx.hideLoading();
          that.setData({
            merging: false
          });
          wx.showToast({
            title: '文件上传失败',
            icon: 'none'
          });
        }
      });
    }
    
    uploadNextFile();
  },

  // 调用合并API
  callMergeAPI: function(uploadedFiles) {
    var that = this;
    
    wx.showLoading({
      title: '正在合并...',
      mask: true
    });
    
    wx.request({
      url: serverUrl + '/pdf/merge-uploaded',
      method: 'POST',
      data: {
        files: uploadedFiles
      },
      success: function(res) {
        wx.hideLoading();
        that.setData({
          merging: false
        });
        
        if (res.statusCode === 200 && res.data.success) {
          that.setData({
            mergeResult: res.data
          });
          
          wx.showToast({
            title: '合并成功！',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.data.error || '合并失败',
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: function() {
        wx.hideLoading();
        that.setData({
          merging: false
        });
        
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 下载合并后的文件
  downloadMerged: function() {
    var that = this;
    
    if (!that.data.mergeResult) return;
    
    wx.showLoading({
      title: '准备下载...',
      mask: true
    });
    
    wx.downloadFile({
      url: serverUrl + that.data.mergeResult.download_url,
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            success: function() {
              console.log('打开文档成功');
            }
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

  // 重新开始
  resetMerge: function() {
    this.setData({
      pdfFiles: [],
      totalPages: 0,
      totalSize: 0,
      mergeResult: null,
      expandedFile: null
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

  // 格式化总大小
  formatTotalSize: function() {
    return this.formatFileSize(this.data.totalSize);
  }
});
