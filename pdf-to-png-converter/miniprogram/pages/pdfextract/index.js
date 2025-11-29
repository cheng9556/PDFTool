// PDF内容提取页面
const serverUrl = 'http://localhost:8789';

Page({
  data: {
    // PDF文件信息
    fileId: '',
    fileName: '',
    totalPages: 0,
    fileSize: 0,
    
    // 页面缩略图
    thumbnails: [],
    currentPage: 1,
    currentThumbnail: '',
    
    // 状态
    uploading: false,
    extracting: false,
    
    // 文本提取结果
    hasText: false,
    extractedText: '',
    
    // 图片提取选项
    showImageOptions: false,
    
    // 已上传标志
    pdfUploaded: false
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
        
        that.uploadPdf(file);
      },
      fail: function() {
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传PDF文件
  uploadPdf: function(file) {
    const that = this;
    
    that.setData({
      uploading: true
    });
    
    wx.showLoading({
      title: '上传中...',
      mask: true
    });
    
    wx.uploadFile({
      url: serverUrl + '/pdf/extract/upload',
      filePath: file.path,
      name: 'file',
      success: function(res) {
        const data = JSON.parse(res.data);
        
        if (res.statusCode === 200 && data.file_id) {
          that.setData({
            fileId: data.file_id,
            fileName: data.filename,
            totalPages: data.pages,
            fileSize: data.size,
            thumbnails: data.thumbnails,
            currentPage: 1,
            currentThumbnail: data.thumbnails[0].data,
            pdfUploaded: true,
            uploading: false
          });
          
          wx.hideLoading();
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: data.error || '上传失败',
            icon: 'none'
          });
          that.setData({ uploading: false });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
        that.setData({ uploading: false });
      }
    });
  },

  // 切换页面
  switchPage: function(e) {
    const pageNum = parseInt(e.currentTarget.dataset.page);
    
    this.setData({
      currentPage: pageNum,
      currentThumbnail: this.data.thumbnails[pageNum - 1].data,
      hasText: false,
      extractedText: ''
    });
  },

  // 复制文字
  copyText: function() {
    const that = this;
    
    if (that.data.extracting) {
      return;
    }
    
    that.setData({ extracting: true });
    
    wx.showLoading({
      title: '提取中...',
      mask: true
    });
    
    wx.request({
      url: serverUrl + '/pdf/extract/text',
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        file_id: that.data.fileId,
        page_num: that.data.currentPage
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          const data = res.data;
          
          if (data.has_text) {
            // 有文字，复制到剪贴板
            wx.setClipboardData({
              data: data.text,
              success: function() {
                wx.showToast({
                  title: '文字已复制',
                  icon: 'success'
                });
                
                that.setData({
                  hasText: true,
                  extractedText: data.text,
                  extracting: false
                });
              }
            });
          } else {
            // 无文字
            wx.showToast({
              title: '未检测到可复制文字',
              icon: 'none'
            });
            
            that.setData({
              hasText: false,
              extractedText: '',
              extracting: false
            });
          }
        } else {
          wx.showToast({
            title: res.data.error || '提取失败',
            icon: 'none'
          });
          that.setData({ extracting: false });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({
          title: '提取失败',
          icon: 'none'
        });
        that.setData({ extracting: false });
      }
    });
  },

  // 保存图像 - 显示选项
  showSaveImageOptions: function() {
    this.setData({
      showImageOptions: true
    });
  },

  // 隐藏选项
  hideSaveImageOptions: function() {
    this.setData({
      showImageOptions: false
    });
  },

  // 保存整个页面为图像
  savePageAsImage: function() {
    const that = this;
    
    that.setData({
      showImageOptions: false,
      extracting: true
    });
    
    wx.showLoading({
      title: '生成图像中...',
      mask: true
    });
    
    wx.request({
      url: serverUrl + '/pdf/extract/page-image',
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        file_id: that.data.fileId,
        page_num: that.data.currentPage,
        dpi: 200
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          const data = res.data;
          
          // 下载图像
          that.downloadImage(data.url, data.filename);
        } else {
          wx.showToast({
            title: res.data.error || '生成失败',
            icon: 'none'
          });
          that.setData({ extracting: false });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({
          title: '生成失败',
          icon: 'none'
        });
        that.setData({ extracting: false });
      }
    });
  },

  // 保存页面内嵌图像
  saveEmbeddedImages: function() {
    const that = this;
    
    that.setData({
      showImageOptions: false,
      extracting: true
    });
    
    wx.showLoading({
      title: '提取图片中...',
      mask: true
    });
    
    wx.request({
      url: serverUrl + '/pdf/extract/embedded-images',
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        file_id: that.data.fileId,
        page_num: that.data.currentPage
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          const data = res.data;
          
          if (data.image_count === 0) {
            wx.showToast({
              title: '该页面没有内嵌图片',
              icon: 'none'
            });
            that.setData({ extracting: false });
            return;
          }
          
          // 下载所有图片
          that.downloadMultipleImages(data.images);
        } else {
          wx.showToast({
            title: res.data.error || '提取失败',
            icon: 'none'
          });
          that.setData({ extracting: false });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({
          title: '提取失败',
          icon: 'none'
        });
        that.setData({ extracting: false });
      }
    });
  },

  // 下载单个图像
  downloadImage: function(url, filename) {
    const that = this;
    
    wx.downloadFile({
      url: serverUrl + url,
      success: function(res) {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function() {
              wx.showToast({
                title: '已保存到相册',
                icon: 'success'
              });
              that.setData({ extracting: false });
            },
            fail: function() {
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
              that.setData({ extracting: false });
            }
          });
        } else {
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
          that.setData({ extracting: false });
        }
      },
      fail: function() {
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
        that.setData({ extracting: false });
      }
    });
  },

  // 下载多个图像
  downloadMultipleImages: function(images) {
    const that = this;
    let downloadedCount = 0;
    const totalCount = images.length;
    
    wx.showLoading({
      title: `保存中 0/${totalCount}`,
      mask: true
    });
    
    images.forEach(function(image, index) {
      wx.downloadFile({
        url: serverUrl + image.url,
        success: function(res) {
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: function() {
                downloadedCount++;
                wx.showLoading({
                  title: `保存中 ${downloadedCount}/${totalCount}`,
                  mask: true
                });
                
                if (downloadedCount === totalCount) {
                  wx.hideLoading();
                  wx.showToast({
                    title: `已保存${totalCount}张图片`,
                    icon: 'success'
                  });
                  that.setData({ extracting: false });
                }
              },
              fail: function() {
                downloadedCount++;
                if (downloadedCount === totalCount) {
                  wx.hideLoading();
                  wx.showToast({
                    title: '部分图片保存失败',
                    icon: 'none'
                  });
                  that.setData({ extracting: false });
                }
              }
            });
          }
        }
      });
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
  resetUpload: function() {
    this.setData({
      fileId: '',
      fileName: '',
      totalPages: 0,
      thumbnails: [],
      currentPage: 1,
      pdfUploaded: false,
      hasText: false,
      extractedText: ''
    });
  }
});
