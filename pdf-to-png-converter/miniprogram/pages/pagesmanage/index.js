// pages/pagesmanage/index.js
var serverUrl = 'http://localhost:8789';

Page({
  data: {
    pdfFile: '',
    fileName: '',
    fileSize: 0,
    fileSizeFormatted: '',
    totalPages: 0,
    pages: [],  // 页面列表 [{pageNumber, thumbnail, originalPageNumber}]
    displayPages: [],  // 当前页显示的页面列表（分页）
    deletedPages: [],  // 要删除的页面编号（原始编号）
    insertImages: [],  // 要插入的图片 [{position, imagePath, imageData}]
    managing: false,
    manageComplete: false,
    manageResult: null,
    // 分页相关
    currentPage: 1,  // 当前页码
    pageSize: 10,    // 每页显示数量
    totalPageCount: 0  // 总页数（分页）
  },

  onLoad: function() {
    wx.setNavigationBarTitle({
      title: 'PDF页面管理'
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
            deletedPages: [],
            insertImages: [],
            currentPage: 1,
            totalPageCount: 0,
            manageComplete: false,
            manageResult: null
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
                originalPageNumber: thumb.page_number  // 保存原始页码
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

  // 删除单个页面
  deleteSinglePage: function(e) {
    var that = this;
    var displayIndex = parseInt(e.currentTarget.dataset.index);
    var actualIndex = (that.data.currentPage - 1) * that.data.pageSize + displayIndex;
    
    if (actualIndex < 0 || actualIndex >= that.data.pages.length) {
      wx.showToast({
        title: '页面索引错误',
        icon: 'none'
      });
      return;
    }
    
    var page = that.data.pages[actualIndex];
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除第' + page.pageNumber + '页吗？',
      success: function(res) {
        if (res.confirm) {
          // 添加到删除列表（使用原始页码）
          var deletedPages = that.data.deletedPages || [];
          if (deletedPages.indexOf(page.originalPageNumber) === -1) {
            deletedPages.push(page.originalPageNumber);
          }
          
          // 从页面列表中移除该页面
          var pages = that.data.pages;
          var deletedPageNumber = page.pageNumber; // 删除的页面编号（显示编号）
          pages.splice(actualIndex, 1);
          
          // 重新编号（仅用于显示）
          for (var i = 0; i < pages.length; i++) {
            pages[i].pageNumber = i + 1;
          }
          
          // 更新插入图片的位置：如果插入位置在删除的页面之后，需要减1
          var insertImages = that.data.insertImages || [];
          for (var j = 0; j < insertImages.length; j++) {
            if (insertImages[j].position > deletedPageNumber) {
              insertImages[j].position = insertImages[j].position - 1;
            } else if (insertImages[j].position === deletedPageNumber) {
              // 如果插入位置正好是删除的页面，可以选择删除这个插入项或者调整位置
              // 这里选择调整到删除位置的前一个位置
              insertImages[j].position = Math.max(1, deletedPageNumber - 1);
            }
          }
          
          // 重新计算分页并更新显示
          var totalPageCount = Math.ceil(pages.length / that.data.pageSize);
          var newCurrentPage = that.data.currentPage;
          // 如果当前页没有内容了，回到上一页
          if (newCurrentPage > totalPageCount && totalPageCount > 0) {
            newCurrentPage = totalPageCount;
          }
          
          that.updateDisplayPages(pages, newCurrentPage);
          
          that.setData({
            deletedPages: deletedPages,
            totalPages: pages.length,
            insertImages: insertImages
          });
          
          wx.showToast({
            title: '已标记删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 选择插入图片
  chooseInsertImage: function(e) {
    var that = this;
    var position = e.currentTarget.dataset.position || (that.data.totalPages + 1);
    
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照', '从微信会话选择'],
      success: function(res) {
        if (res.tapIndex === 0) {
          // 从相册选择
          that.chooseImageFromAlbum(position);
        } else if (res.tapIndex === 1) {
          // 拍照
          that.takePhoto(position);
        } else if (res.tapIndex === 2) {
          // 从微信会话选择
          that.chooseImageFromMessage(position);
        }
      }
    });
  },
  
  // 在指定位置插入图片
  insertImageAtPosition: function(e) {
    var that = this;
    var position = e.currentTarget.dataset.position || 1;
    
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照', '从微信会话选择'],
      success: function(res) {
        if (res.tapIndex === 0) {
          that.chooseImageFromAlbum(position);
        } else if (res.tapIndex === 1) {
          that.takePhoto(position);
        } else if (res.tapIndex === 2) {
          that.chooseImageFromMessage(position);
        }
      }
    });
  },

  // 从相册选择图片
  chooseImageFromAlbum: function(position) {
    var that = this;
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: function(res) {
        that.processInsertImage(res.tempFilePaths[0], position);
      }
    });
  },

  // 拍照
  takePhoto: function(position) {
    var that = this;
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: function(res) {
        that.processInsertImage(res.tempFilePaths[0], position);
      }
    });
  },

  // 从微信会话选择
  chooseImageFromMessage: function(position) {
    var that = this;
    
    wx.chooseMessageFile({
      count: 1,
      type: 'image',
      success: function(res) {
        if (res.tempFiles && res.tempFiles.length) {
          that.processInsertImage(res.tempFiles[0].path, position);
        }
      },
      fail: function() {
        wx.showToast({
          title: '选择失败',
          icon: 'none'
        });
      }
    });
  },

  // 处理插入的图片
  processInsertImage: function(imagePath, position) {
    var that = this;
    
    // 检测图片格式
    var imageType = 'png'; // 默认PNG
    var lowerPath = imagePath.toLowerCase();
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      imageType = 'jpeg';
    } else if (lowerPath.endsWith('.png')) {
      imageType = 'png';
    }
    
    // 读取图片并转为base64
    wx.getFileSystemManager().readFile({
      filePath: imagePath,
      encoding: 'base64',
      success: function(res) {
        // 使用正确的MIME类型
        var imageData = 'data:image/' + imageType + ';base64,' + res.data;
        
        var insertImages = that.data.insertImages;
        insertImages.push({
          position: position,
          imagePath: imagePath,
          imageData: imageData
        });
        
        that.setData({
          insertImages: insertImages
        });
        
        wx.showToast({
          title: '图片已添加',
          icon: 'success'
        });
      },
      fail: function(err) {
        console.error('图片处理失败:', err);
        wx.showToast({
          title: '图片处理失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 删除插入的图片
  deleteInsertImage: function(e) {
    var index = e.currentTarget.dataset.index;
    var insertImages = this.data.insertImages;
    insertImages.splice(index, 1);
    
    this.setData({
      insertImages: insertImages
    });
  },

  // 上移页面
  movePageUp: function(e) {
    var that = this;
    var displayIndex = parseInt(e.currentTarget.dataset.index);
    var actualIndex = (that.data.currentPage - 1) * that.data.pageSize + displayIndex;
    
    if (actualIndex <= 0 || actualIndex >= that.data.pages.length) return;
    
    var pages = that.data.pages;
    var temp = pages[actualIndex];
    pages[actualIndex] = pages[actualIndex - 1];
    pages[actualIndex - 1] = temp;
    
    // 重新编号
    for (var i = 0; i < pages.length; i++) {
      pages[i].pageNumber = i + 1;
    }
    
    // 如果上移后，当前项移到了上一页，需要切换到上一页
    var newCurrentPage = that.data.currentPage;
    if (displayIndex === 0 && newCurrentPage > 1) {
      newCurrentPage = newCurrentPage - 1;
    }
    
    // 更新显示页面
    that.updateDisplayPages(pages, newCurrentPage);
  },

  // 下移页面
  movePageDown: function(e) {
    var that = this;
    var displayIndex = parseInt(e.currentTarget.dataset.index);
    var actualIndex = (that.data.currentPage - 1) * that.data.pageSize + displayIndex;
    
    if (actualIndex >= that.data.pages.length - 1 || actualIndex < 0) return;
    
    var pages = that.data.pages;
    var temp = pages[actualIndex];
    pages[actualIndex] = pages[actualIndex + 1];
    pages[actualIndex + 1] = temp;
    
    // 重新编号
    for (var i = 0; i < pages.length; i++) {
      pages[i].pageNumber = i + 1;
    }
    
    // 如果下移后，当前项移到了下一页，需要切换到下一页
    var newCurrentPage = that.data.currentPage;
    var pageSize = that.data.pageSize;
    if (displayIndex === pageSize - 1 && newCurrentPage < that.data.totalPageCount) {
      newCurrentPage = newCurrentPage + 1;
    }
    
    // 更新显示页面
    that.updateDisplayPages(pages, newCurrentPage);
  },

  // 开始处理
  startManage: function() {
    var that = this;
    
    if (!that.data.pdfFile) {
      wx.showToast({
        title: '请先选择PDF文件',
        icon: 'none'
      });
      return;
    }
    
    // 准备操作数据
    var deletePages = that.data.deletedPages || [];
    // 重排序：使用当前页面的原始页码（删除后剩余的页面）
    var reorder = that.data.pages.map(function(p) { return p.originalPageNumber; });
    var insertImages = that.data.insertImages.map(function(img) {
      return {
        position: img.position,
        image_data: img.imageData
      };
    });
    
    // 检查是否有任何操作
    var hasOperation = false;
    
    // 1. 检查删除页面
    if (deletePages.length > 0) {
      hasOperation = true;
    }
    
    // 2. 检查插入图片
    if (insertImages.length > 0) {
      hasOperation = true;
    }
    
    // 3. 检查重排序（比较当前顺序和原始顺序）
    if (!hasOperation && reorder.length > 0) {
      // 获取原始顺序（排除已删除的页面）
      var originalOrder = [];
      for (var i = 1; i <= that.data.totalPages; i++) {
        // 排除已删除的页面
        if (deletePages.indexOf(i) === -1) {
          originalOrder.push(i);
        }
      }
      
      // 比较顺序是否改变
      if (reorder.length !== originalOrder.length) {
        hasOperation = true;
      } else {
        for (var j = 0; j < reorder.length; j++) {
          if (reorder[j] !== originalOrder[j]) {
            hasOperation = true;
            break;
          }
        }
      }
    }
    
    // 如果没有操作，提示用户
    if (!hasOperation) {
      wx.showToast({
        title: '请至少执行一个操作（删除、插入或重排序）',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    that.setData({
      managing: true
    });
    
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 上传文件并处理
    wx.uploadFile({
      url: serverUrl + '/pdf/manage-pages',
      filePath: that.data.pdfFile,
      name: 'pdf_file',
      formData: {
        'delete_pages': JSON.stringify(deletePages),
        'reorder': JSON.stringify(reorder),
        'insert_images': JSON.stringify(insertImages)
      },
      success: function(res) {
        wx.hideLoading();
        that.setData({
          managing: false
        });
        
        if (res.statusCode === 200) {
          var data = JSON.parse(res.data);
          if (data.success) {
            that.setData({
              manageComplete: true,
              manageResult: data
            });
            
            wx.showToast({
              title: '处理成功！',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: data.error || '处理失败',
              icon: 'none',
              duration: 3000
            });
          }
        } else {
          var errorData = JSON.parse(res.data);
          wx.showToast({
            title: errorData.error || '处理失败',
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: function() {
        wx.hideLoading();
        that.setData({
          managing: false
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
    
    if (!that.data.manageResult) return;
    
    wx.showLoading({
      title: '准备下载...',
      mask: true
    });
    
    wx.downloadFile({
      url: serverUrl + that.data.manageResult.download_url,
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
      deletedPages: [],
      insertImages: [],
      currentPage: 1,
      totalPageCount: 0,
      managing: false,
      manageComplete: false,
      manageResult: null
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
