Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/home/index",
        text: "首页",
        iconClass: "icon-home"
      },
      {
        pagePath: "/pages/scan/index",
        text: "证件扫描仪",
        iconClass: "icon-scan"
      },
      {
        pagePath: "/pages/records/index",
        text: "转换记录",
        iconClass: "icon-history"
      },
      {
        pagePath: "/pages/me/index",
        text: "我的",
        iconClass: "icon-user"
      }
    ]
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const path = e.currentTarget.dataset.path;
      
      wx.switchTab({
        url: path
      });
      
      this.setData({
        selected: index
      });
    }
  }
});

