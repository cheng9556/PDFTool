package com.pdftool.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 图片上传会话管理器
 * 管理批量上传会话，自动清理过期会话
 */
@Service
public class ImageSessionManager {

    // 会话存储
    private final Map<String, ImageUploadSession> sessions = new ConcurrentHashMap<>();
    
    // 会话超时时间（毫秒）- 30分钟
    private static final long SESSION_TIMEOUT = 30 * 60 * 1000;
    
    // 定时清理线程
    private final ScheduledExecutorService cleanupExecutor;

    public ImageSessionManager() {
        // 启动定时清理任务，每5分钟检查一次
        cleanupExecutor = Executors.newSingleThreadScheduledExecutor();
        cleanupExecutor.scheduleAtFixedRate(this::cleanupExpiredSessions, 5, 5, TimeUnit.MINUTES);
        System.out.println("ImageSessionManager initialized. Cleanup task scheduled every 5 minutes.");
    }

    /**
     * 创建新的上传会话
     */
    public String createSession() {
        String sessionId = UUID.randomUUID().toString();
        ImageUploadSession session = new ImageUploadSession(sessionId);
        sessions.put(sessionId, session);
        System.out.println("Created new upload session: " + sessionId);
        return sessionId;
    }

    /**
     * 获取会话
     */
    public ImageUploadSession getSession(String sessionId) {
        ImageUploadSession session = sessions.get(sessionId);
        if (session != null) {
            session.updateLastTime();
        }
        return session;
    }

    /**
     * 删除会话
     */
    public void removeSession(String sessionId) {
        ImageUploadSession removed = sessions.remove(sessionId);
        if (removed != null) {
            System.out.println("Removed session: " + sessionId + " (had " + removed.getImageCount() + " images)");
        }
    }

    /**
     * 清理过期会话
     */
    private void cleanupExpiredSessions() {
        long now = System.currentTimeMillis();
        int removedCount = 0;
        
        for (Map.Entry<String, ImageUploadSession> entry : sessions.entrySet()) {
            ImageUploadSession session = entry.getValue();
            if (now - session.getLastUpdateTime() > SESSION_TIMEOUT) {
                sessions.remove(entry.getKey());
                removedCount++;
                System.out.println("Cleaned up expired session: " + entry.getKey());
            }
        }
        
        if (removedCount > 0) {
            System.out.println("Cleanup completed. Removed " + removedCount + " expired sessions.");
        }
    }

    /**
     * 获取活跃会话数
     */
    public int getActiveSessionCount() {
        return sessions.size();
    }

    /**
     * 关闭管理器
     */
    public void shutdown() {
        cleanupExecutor.shutdown();
    }
}

