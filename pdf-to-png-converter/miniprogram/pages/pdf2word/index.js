// Python后端服务地址（pdf2docx） - 增强版
const SERVER_URL = 'http://localhost:8789';

Page({
  data: {
    pdfFile: null,
    fileName: '',
    fileSize: '',
    converting: false,
    wordUrl: '',
    error: '',
    
    // 转换选项
    mode: 'premium',  // premium(推荐), fast, complex, simple, text-only
    includeImages: true,
    selectedPages: 'all',  // all, 或 "1,3,5" 或 "1-5"
    
    // UI状态
    showOptions: true,
    
    // 页码选择
    pageSelectionMode: 'all',  // all, range, custom
    pageRangeStart: '',
    pageRangeEnd: '',
    customPages: '',
    
    // 预览相关
    previews: [],           // 当前分页的预览图
    pageCount: 0,           // PDF总页数
    loadingPreview: false,  // 加载预览中
    previewCurrentPage: 1,  // 当前预览分页
    previewPageSize: 10,    // 每页显示10个预览
    previewTotalPages: 0,   // 预览总分页数
    selectedPreviewPages: [],  // 选中的预览页
    
    // 服务版本
    serviceVersion: '',     // 服务版本
    isOptimizedVersion: false  // 是否优化版
  },

  onLoad() {
    // 页面加载时检查服务版本
    this.checkServiceVersion();
  },

  // 选择文件
  chooseFile() {
    console.log('=== chooseFile clicked ===');
    
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: (res) => {
        console.log('[OK] File chosen:', res.tempFiles[0]);
        
        const file = res.tempFiles[0];
        console.log('File details:', {
          name: file.name,
          size: file.size,
          path: file.path
        });
        
        if (file.size > 50 * 1024 * 1024) {
          console.warn('[WARN] File too large:', file.size);
          wx.showToast({ title: '文件不能超过50MB', icon: 'none' });
          return;
        }
        
        console.log('[OK] Setting file data...');
        this.setData({
          pdfFile: file.path,
          fileName: file.name,
          fileSize: this.formatFileSize(file.size),
          wordUrl: '',
          error: '',
          previews: [],
          pageCount: 0,
          previewCurrentPage: 1,
          selectedPreviewPages: []
        });
        
        console.log('[OK] File data set, calling loadPreviews(1)...');
        // 自动获取预览
        this.loadPreviews(1);
      },
      fail: (err) => {
        console.error('[ERROR] File selection failed:', err);
        console.error('Error details:', JSON.stringify(err));
        wx.showToast({ title: '选择文件失败', icon: 'none' });
      }
    });
  },

  // 转换模式切换
  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
  },

  // 图片开关
  onImageToggle() {
    this.setData({ includeImages: !this.data.includeImages });
  },

  // 页码选择模式切换
  onPageModeChange(e) {
    const mode = e.detail.value;
    this.setData({ pageSelectionMode: mode });
  },

  // 页码范围输入
  onPageRangeStartInput(e) {
    this.setData({ pageRangeStart: e.detail.value });
  },

  onPageRangeEndInput(e) {
    this.setData({ pageRangeEnd: e.detail.value });
  },

  onCustomPagesInput(e) {
    this.setData({ customPages: e.detail.value });
  },

  // 构建页码参数
  buildPagesParam() {
    const { pageSelectionMode, pageRangeStart, pageRangeEnd, customPages } = this.data;
    
    if (pageSelectionMode === 'all') {
      return 'all';
    } else if (pageSelectionMode === 'range') {
      if (!pageRangeStart || !pageRangeEnd) {
        wx.showToast({ title: '请输入页码范围', icon: 'none' });
        return null;
      }
      return `${pageRangeStart}-${pageRangeEnd}`;
    } else if (pageSelectionMode === 'custom') {
      if (!customPages) {
        wx.showToast({ title: '请输入页码', icon: 'none' });
        return null;
      }
      return customPages;
    }
    
    return 'all';
  },

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  // 开始转换
  convertToWord() {
    if (!this.data.pdfFile || this.data.converting) return;

    const pagesParam = this.buildPagesParam();
    if (pagesParam === null) return;

    this.setData({ converting: true, error: '', wordUrl: '' });

    const formData = {
      mode: this.data.mode,
      pages: pagesParam,
      include_images: this.data.includeImages ? 'true' : 'false'
    };

    wx.uploadFile({
      url: `${SERVER_URL}/pdf/toword`,
      filePath: this.data.pdfFile,
      name: 'file',
      formData: formData,
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.error) {
            this.setData({ error: data.error, converting: false });
            wx.showToast({ title: '转换失败', icon: 'none' });
          } else {
            this.setData({ 
              wordUrl: SERVER_URL + data.url, 
              converting: false 
            });
            wx.showToast({ title: '转换成功', icon: 'success' });
          }
        } catch (e) {
          this.setData({ 
            error: '解析响应失败', 
            converting: false 
          });
          wx.showToast({ title: '转换失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        this.setData({ 
          error: '网络错误，请检查Python服务器是否启动 (端口8789)', 
          converting: false 
        });
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  // 下载Word文件
  downloadWord() {
    if (!this.data.wordUrl) return;

    wx.downloadFile({
      url: this.data.wordUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'docx',
            success: () => {
              console.log('打开文档成功');
            },
            fail: (err) => {
              console.error('打开文档失败:', err);
              wx.showToast({ title: '无法打开Word文件', icon: 'none' });
            }
          });
        }
      },
      fail: (err) => {
        console.error('下载失败:', err);
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    });
  },

  // 切换选项显示
  toggleOptions() {
    this.setData({ showOptions: !this.data.showOptions });
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  // 检查服务版本
  checkServiceVersion() {
    wx.request({
      url: `${SERVER_URL}/health`,
      method: 'GET',
      timeout: 3000,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const version = res.data.version || '';
          const isOptimized = version === '3.0.0';
          
          this.setData({
            serviceVersion: version,
            isOptimizedVersion: isOptimized
          });
          
          console.log(`Service version: ${version} ${isOptimized ? '(Optimized ⚡)' : '(Old ⚠️)'}`);
          
          // 如果不是优化版，显示警告
          if (!isOptimized && version) {
            wx.showModal({
              title: '⚠️ 服务版本提示',
              content: `当前使用的是旧版服务 (v${version})，转换可能会很慢甚至卡死。\n\n建议切换到优化版服务 (v3.0) 以获得极速转换体验（0.03秒）。\n\n如何切换：\n1. 关闭当前Python服务窗口\n2. 运行 start-optimized-service.bat`,
              showCancel: false,
              confirmText: '我知道了',
              confirmColor: '#ff9800'
            });
          } else if (isOptimized) {
            console.log('✅ Using optimized service - Fast conversion enabled!');
          }
        }
      },
      fail: (err) => {
        console.warn('Failed to check service version:', err);
        wx.showToast({
          title: '无法连接到服务',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 加载预览（分页）
  loadPreviews(page) {
    console.log('=== loadPreviews called ===');
    console.log('Page:', page);
    console.log('pdfFile:', this.data.pdfFile);
    
    if (!this.data.pdfFile) {
      console.error('[ERROR] No PDF file selected!');
      return;
    }
    
    console.log('Sending request to:', `${SERVER_URL}/pdf/info`);
    console.log('FormData:', {
      page: page.toString(),
      pageSize: this.data.previewPageSize.toString()
    });
    
    this.setData({ loadingPreview: true });
    
    wx.uploadFile({
      url: `${SERVER_URL}/pdf/info`,
      filePath: this.data.pdfFile,
      name: 'file',
      formData: {
        page: page.toString(),
        pageSize: this.data.previewPageSize.toString()
      },
      success: (res) => {
        console.log('[SUCCESS] Response received');
        console.log('Status:', res.statusCode);
        console.log('Data length:', res.data.length);
        
        try {
          const data = JSON.parse(res.data);
          console.log('Parsed data:', {
            success: data.success,
            pageCount: data.pageCount,
            previewsCount: data.previews ? data.previews.length : 0
          });
          
          if (data.success) {
            console.log('[OK] Setting preview data...');
            this.setData({
              previews: data.previews,
              pageCount: data.pageCount,
              previewCurrentPage: data.pagination.currentPage,
              previewTotalPages: data.pagination.totalPages,
              loadingPreview: false
            });
            console.log('[OK] Preview data set! Previews:', data.previews.length);
            
            // 如果只有一页，全选所有预览
            if (data.pageCount <= this.data.previewPageSize) {
              const allPages = data.previews.map(p => p.page);
              this.setData({ selectedPreviewPages: allPages });
              console.log('[OK] Auto-selected all pages:', allPages);
            }
          } else {
            console.error('[ERROR] Server returned error:', data.error || data);
            wx.showToast({ title: '预览加载失败: ' + (data.error || '未知错误'), icon: 'none', duration: 3000 });
            this.setData({ loadingPreview: false });
          }
        } catch (e) {
          console.error('[ERROR] Parse failed:', e);
          console.error('Raw response:', res.data.substring(0, 200));
          wx.showToast({ title: '预览数据解析失败', icon: 'none', duration: 3000 });
          this.setData({ loadingPreview: false });
        }
      },
      fail: (err) => {
        console.error('[ERROR] Request failed:', err);
        console.error('Error details:', JSON.stringify(err));
        wx.showToast({ 
          title: '网络错误: ' + (err.errMsg || '连接失败'), 
          icon: 'none',
          duration: 3000
        });
        this.setData({ loadingPreview: false });
      }
    });
  },

  // 上一页预览
  prevPreviewPage() {
    if (this.data.previewCurrentPage > 1) {
      this.loadPreviews(this.data.previewCurrentPage - 1);
    }
  },

  // 下一页预览
  nextPreviewPage() {
    if (this.data.previewCurrentPage < this.data.previewTotalPages) {
      this.loadPreviews(this.data.previewCurrentPage + 1);
    }
  },

  // 跳转到指定预览页
  gotoPreviewPage(e) {
    const page = parseInt(e.detail.value);
    if (page >= 1 && page <= this.data.previewTotalPages) {
      this.loadPreviews(page);
    }
  },

  // 切换预览页选中状态
  togglePreviewPage(e) {
    const pageNum = e.currentTarget.dataset.page;
    let selected = [...this.data.selectedPreviewPages];
    
    const index = selected.indexOf(pageNum);
    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(pageNum);
    }
    
    selected.sort((a, b) => a - b);
    this.setData({ selectedPreviewPages: selected });
  },

  // 全选当前分页
  selectAllCurrentPage() {
    const allPages = this.data.previews.map(p => p.page);
    this.setData({ selectedPreviewPages: allPages });
  },

  // 清空选择
  clearSelection() {
    this.setData({ selectedPreviewPages: [] });
  },

  // 使用选中的预览页进行转换
  convertSelectedPages() {
    if (this.data.selectedPreviewPages.length === 0) {
      wx.showToast({ title: '请先选择要转换的页面', icon: 'none' });
      return;
    }
    
    // 设置自定义页码
    const pagesStr = this.data.selectedPreviewPages.join(',');
    this.setData({
      pageSelectionMode: 'custom',
      customPages: pagesStr
    });
    
    // 执行转换
    this.convertToWord();
  }
});
