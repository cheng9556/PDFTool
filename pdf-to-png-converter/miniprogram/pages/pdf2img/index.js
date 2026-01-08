// 使用全局配置
const config = require('../../utils/config');

Page({
  data: {
    serverUrl: config.pythonServer,
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
    allImages: [], // 缓存所有转换的图片
    loading: false,
    converting: false,
    converted: false // 是否已转换全部页面
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
            allImages: [], // 清空缓存
            currentPage: 1,
            totalPages: 0,
            converted: false // 重置转换状态
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

  // 开始转换 - 转换全部页面
  startConvert() {
    const { tempFilePath } = this.data;
    if (!tempFilePath) {
      wx.showToast({ icon: 'none', title: '请先选择PDF文件' });
      return;
    }
    // 转换全部页面
    this.convertAllPages();
  },

  // 转换全部页面
  convertAllPages() {
    const { tempFilePath, serverUrl, formatIndex, formats, quality, dpiIndex, dpiOptions, pageSize } = this.data;
    
    if (!tempFilePath) return;

    const format = formats[formatIndex].toLowerCase();
    const dpi = dpiOptions[dpiIndex];

    this.setData({ loading: true, converting: true });
    wx.showLoading({ title: '转换全部页面中...' });

    wx.uploadFile({
      url: `${serverUrl}/pdf/to-images`,
      filePath: tempFilePath,
      name: 'file',
      formData: { 
        all_pages: 'true', // 转换全部页面
        format: format,
        quality: quality.toString(),
        dpi: dpi,
        page_size: pageSize.toString() // 用于计算总页数
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.error) {
            wx.showToast({ icon: 'none', title: data.error });
            this.setData({ loading: false, converting: false });
            return;
          }

          // 保存所有图片到缓存
          const allImages = data.images || [];
          const totalPdfPages = data.total_pdf_pages || 0;
          const totalPages = data.total_pages || 1;

          // 显示第一页
          const firstPageImages = this.getPageImages(allImages, 1, pageSize);

          this.setData({
            allImages: allImages, // 缓存所有图片
            images: firstPageImages, // 显示第一页
            currentPage: 1,
            totalPages: totalPages,
            totalPdfPages: totalPdfPages,
            loading: false,
            converting: false,
            converted: true // 标记已转换
          });

          wx.showToast({ 
            icon: 'success', 
            title: `已转换${totalPdfPages}页` 
          });

        } catch (err) {
          console.error('解析响应失败:', err);
          wx.showToast({ icon: 'none', title: '解析响应失败' });
          this.setData({ loading: false, converting: false });
        }
      },
      fail: (err) => {
        console.error('转换失败:', err);
        wx.showToast({ icon: 'none', title: '转换失败' });
        this.setData({ loading: false, converting: false });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 从缓存中获取指定页的图片
  getPageImages(allImages, page, pageSize) {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allImages.slice(startIndex, endIndex);
  },

  // 加载指定页（从缓存读取，不重新转换）
  loadPage(page) {
    const { allImages, pageSize, converted } = this.data;
    
    if (!converted || !allImages || allImages.length === 0) {
      // 如果还没有转换，先转换全部
      this.convertAllPages();
      return;
    }

    // 从缓存中获取指定页的图片
    const pageImages = this.getPageImages(allImages, page, pageSize);
    
    if (pageImages.length === 0) {
      wx.showToast({ icon: 'none', title: '该页没有图片' });
      return;
    }

    this.setData({
      images: pageImages,
      currentPage: page,
      loading: false
    });
  },

  // 上一页（从缓存读取，不重新转换）
  prevPage() {
    const { currentPage, converted } = this.data;
    if (currentPage > 1) {
      this.loadPage(currentPage - 1);
    } else if (!converted) {
      wx.showToast({ icon: 'none', title: '请先开始转换' });
    }
  },

  // 下一页（从缓存读取，不重新转换）
  nextPage() {
    const { currentPage, totalPages, converted } = this.data;
    if (currentPage < totalPages) {
      this.loadPage(currentPage + 1);
    } else if (!converted) {
      wx.showToast({ icon: 'none', title: '请先开始转换' });
    } else {
      wx.showToast({ icon: 'none', title: '已经是最后一页' });
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
    const { allImages, converted } = this.data;
    if (!converted || !allImages || allImages.length === 0) {
      wx.showToast({ icon: 'none', title: '没有图片可保存' });
      return;
    }

    wx.showModal({
      title: '保存全部',
      content: `确定要保存全部 ${allImages.length} 张图片吗？`,
      success: (res) => {
        if (res.confirm) {
          this.batchSaveAllImages();
        }
      }
    });
  },

  // 批量保存所有图片
  batchSaveAllImages() {
    const { allImages } = this.data;
    let savedCount = 0;

    wx.showLoading({ title: `保存中 0/${allImages.length}` });

    const saveNext = (index) => {
      if (index >= allImages.length) {
        wx.hideLoading();
        wx.showToast({ 
          icon: 'success', 
          title: `已保存${savedCount}张图片` 
        });
        return;
      }

      const img = allImages[index];
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
                title: `保存中 ${savedCount}/${allImages.length}` 
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
