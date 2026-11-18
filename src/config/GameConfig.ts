/**
 * CẤU HÌNH TRÒ CHƠI TÁ LẢ (PHỎM) MIỀN BẮC
 * Bạn có thể dễ dàng thay đổi các thông số tại đây.
 */
export const GAME_CONFIG = {
  // Thời gian đếm ngược cho mỗi lượt đi của người chơi (giây)
  // Bạn có thể chỉnh số này (ví dụ: 10, 15, 20, 30)
  TURN_TIMEOUT_SECONDS: 15,

  // Thời gian cảnh báo đỏ nhấp nháy (giây)
  WARNING_TIME_SECONDS: 5,

  // Thời gian Bot suy nghĩ tối thiểu và tối đa (mili-giây)
  BOT_THINKING_MIN_MS: 800,
  BOT_THINKING_MAX_MS: 1200,

  // Số Xu khởi tạo cho người chơi mới
  STARTING_COINS: 50000,

  // Số Xu nhận được khi xem 1 video quảng cáo (Mock Ads)
  REWARD_AD_COINS: 20000,
};
