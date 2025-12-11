const recordsStore = require('../../utils/records');

Page({
  data: {
    records: [],
    selectedIds: [],
    allSelected: false,
    tip: '记录保存24小时，请及时下载',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadRecords();
  },

  formatTime(ts) {
    const d = new Date(ts);
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${month}-${day} ${hour}:${min}`;
  },

  loadRecords() {
    const now = Date.now();
    const list = recordsStore.clean(recordsStore.load(), now);
    // 确保每条记录都有 id
    const listWithId = list.map((r) => {
      if (!r.id) {
        r.id = `${r.createdAt || now}_${Math.random().toString(16).slice(2)}`;
      }
      return r;
    });
    recordsStore.save(listWithId); // 持久化清理结果
    const displayList = listWithId.map((r) => ({
      ...r,
      displayTime: this.formatTime(r.createdAt || now),
      isSelected: false,
    }));
    this.setData({
      records: displayList,
      selectedIds: [],
      allSelected: false,
    });
  },

  toggleSelectAll() {
    const { allSelected, records } = this.data;
    if (allSelected) {
      const updatedRecords = records.map((r) => ({ ...r, isSelected: false }));
      this.setData({ allSelected: false, selectedIds: [], records: updatedRecords });
    } else {
      const ids = records.map((r) => r.id);
      const updatedRecords = records.map((r) => ({ ...r, isSelected: true }));
      this.setData({ allSelected: true, selectedIds: ids, records: updatedRecords });
    }
  },

  onToggleCheckbox(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      console.error('onToggleCheckbox: id is missing', e);
      return;
    }
    console.log('onToggleCheckbox:', id, 'current selectedIds:', this.data.selectedIds);
    const selected = new Set(this.data.selectedIds);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    const newSelectedIds = Array.from(selected);
    // 更新记录的选中状态
    const updatedRecords = this.data.records.map((r) => ({
      ...r,
      isSelected: newSelectedIds.includes(r.id),
    }));
    this.setData({
      records: updatedRecords,
      selectedIds: newSelectedIds,
      allSelected: newSelectedIds.length === this.data.records.length && this.data.records.length > 0,
    });
    console.log('onToggleCheckbox: updated selectedIds:', newSelectedIds);
  },

  deleteSelected() {
    if (this.data.selectedIds.length === 0) {
      wx.showToast({ icon: 'none', title: '请先选择记录' });
      return;
    }
    wx.showModal({
      title: '删除记录',
      content: `确认删除选中的 ${this.data.selectedIds.length} 条记录？`,
      success: (res) => {
        if (res.confirm) {
          const remain = this.data.records
            .filter((r) => !this.data.selectedIds.includes(r.id))
            .map((r) => ({ ...r, isSelected: false }));
          recordsStore.save(remain);
          this.setData({
            records: remain,
            selectedIds: [],
            allSelected: false,
          });
        }
      },
    });
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id;
    const rec = this.data.records.find((r) => r.id === id);
    if (!rec) return;
    this.downloadRecord(rec);
  },

  downloadRecord(rec) {
    console.log('downloadRecord:', rec);
    if (!rec.url) {
      wx.showToast({ icon: 'none', title: '仅本地记录，无文件链接' });
      return;
    }
    // 将相对 URL 转换为完整 URL（兼容旧记录）
    let downloadUrl = rec.url;
    if (downloadUrl && !downloadUrl.startsWith('http')) {
      downloadUrl = 'http://localhost:8789' + downloadUrl;
    }
    console.log('开始下载:', downloadUrl);
    wx.showLoading({ title: '下载中...', mask: true });
    wx.downloadFile({
      url: downloadUrl,
      success: (res) => {
        console.log('下载成功:', res);
        // 简单根据扩展名判断预览方式
        const lower = (rec.filename || '').toLowerCase();
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
          wx.previewImage({ 
            urls: [res.tempFilePath],
            success: () => console.log('预览图片成功'),
            fail: (err) => {
              console.error('预览图片失败:', err);
              wx.showToast({ icon: 'none', title: '预览失败' });
            }
          });
        } else {
          wx.openDocument({ 
            filePath: res.tempFilePath,
            success: () => console.log('打开文档成功'),
            fail: (err) => {
              console.error('打开文档失败:', err);
              wx.showToast({ icon: 'none', title: '打开失败' });
            }
          });
        }
      },
      fail: (err) => {
        console.error('下载失败:', err);
        wx.showToast({ icon: 'none', title: `下载失败: ${err.errMsg || '链接失效'}` });
      },
      complete: () => wx.hideLoading(),
    });
  },

  downloadSelected() {
    const selectedCount = this.data.selectedIds.length;
    if (selectedCount === 0) {
      wx.showToast({ icon: 'none', title: '请先选择记录' });
      return;
    }
    const selectedRecords = this.data.records.filter((r) => this.data.selectedIds.includes(r.id));
    const validRecords = selectedRecords.filter((r) => r.url);
    if (validRecords.length === 0) {
      wx.showToast({ icon: 'none', title: '选中的记录无有效链接' });
      return;
    }
    if (validRecords.length === 1) {
      // 单个文件直接下载
      this.downloadRecord(validRecords[0]);
      return;
    }
    // 多个文件逐个下载
    wx.showModal({
      title: '批量下载',
      content: `确认下载选中的 ${validRecords.length} 个文件？`,
      success: (res) => {
        if (res.confirm) {
          this.downloadBatch(validRecords);
        }
      },
    });
  },

  downloadBatch(records) {
    // 分离图片和其他文件
    const images = [];
    const documents = [];
    records.forEach((rec) => {
      const lower = (rec.filename || '').toLowerCase();
      if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
        images.push(rec);
      } else {
        documents.push(rec);
      }
    });

    // 先处理图片批量保存
    if (images.length > 0) {
      this.downloadImages(images, () => {
        // 图片处理完后处理文档
        if (documents.length > 0) {
          this.downloadDocuments(documents);
        } else {
          wx.showToast({ icon: 'success', title: `已保存 ${images.length} 张图片` });
        }
      });
    } else if (documents.length > 0) {
      // 只有文档，逐个打开
      this.downloadDocuments(documents);
    }
  },

  downloadImages(images, callback) {
    let index = 0;
    const downloadNext = () => {
      if (index >= images.length) {
        if (callback) callback();
        return;
      }
      const rec = images[index];
      wx.showLoading({ title: `保存图片 (${index + 1}/${images.length})...`, mask: true });
      wx.downloadFile({
        url: rec.url,
        success: (res) => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              index++;
              downloadNext();
            },
            fail: (err) => {
              console.error('saveImageToPhotosAlbum failed:', err);
              if (err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '需要授权',
                  content: '保存图片需要相册权限，请在设置中开启',
                  showCancel: false,
                });
              } else {
                wx.showToast({ icon: 'none', title: `${rec.filename} 保存失败` });
              }
              index++;
              downloadNext();
            },
          });
        },
        fail: () => {
          wx.showToast({ icon: 'none', title: `${rec.filename} 下载失败` });
          index++;
          downloadNext();
        },
        complete: () => {
          if (index >= images.length) {
            wx.hideLoading();
          }
        },
      });
    };
    downloadNext();
  },

  downloadDocuments(documents) {
    if (documents.length === 1) {
      // 单个文档直接打开
      this.downloadRecord(documents[0]);
      return;
    }
    // 多个文档，提示用户逐个打开
    wx.showModal({
      title: '批量下载',
      content: `将逐个打开 ${documents.length} 个文档，请依次查看`,
      showCancel: false,
      success: () => {
        let index = 0;
        const openNext = () => {
          if (index >= documents.length) {
            wx.showToast({ icon: 'success', title: '已打开所有文档' });
            return;
          }
          const rec = documents[index];
          wx.showLoading({ title: `打开文档 (${index + 1}/${documents.length})...`, mask: true });
          wx.downloadFile({
            url: rec.url,
            success: (res) => {
              wx.openDocument({
                filePath: res.tempFilePath,
                success: () => {
                  index++;
                  if (index < documents.length) {
                    wx.showModal({
                      title: '继续',
                      content: `已打开 ${rec.filename}，是否继续打开下一个？`,
                      success: (modalRes) => {
                        if (modalRes.confirm) {
                          openNext();
                        } else {
                          wx.hideLoading();
                        }
                      },
                    });
                  } else {
                    wx.hideLoading();
                  }
                },
                fail: () => {
                  wx.showToast({ icon: 'none', title: `${rec.filename} 打开失败` });
                  index++;
                  openNext();
                },
              });
            },
            fail: () => {
              wx.showToast({ icon: 'none', title: `${rec.filename} 下载失败` });
              index++;
              openNext();
            },
          });
        };
        openNext();
      },
    });
  },

  // 演示：手动添加一条记录（可在开发时使用）
  demoAdd() {
    recordsStore.add({
      filename: 'demo.pdf',
      pages: '3页',
      type: '[示例]',
      url: '',
    });
    this.loadRecords();
  },
});


