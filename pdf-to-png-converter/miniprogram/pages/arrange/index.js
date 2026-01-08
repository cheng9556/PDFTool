// pages/arrange/index.js
// 使用全局配置
const config = require('../../utils/config');
var serverUrl = config.pythonServer;

Page({
  data: {
    serverUrl: serverUrl,
    pdfFiles: [],  // 已上传的PDF文件列表 [{file_id, filename, total_pages, thumbnails, pages}]
    selectedPages: [],  // 已选择的页面 [{file_id, filename, page_number, thumbnail, new_page_number}]
    processing: false,
    processComplete: false,
    processResult: null,
    longPressIndex: -1  // 长按的页面索引（用于拖动排序）
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: 'PDF页面编排'
    });
  },

  // 选择PDF文件（支持多选）
  choosePdf: function() {
    var that = this;
    
    wx.chooseMessageFile({
      count: 10,  // 最多选择10个文件
      type: 'file',
      extension: ['pdf'],
      success: function(res) {
        if (res.tempFiles && res.tempFiles.length) {
          // 逐个上传文件
          that.uploadPdfFiles(res.tempFiles);
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

  // 上传多个PDF文件
  uploadPdfFiles: function(files) {
    var that = this;
    var uploadCount = 0;
    var totalFiles = files.length;
    
    wx.showLoading({
      title: `上传中 (0/${totalFiles})`,
      mask: true
    });
    
    files.forEach(function(file) {
      // 检查文件大小
      if (file.size > 50 * 1024 * 1024) {
        wx.showToast({
          title: file.name + ' 超过50MB',
          icon: 'none'
        });
        uploadCount++;
        if (uploadCount === totalFiles) {
          wx.hideLoading();
        }
        return;
      }
      
      wx.uploadFile({
        url: serverUrl + '/pdf/arrange/upload',
        filePath: file.path,
        name: 'file',
        success: function(res) {
          uploadCount++;
          wx.showLoading({
            title: `上传中 (${uploadCount}/${totalFiles})`,
            mask: true
          });
          
          if (res.statusCode === 200) {
            try {
              var data = JSON.parse(res.data);
              if (data.success) {
                // 生成页码数组（不包含缩略图）
              var pageNumbers = [];
              for (var i = 1; i <= data.total_pages; i++) {
                pageNumbers.push({
                  page_number: i,
                  selected: false  // 是否已选择
                });
              }
              
              var pdfFile = {
                  file_id: data.file_id,
                  filename: data.filename,
                  total_pages: data.total_pages,
                  pages: pageNumbers,  // 页码数组
                  selectedPages: []  // 该文件已选择的页面编号
                };
                
                var pdfFiles = that.data.pdfFiles;
                pdfFiles.push(pdfFile);
                that.setData({
                  pdfFiles: pdfFiles
                });
              }
            } catch(e) {
              console.error('解析响应失败:', e);
            }
          }
          
          if (uploadCount === totalFiles) {
            wx.hideLoading();
            if (that.data.pdfFiles.length > 0) {
              wx.showToast({
                title: '上传成功',
                icon: 'success'
              });
            }
          }
        },
        fail: function(err) {
          uploadCount++;
          console.error('上传失败:', err);
          if (uploadCount === totalFiles) {
            wx.hideLoading();
          }
        }
      });
    });
  },

  // 点击页面添加到右侧
  selectPage: function(e) {
    var that = this;
    var fileIndex = parseInt(e.currentTarget.dataset.fileIndex);
    var pageNumber = parseInt(e.currentTarget.dataset.pageNumber);
    
    var pdfFile = that.data.pdfFiles[fileIndex];
    if (!pdfFile) return;
    
    // 检查该页面是否已选择
    var existingIndex = -1;
    for (var i = 0; i < that.data.selectedPages.length; i++) {
      var page = that.data.selectedPages[i];
      if (page.file_id === pdfFile.file_id && page.page_number === pageNumber) {
        existingIndex = i;
        break;
      }
    }
    
    if (existingIndex >= 0) {
      // 已选择，取消选择
      var selectedPages = that.data.selectedPages;
      selectedPages.splice(existingIndex, 1);
      // 更新新页码
      that.updatePageNumbers(selectedPages);
      // 从文件的selectedPages数组中移除
      var pageIndex = pdfFile.selectedPages.indexOf(pageNumber);
      if (pageIndex >= 0) {
        pdfFile.selectedPages.splice(pageIndex, 1);
      }
      
      // 更新pages数组的selected状态
      for (var k = 0; k < pdfFile.pages.length; k++) {
        if (pdfFile.pages[k].page_number === pageNumber) {
          pdfFile.pages[k].selected = false;
          break;
        }
      }
    } else {
      // 未选择，添加到右侧
      var newPage = {
        file_id: pdfFile.file_id,
        filename: pdfFile.filename,
        page_number: pageNumber,
        thumbnail: '',  // 先设为空，稍后加载
        new_page_number: that.data.selectedPages.length + 1,
        loading: true  // 标记正在加载缩略图
      };
      
      var selectedPages = that.data.selectedPages;
      selectedPages.push(newPage);
      that.setData({
        selectedPages: selectedPages
      });
      
      // 添加到文件的selectedPages数组
      if (pdfFile.selectedPages.indexOf(pageNumber) < 0) {
        pdfFile.selectedPages.push(pageNumber);
      }
      
      // 更新pages数组的selected状态
      for (var k = 0; k < pdfFile.pages.length; k++) {
        if (pdfFile.pages[k].page_number === pageNumber) {
          pdfFile.pages[k].selected = true;
          break;
        }
      }
      
      // 获取该页面的缩略图
      that.loadPageThumbnail(fileIndex, selectedPages.length - 1, pdfFile.file_id, pageNumber);
    }
    
    // 更新文件列表
    var pdfFiles = that.data.pdfFiles;
    pdfFiles[fileIndex] = pdfFile;
    that.setData({
      pdfFiles: pdfFiles
    });
  },

  // 加载页面缩略图
  loadPageThumbnail: function(fileIndex, pageIndex, fileId, pageNumber) {
    var that = this;
    
    wx.request({
      url: serverUrl + '/pdf/arrange/thumbnail',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        file_id: fileId,
        page_number: pageNumber
      },
      success: function(res) {
        if (res.statusCode === 200 && res.data.success) {
          var selectedPages = that.data.selectedPages;
          if (selectedPages[pageIndex]) {
            selectedPages[pageIndex].thumbnail = res.data.thumbnail;
            selectedPages[pageIndex].loading = false;
            that.setData({
              selectedPages: selectedPages
            });
          }
        }
      },
      fail: function(err) {
        console.error('加载缩略图失败:', err);
        var selectedPages = that.data.selectedPages;
        if (selectedPages[pageIndex]) {
          selectedPages[pageIndex].loading = false;
          that.setData({
            selectedPages: selectedPages
          });
        }
      }
    });
  },

  // 更新页面新页码
  updatePageNumbers: function(selectedPages) {
    for (var i = 0; i < selectedPages.length; i++) {
      selectedPages[i].new_page_number = i + 1;
    }
    this.setData({
      selectedPages: selectedPages
    });
  },

  // 删除已上传的文件
  deleteFile: function(e) {
    var that = this;
    var fileIndex = parseInt(e.currentTarget.dataset.fileIndex);
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个文件吗？',
      success: function(res) {
        if (res.confirm) {
          var pdfFile = that.data.pdfFiles[fileIndex];
          
          // 从selectedPages中移除该文件的所有页面
          var selectedPages = that.data.selectedPages.filter(function(page) {
            return page.file_id !== pdfFile.file_id;
          });
          that.updatePageNumbers(selectedPages);
          
          // 从pdfFiles中移除
          var pdfFiles = that.data.pdfFiles;
          pdfFiles.splice(fileIndex, 1);
          
          that.setData({
            pdfFiles: pdfFiles,
            selectedPages: selectedPages
          });
        }
      }
    });
  },

  // 移动页面顺序（上移）
  movePageUp: function(e) {
    var index = parseInt(e.currentTarget.dataset.index);
    if (index <= 0) return;
    
    var selectedPages = this.data.selectedPages;
    var temp = selectedPages[index];
    selectedPages[index] = selectedPages[index - 1];
    selectedPages[index - 1] = temp;
    this.updatePageNumbers(selectedPages);
  },

  // 移动页面顺序（下移）
  movePageDown: function(e) {
    var index = parseInt(e.currentTarget.dataset.index);
    if (index >= this.data.selectedPages.length - 1) return;
    
    var selectedPages = this.data.selectedPages;
    var temp = selectedPages[index];
    selectedPages[index] = selectedPages[index + 1];
    selectedPages[index + 1] = temp;
    this.updatePageNumbers(selectedPages);
  },

  // 删除已选择的页面
  removeSelectedPage: function(e) {
    var that = this;
    var index = parseInt(e.currentTarget.dataset.index);
    var page = that.data.selectedPages[index];
    
    // 从selectedPages中移除
    var selectedPages = that.data.selectedPages;
    selectedPages.splice(index, 1);
    that.updatePageNumbers(selectedPages);
    
    // 从对应文件的selectedPages数组中移除
    for (var i = 0; i < that.data.pdfFiles.length; i++) {
      var pdfFile = that.data.pdfFiles[i];
      if (pdfFile.file_id === page.file_id) {
        var pageIndex = pdfFile.selectedPages.indexOf(page.page_number);
        if (pageIndex >= 0) {
          pdfFile.selectedPages.splice(pageIndex, 1);
        }
        
        // 更新pages数组的selected状态
        for (var k = 0; k < pdfFile.pages.length; k++) {
          if (pdfFile.pages[k].page_number === page.page_number) {
            pdfFile.pages[k].selected = false;
            break;
          }
        }
        
        var pdfFiles = that.data.pdfFiles;
        pdfFiles[i] = pdfFile;
        that.setData({
          pdfFiles: pdfFiles
        });
        break;
      }
    }
    
    that.setData({
      selectedPages: selectedPages
    });
  },

  // 生成编排后的PDF
  generatePdf: function() {
    var that = this;
    
    if (that.data.selectedPages.length === 0) {
      wx.showToast({
        title: '请至少选择一页',
        icon: 'none'
      });
      return;
    }
    
    // 按照用户选择的顺序构建页面顺序数组
    var pagesOrder = that.data.selectedPages.map(function(page) {
      return {
        file_id: page.file_id,
        page_number: page.page_number
      };
    });
    
    that.setData({
      processing: true
    });
    
    wx.showLoading({
      title: '生成中...',
      mask: true
    });
    
    wx.request({
      url: serverUrl + '/pdf/arrange/generate',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        pages_order: pagesOrder
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200 && res.data.success) {
          // 格式化文件大小
          var result = res.data;
          result.file_size_formatted = (result.file_size / 1024).toFixed(1) + ' KB';
          
          that.setData({
            processing: false,
            processComplete: true,
            processResult: result
          });
        } else {
          wx.showToast({
            title: res.data.error || '生成失败',
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
        console.error('生成失败:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
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
    
    var downloadUrl = that.data.processResult.url;
    var fullUrl = that.data.serverUrl + downloadUrl;
    
    wx.showLoading({
      title: '下载中...',
      mask: true
    });
    
    wx.downloadFile({
      url: fullUrl,
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

  // 重置
  reset: function() {
    this.setData({
      pdfFiles: [],
      selectedPages: [],
      processing: false,
      processComplete: false,
      processResult: null
    });
  }
});

