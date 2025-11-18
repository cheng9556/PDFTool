package com.pdftool.service;

import java.util.ArrayList;
import java.util.List;

/**
 * 图片上传会话
 * 用于管理批量图片上传和合并转换
 */
public class ImageUploadSession {
    private final String sessionId;
    private final long createTime;
    private final List<ImageItem> images;
    private long lastUpdateTime;

    public ImageUploadSession(String sessionId) {
        this.sessionId = sessionId;
        this.createTime = System.currentTimeMillis();
        this.lastUpdateTime = this.createTime;
        this.images = new ArrayList<>();
    }

    public String getSessionId() {
        return sessionId;
    }

    public long getCreateTime() {
        return createTime;
    }

    public long getLastUpdateTime() {
        return lastUpdateTime;
    }

    public void updateLastTime() {
        this.lastUpdateTime = System.currentTimeMillis();
    }

    public List<ImageItem> getImages() {
        return images;
    }

    public synchronized void addImage(int index, byte[] imageData, String originalFilename) {
        images.add(new ImageItem(index, imageData, originalFilename));
        updateLastTime();
    }

    public int getImageCount() {
        return images.size();
    }

    /**
     * 按索引排序图片列表
     */
    public synchronized void sortImages() {
        images.sort((a, b) -> Integer.compare(a.getIndex(), b.getIndex()));
    }

    /**
     * 图片项
     */
    public static class ImageItem {
        private final int index;
        private final byte[] data;
        private final String filename;

        public ImageItem(int index, byte[] data, String filename) {
            this.index = index;
            this.data = data;
            this.filename = filename;
        }

        public int getIndex() {
            return index;
        }

        public byte[] getData() {
            return data;
        }

        public String getFilename() {
            return filename;
        }
    }
}

