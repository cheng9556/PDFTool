Page({
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },
  goImg2Pdf() { wx.navigateTo({ url: '/pages/img2pdf/index' }); },
  goPdf2Img() { wx.navigateTo({ url: '/pages/pdf2img/index' }); },
  goPdf2Excel() { wx.navigateTo({ url: '/pages/pdf2excel/index' }); },
  goPdf2Word() { wx.navigateTo({ url: '/pages/pdf2word/index' }); },
  goWord2Pdf() { wx.navigateTo({ url: '/pages/word2pdf/index' }); },
  goPptConvert() { wx.navigateTo({ url: '/pages/pptconvert/index' }); },
  goExcel2Pdf() { wx.navigateTo({ url: '/pages/excel2pdf/index' }); },
  goRotate() { wx.navigateTo({ url: '/pages/rotate/index' }); },
  goMerge() { wx.navigateTo({ url: '/pages/merge/index' }); },
  goSplit() { wx.navigateTo({ url: '/pages/split/index' }); },
  goReorder() { wx.navigateTo({ url: '/pages/reorder/index' }); },
  todo() { wx.showToast({ icon: 'none', title: '即将上线，敬请期待' }); }
});


