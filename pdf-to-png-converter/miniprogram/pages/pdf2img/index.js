Page({
  data: {
    serverUrl: 'http://localhost:8789',
    tempFilePath: '',
    filename: '',
    fileSize: '',
    
    // 配置选项
    formats: ['PNG', 'JPG'],
    formatIndex: 0,
    quality: 85,
    dpiOptions: ['72', '150', '300', '600'],
    dpiIndex: 1, // 默认150
    
    // 分页
    pageSize: 6,
    currentPage: 1,
    totalPages: 0,
    totalPdfPages: 0,
    
    // 图片数据
    images: [],
    loading: false,
    converting: false
  },

  // 选择PDF文件
  choosePdf() {
    wx.chooseMessageFile({ 
      count: 1, 
      type: 'file', 
      extension: ['pdf'], 
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length) {
          const file = res.tempFiles[0];
          
          // 检查文件大小
          if (file.size > 50 * 1024 * 1024) {
            wx.showToast({ title: '文件不能超过50MB', icon: 'none' });
            return;
          }
          
          this.setData({ 
            tempFilePath: file.path, 
            filename: file.name || '已选择文件',
            fileSize: this.formatFileSize(file.size),
            images: [],
            currentPage: 1,
            totalPages: 0
          });
        }
      },
      fail: () => {
        wx.showToast({ icon: 'none', title: '选择文件失败' });
      }
    });
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  // 格式选择
  onFormatChange(e) {
    this.setData({ formatIndex: Number(e.detail.value) });
  },

  // DPI选择
  onDpiChange(e) {
    this.setData({ dpiIndex: Number(e.detail.value) });
  },

  // 质量调整
  onQualityChange(e) {
    this.setData({ quality: Number(e.detail.value) });
  },

  // 开始转换
  startConvert() {
    const { tempFilePath, currentPage } = this.data;
    if (!tempFilePath) {
      wx.showToast({ icon: 'none', title: '请先选择PDF文件' });
      return;
    }
    this.loadPage(currentPage);
  },

  // 加载指定页
  loadPage(page) {
    const { tempFilePath, serverUrl, formatIndex, formats, quality, dpiIndex, dpiOptions, pageSize } = this.data;
    
    if (!tempFilePath) return;

    const format = formats[formatIndex].toLowerCase();
    const dpi = dpiOptions[dpiIndex];

    this.setData({ loading: true, converting: true });
    wx.showLoading({ title: '转换中...' });

    wx.uploadFile({
      url: `${serverUrl}/pdf/to-images`,
      filePath: tempFilePath,
      name: 'file',
      formData: { 
        page: page.toString(),
        page_size: pageSize.toString(),
        format: format,
        quality: quality.toString(),
        dpi: dpi
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.error) {
            wx.showToast({ icon: 'none', title: data.error });
            return;
          }

          this.setData({
            images: data.images || [],
            currentPage: data.current_page,
            totalPages: data.total_pages,
            totalPdfPages: data.total_pdf_pages,
            loading: false,
            converting: false
          });

          wx.showToast({ 
            icon: 'success', 
            title: `已加载${data.images.length}张图片` 
          });

        } catch (err) {
          wx.showToast({ icon: 'none', title: '解析响应失败' });
        }
      },
      fail: () => {
        wx.showToast({ icon: 'none', title: '转换失败' });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ loading: false, converting: false });
      }
    });
  },

  // 上一页
  prevPage() {
    const { currentPage } = this.data;
    if (currentPage > 1) {
      this.loadPage(currentPage - 1);
    }
  },

  // 下一页
  nextPage() {
    const { currentPage, totalPages } = this.data;
    if (currentPage < totalPages) {
      this.loadPage(currentPage + 1);
    }
  },

  // 保存单张图片
  saveImage(e) {
    const { index } = e.currentTarget.dataset;
    const { images } = this.data;
    const img = images[index];

    if (!img || !img.image) return;

    wx.showLoading({ title: '保存中...' });

    const base64Data = img.image.split(',')[1];
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/page_${img.page}.png`;

    fs.writeFile({
      filePath: filePath,
      data: base64Data,
      encoding: 'base64',
      success: () => {
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: () => {
            wx.showToast({ icon: 'success', title: '已保存到相册' });
          },
          fail: (err) => {
            if (err.errMsg.indexOf('auth') > -1) {
              wx.showModal({
                title: '需要授权',
                content: '需要您授权保存图片到相册',
                success: (res) => {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                }
              });
            } else {
              wx.showToast({ icon: 'none', title: '保存失败' });
            }
          }
        });
      },
      fail: () => {
        wx.showToast({ icon: 'none', title: '保存失败' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 保存全部图片
  saveAllImages() {
    const { images } = this.data;
    if (images.length === 0) {
      wx.showToast({ icon: 'none', title: '没有图片可保存' });
      return;
    }

    wx.showModal({
      title: '保存全部',
      content: `确定要保存当前页的 ${images.length} 张图片吗？`,
      success: (res) => {
        if (res.confirm) {
          this.batchSaveImages();
        }
      }
    });
  },

  // 批量保存图片
  batchSaveImages() {
    const { images } = this.data;
    let savedCount = 0;

    wx.showLoading({ title: `保存中 0/${images.length}` });

    const saveNext = (index) => {
      if (index >= images.length) {
        wx.hideLoading();
        wx.showToast({ 
          icon: 'success', 
          title: `已保存${savedCount}张图片` 
        });
        return;
      }

      const img = images[index];
      const base64Data = img.image.split(',')[1];
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/page_${img.page}.png`;

      fs.writeFile({
        filePath: filePath,
        data: base64Data,
        encoding: 'base64',
        success: () => {
          wx.saveImageToPhotosAlbum({
            filePath: filePath,
            success: () => {
              savedCount++;
              wx.showLoading({ 
                title: `保存中 ${savedCount}/${images.length}` 
              });
              saveNext(index + 1);
            },
            fail: () => {
              saveNext(index + 1);
            }
          });
        },
        fail: () => {
          saveNext(index + 1);
        }
      });
    };

    saveNext(0);
  }
});
