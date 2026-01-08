// pages/rotate/index.js
// 使用全局配置
const config = require('../../utils/config');
var serverUrl = config.pythonServer;

Page({
  data: {
    serverUrl: serverUrl,
    pdfFile: '',
    fileName: '',
    fileSize: 0,
    fileSizeFormatted: '',
    totalPages: 0,
    pages: [],  // 页面列表 [{pageNumber, thumbnail, rotation}]
    displayPages: [],  // 当前页显示的页面列表（分页）
    selectedPageIndex: -1,  // 选中的页面索引
    rotationMap: {},  // 页面旋转角度映射 {pageNumber: angle}
    // 分页相关
    currentPage: 1,  // 当前页码
    pageSize: 6,    // 每页显示数量
    totalPageCount: 0,  // 总页数（分页）
    // 旋转角度选项
    angleOptions: [
      { value: 0, label: '0°' },
      { value: 90, label: '90°' },
      { value: 180, label: '180°' },
      { value: 270, label: '270°' }
    ],
    showAnglePicker: false,  // 是否显示角度选择器
    processing: false,  // 是否正在处理
    processComplete: false,  // 处理是否完成
    processResult: null  // 处理结果
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: 'PDF页面旋转'
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
          if (file.size > 50 * 1024 * 1024) {
            wx.showToast({
              title: '文件不能超过50MB',
              icon: 'none'
            });
            return;
          }
          
          that.setData({
            pdfFile: file.path,
            fileName: file.name,
            fileSize: file.size,
            fileSizeFormatted: that.formatFileSize(file.size),
            totalPages: 0,
            pages: [],
            displayPages: [],
            selectedPageIndex: -1,
            rotationMap: {},
            currentPage: 1,
            totalPageCount: 0,
            processing: false,
            processComplete: false,
            processResult: null
          });
          
          // 获取PDF页数和缩略图
          that.getPdfPages(file.path);
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

  // 获取PDF页面信息
  getPdfPages: function(filePath) {
    var that = this;
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.uploadFile({
      url: serverUrl + '/pdf/get-pages',
      filePath: filePath,
      name: 'pdf_file',
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          var data = JSON.parse(res.data);
          if (data.success) {
            var pages = data.thumbnails.map(function(thumb) {
              return {
                pageNumber: thumb.page_number,
                thumbnail: thumb.thumbnail,
                rotation: 0  // 初始旋转角度为0
              };
            });
            
            // 计算分页
            var totalPageCount = Math.ceil(pages.length / that.data.pageSize);
            
            // 更新显示页面
            that.updateDisplayPages(pages, 1);
            
            that.setData({
              totalPages: data.total_pages,
              pages: pages,
              totalPageCount: totalPageCount,
              currentPage: 1
            });
          }
        } else {
          var errorMsg = '加载失败';
          try {
            var errorData = JSON.parse(res.data);
            errorMsg = errorData.error || errorMsg;
          } catch(e) {}
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('获取页面失败:', err);
        wx.showToast({
          title: '网络请求失败，请检查服务是否运行',
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  // 更新显示页面（分页）
  updateDisplayPages: function(pages, currentPage) {
    var that = this;
    var pageSize = that.data.pageSize;
    var totalPageCount = Math.ceil(pages.length / pageSize);
    if (totalPageCount === 0) totalPageCount = 1;
    
    // 确保当前页不超出范围
    if (currentPage > totalPageCount) {
      currentPage = totalPageCount;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }
    
    var startIndex = (currentPage - 1) * pageSize;
    var endIndex = startIndex + pageSize;
    var displayPages = pages.slice(startIndex, endIndex);
    
    that.setData({
      displayPages: displayPages,
      currentPage: currentPage,
      totalPageCount: totalPageCount,
      pages: pages  // 同时更新完整页面列表
    });
  },

  // 上一页
  goToPrevPage: function() {
    if (this.data.currentPage > 1) {
      this.updateDisplayPages(this.data.pages, this.data.currentPage - 1);
    }
  },

  // 下一页
  goToNextPage: function() {
    if (this.data.currentPage < this.data.totalPageCount) {
      this.updateDisplayPages(this.data.pages, this.data.currentPage + 1);
    }
  },

  // 选择页面（点击缩略图）
  selectPage: function(e) {
    var that = this;
    var displayIndex = parseInt(e.currentTarget.dataset.index);
    var actualIndex = (that.data.currentPage - 1) * that.data.pageSize + displayIndex;
    
    if (actualIndex < 0 || actualIndex >= that.data.pages.length) {
      return;
    }
    
    var page = that.data.pages[actualIndex];
    var currentRotation = that.data.rotationMap[page.pageNumber] || 0;
    
    that.setData({
      selectedPageIndex: actualIndex,
      showAnglePicker: true
    });
  },

  // 选择旋转角度
  selectAngle: function(e) {
    var that = this;
    var angle = parseInt(e.currentTarget.dataset.angle);
    var selectedIndex = that.data.selectedPageIndex;
    
    if (selectedIndex < 0 || selectedIndex >= that.data.pages.length) {
      return;
    }
    
    var page = that.data.pages[selectedIndex];
    var rotationMap = that.data.rotationMap;
    
    // 更新旋转角度
    if (angle === 0) {
      // 如果选择0度，移除该页面的旋转记录
      delete rotationMap[page.pageNumber];
    } else {
      rotationMap[page.pageNumber] = angle;
    }
    
    // 更新页面列表中的旋转角度（用于显示）
    var pages = that.data.pages;
    pages[selectedIndex].rotation = angle;
    
    // 更新显示
    that.updateDisplayPages(pages, that.data.currentPage);
    
    that.setData({
      rotationMap: rotationMap,
      showAnglePicker: false,
      selectedPageIndex: -1
    });
    
    wx.showToast({
      title: `第${page.pageNumber}页已设置为${angle}°`,
      icon: 'success',
      duration: 1500
    });
  },

  // 关闭角度选择器
  closeAnglePicker: function() {
    this.setData({
      showAnglePicker: false,
      selectedPageIndex: -1
    });
  },

  // 开始旋转
  startRotate: function() {
    var that = this;
    
    if (!that.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }
    
    var rotationMap = that.data.rotationMap;
    var pagesToRotate = Object.keys(rotationMap);
    
    if (pagesToRotate.length === 0) {
      wx.showToast({
        title: '请至少选择一页进行旋转',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查是否有非0度的旋转
    var hasRotation = false;
    for (var pageNum in rotationMap) {
      if (rotationMap[pageNum] !== 0) {
        hasRotation = true;
        break;
      }
    }
    
    if (!hasRotation) {
      wx.showToast({
        title: '请至少选择一页进行旋转（角度不为0°）',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    that.setData({
      processing: true
    });
    
    wx.showLoading({
      title: '旋转中...',
      mask: true
    });
    
    // 准备旋转数据：收集所有需要旋转的页面和角度（高性能批量模式）
    // 构建 {pageNumber: angle} 格式的JSON，支持不同页面不同角度
    var rotationAngles = {};  // {pageNumber: angle}
    
    for (var pageNum in rotationMap) {
      var angle = rotationMap[pageNum];
      if (angle !== 0) {
        // 只包含非0度的旋转（0度表示不旋转）
        rotationAngles[pageNum] = angle;
      }
    }
    
    // 使用批量模式：一次性发送所有页面和角度（高性能，只需一次请求）
    var pagesAnglesJson = JSON.stringify(rotationAngles);
    
    wx.uploadFile({
      url: serverUrl + '/pdf/rotate',
      filePath: that.data.pdfFile,
      name: 'file',
      formData: {
        'pages_angles': pagesAnglesJson
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
                  processResult: data
                });
                wx.showToast({
                  title: '旋转完成！',
                  icon: 'success'
                });
              } else {
                that.setData({
                  processing: false
                });
                wx.showToast({
                  title: data.error || '旋转失败',
                  icon: 'none',
                  duration: 3000
                });
              }
            } catch(e) {
              that.setData({
                processing: false
              });
              wx.showToast({
                title: '解析响应失败',
                icon: 'none'
              });
            }
          } else {
            that.setData({
              processing: false
            });
            var errorMsg = '旋转失败';
            try {
              var errorData = JSON.parse(res.data);
              errorMsg = errorData.error || errorMsg;
            } catch(e) {}
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 3000
            });
          }
        },
        fail: function() {
          wx.hideLoading();
          that.setData({
            processing: false
          });
          wx.showToast({
            title: '网络请求失败',
            icon: 'none'
          });
        }
      });
  },


  // 下载结果
  downloadResult: function() {
    var that = this;
    
    if (!that.data.processResult) return;
    
    wx.showLoading({
      title: '准备下载...',
      mask: true
    });
    
    wx.downloadFile({
      url: serverUrl + that.data.processResult.download_url,
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
  resetFile: function() {
    this.setData({
      pdfFile: '',
      fileName: '',
      fileSize: 0,
      fileSizeFormatted: '',
      totalPages: 0,
      pages: [],
      displayPages: [],
      selectedPageIndex: -1,
      rotationMap: {},
      currentPage: 1,
      totalPageCount: 0,
      showAnglePicker: false,
      processing: false,
      processComplete: false,
      processResult: null
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
  }
});
