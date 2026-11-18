import { LocalGameRoom } from '../src/controllers/LocalGameRoom';
import { areCardsEqual, createCard } from '../src/core/Card';
import { PenaltyManager } from '../src/core/PenaltyManager';
import {
  canEatCard,
  findAllPossiblePhoms,
  findBestPhomCombination,
  isUKhan,
  isValidPhom,
} from '../src/core/PhomDetector';
import { calculateDeadwoodScore, rankPlayers } from '../src/core/Scoring';
import { autoSendAllCards, canCardBeSentToPhom } from '../src/core/SendCardDetector';
import { ICard, IPhom, IPlayer, Rank, Suit } from '../src/core/Types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

console.log('=== BẮT ĐẦU KIỂM THỬ TÁ LẢ (PHỎM) MIỀN BẮC ===\n');

// 1. Kiểm tra Nhận Diện Phỏm
console.log('1. Kiểm tra isValidPhom:');
const sap3 = [
  createCard(Suit.SPADES, Rank.SEVEN),
  createCard(Suit.HEARTS, Rank.SEVEN),
  createCard(Suit.DIAMONDS, Rank.SEVEN),
];
assert(isValidPhom(sap3).valid && isValidPhom(sap3).type === 'SAP', 'Phỏm Sáp 3 cây hợp lệ (3 cây 7)');

const sap4 = [
  createCard(Suit.SPADES, Rank.KING),
  createCard(Suit.CLUBS, Rank.KING),
  createCard(Suit.DIAMONDS, Rank.KING),
  createCard(Suit.HEARTS, Rank.KING),
];
assert(isValidPhom(sap4).valid && isValidPhom(sap4).type === 'SAP', 'Phỏm Sáp 4 cây hợp lệ (4 cây K)');

const sanh3 = [
  createCard(Suit.HEARTS, Rank.EIGHT),
  createCard(Suit.HEARTS, Rank.NINE),
  createCard(Suit.HEARTS, Rank.TEN),
];
assert(isValidPhom(sanh3).valid && isValidPhom(sanh3).type === 'SANH', 'Phỏm Sảnh 3 cây hợp lệ (8-9-10 Cơ)');

const sanhA23 = [
  createCard(Suit.DIAMONDS, Rank.ACE),
  createCard(Suit.DIAMONDS, Rank.TWO),
  createCard(Suit.DIAMONDS, Rank.THREE),
];
assert(isValidPhom(sanhA23).valid && isValidPhom(sanhA23).type === 'SANH', 'Phỏm Sảnh A-2-3 Rô hợp lệ');

const sanhKA2 = [
  createCard(Suit.SPADES, Rank.KING),
  createCard(Suit.SPADES, Rank.ACE),
  createCard(Suit.SPADES, Rank.TWO),
];
assert(!isValidPhom(sanhKA2).valid, 'Sảnh vòng K-A-2 không hợp lệ trong Tá Lả miền Bắc');

// 2. Kiểm tra Ăn Bài (canEatCard)
console.log('\n2. Kiểm tra canEatCard:');
const handPlayer: ICard[] = [
  createCard(Suit.HEARTS, Rank.SEVEN),
  createCard(Suit.HEARTS, Rank.EIGHT),
  createCard(Suit.CLUBS, Rank.ACE),
  createCard(Suit.SPADES, Rank.TEN),
];
const discarded10H = createCard(Suit.HEARTS, Rank.TEN);
const discarded9H = createCard(Suit.HEARTS, Rank.NINE);

assert(canEatCard(handPlayer, [], discarded9H).canEat, 'Ăn được 9 Cơ để tạo thành sảnh 7-8-9 Cơ');
assert(!canEatCard(handPlayer, [], discarded10H).canEat, 'Không ăn được 10 Cơ vì không tạo thành phỏm');

// 3. Kiểm tra Gửi Bài (SendCardDetector)
console.log('\n3. Kiểm tra Gửi Bài (SendCardDetector):');
const opponentSanhPhom: IPhom = {
  id: 'p1',
  type: 'SANH',
  cards: [
    createCard(Suit.HEARTS, Rank.SEVEN),
    createCard(Suit.HEARTS, Rank.EIGHT),
    createCard(Suit.HEARTS, Rank.NINE),
  ],
  ownerSeat: 1,
};

const card6H = createCard(Suit.HEARTS, Rank.SIX);
const card10H = createCard(Suit.HEARTS, Rank.TEN);
const card5S = createCard(Suit.SPADES, Rank.FIVE);

assert(canCardBeSentToPhom(card6H, opponentSanhPhom), 'Gửi được 6 Cơ vào phỏm 7-8-9 Cơ của đối thủ');
assert(canCardBeSentToPhom(card10H, opponentSanhPhom), 'Gửi được 10 Cơ vào phỏm 7-8-9 Cơ của đối thủ');
assert(!canCardBeSentToPhom(card5S, opponentSanhPhom), 'Không gửi được 5 Bích vào phỏm 7-8-9 Cơ');

// Gửi nhiều lá dây chuyền: 6 Cơ và 5 Cơ
const deadwoodToSend = [card6H, createCard(Suit.HEARTS, Rank.FIVE), card5S];
const sendRes = autoSendAllCards(deadwoodToSend, [opponentSanhPhom]);
assert(sendRes.sentHistory.length === 2, 'Gửi dây chuyền thành công 2 lá (6 Cơ rồi đến 5 Cơ)');
assert(sendRes.remainingDeadwood.length === 1 && sendRes.remainingDeadwood[0].rank === Rank.FIVE, 'Còn lại đúng lá rác không gửi được');

// 4. Kiểm tra Ù Khan
console.log('\n4. Kiểm tra isUKhan:');
const handUKhan: ICard[] = [
  createCard(Suit.SPADES, Rank.ACE),
  createCard(Suit.SPADES, Rank.FOUR),
  createCard(Suit.SPADES, Rank.SEVEN),
  createCard(Suit.CLUBS, Rank.TWO),
  createCard(Suit.CLUBS, Rank.SIX),
  createCard(Suit.CLUBS, Rank.NINE),
  createCard(Suit.DIAMONDS, Rank.THREE),
  createCard(Suit.DIAMONDS, Rank.EIGHT),
  createCard(Suit.HEARTS, Rank.KING),
];
assert(isUKhan(handUKhan), 'Nhận diện đúng bộ bài Ù Khan (không có bất kỳ đôi hoặc cạ nào)');

// 5. Kiểm tra Tính Điểm & Xếp Hạng
console.log('\n5. Kiểm tra Tính Điểm & Xếp Hạng:');
const deadwood = [
  createCard(Suit.SPADES, Rank.ACE),   // 1 pt
  createCard(Suit.HEARTS, Rank.JACK),  // 11 pts
  createCard(Suit.CLUBS, Rank.QUEEN),  // 12 pts
];
assert(calculateDeadwoodScore(deadwood) === 24, 'Tính đúng tổng điểm bài rác (A + J + Q = 1 + 11 + 12 = 24 điểm)');

const mockPlayers: IPlayer[] = [
  { seat: 0, name: 'P0', avatar: '', coins: 50000, isBot: false, hand: [], eatenCards: [], discardedCards: [], laidPhoms: [opponentSanhPhom], sentCards: [], hasLaidPhoms: true, isMom: false, isU: false, isUKhan: false, score: 5, finalRank: 0, totalCoinChange: 0 },
  { seat: 1, name: 'P1', avatar: '', coins: 50000, isBot: true, hand: [], eatenCards: [], discardedCards: [], laidPhoms: [opponentSanhPhom], sentCards: [], hasLaidPhoms: true, isMom: false, isU: false, isUKhan: false, score: 12, finalRank: 0, totalCoinChange: 0 },
  { seat: 2, name: 'P2', avatar: '', coins: 50000, isBot: true, hand: [], eatenCards: [], discardedCards: [], laidPhoms: [], sentCards: [], hasLaidPhoms: true, isMom: true, isU: false, isUKhan: false, score: 999, finalRank: 0, totalCoinChange: 0 },
  { seat: 3, name: 'P3', avatar: '', coins: 50000, isBot: true, hand: [], eatenCards: [], discardedCards: [], laidPhoms: [opponentSanhPhom], sentCards: [], hasLaidPhoms: true, isMom: false, isU: false, isUKhan: false, score: 18, finalRank: 0, totalCoinChange: 0 },
];
const ranking = rankPlayers(mockPlayers);
assert(ranking.winnerSeat === 0, 'Người 5 điểm về Nhất');
assert(ranking.standings.find((s) => s.seat === 2)?.finalRank === 4, 'Người Móm tự động xếp Bét (hạng 4)');

// 6. Kiểm tra Luật Phạt & Đền (PenaltyManager)
console.log('\n6. Kiểm tra Luật Phạt & Đền:');
const pm = new PenaltyManager(1000);
const eat1 = pm.recordEat(0, 1, false, 1);
assert(eat1.penaltyAmount === 1000, 'Ăn cây thứ 1 phạt 1 cược (1,000 Xu)');

const eat2 = pm.recordEat(0, 1, false, 2);
assert(eat2.penaltyAmount === 2000, 'Ăn cây thứ 2 phạt 2 cược (2,000 Xu)');

const eatChot = pm.recordEat(0, 1, true, 3);
assert(eatChot.penaltyAmount === 4000, 'Ăn cây CHỐT phạt gấp 4 lần cược (4,000 Xu)');

// Kiểm tra Ù Đền 3 cây
const denCheck = pm.checkDenLang(0, true);
assert(denCheck.isDen && denCheck.denSeat === 1, 'Ghế 1 cho Ghế 0 ăn liên tiếp 3 cây -> Phạt ĐỀN CẢ LÀNG!');

const finalPayout = pm.calculateFinalPayout(mockPlayers, ranking.standings, true, 0);
assert(finalPayout.denSeat === 1, 'Đền làng: Người bị đền gánh toàn bộ tiền thua');

// 7. Kiểm tra Sửa lỗi Hạ Phỏm & Gửi Bài (LocalGameRoom)
console.log('\n7. Kiểm tra Sửa lỗi Hạ Phỏm (Xóa khỏi hand):');
const testRoom = new LocalGameRoom(1000);
testRoom.startNewGame(0);
const p0 = testRoom.players[0];

const testPhomCards = [
  createCard(Suit.HEARTS, Rank.SEVEN),
  createCard(Suit.HEARTS, Rank.EIGHT),
  createCard(Suit.HEARTS, Rank.NINE),
];
const testDeadwoodCard = createCard(Suit.SPADES, Rank.KING);
p0.hand = [...testPhomCards, testDeadwoodCard];
testRoom.turnPhase = 'LAYING_PHOMS';

testRoom.playerLayPhoms(0, [
  { id: 'p0_phom1', type: 'SANH', cards: testPhomCards, ownerSeat: 0 },
]);

assert(
  p0.hand.length === 1 && areCardsEqual(p0.hand[0], testDeadwoodCard),
  'Hạ Phỏm thành công: Các lá phỏm đã được xóa khỏi hand, hand chỉ còn lại đúng lá rác (K Bích)'
);

// 8. Kiểm tra Sửa lỗi Tái Hạ (Không bị Móm khi không có phỏm mới)
console.log('\n8. Kiểm tra Sửa lỗi Tái Hạ (Không bị Móm):');
// Người chơi p0 đã có phỏm p0_phom1, lượt tái không có phỏm mới:
testRoom.turnPhase = 'LAYING_PHOMS';
testRoom.playerLayPhoms(0, []); // Không có phỏm mới
assert(!p0.isMom, 'Tái Hạ thành công: Người đã hạ phỏm trước đó không có phỏm mới TUYỆT ĐỐI KHÔNG bị tính là Móm');

// 9. Kiểm tra Gửi bài có chọn lọc (playerSendSingleCard)
console.log('\n9. Kiểm tra Gửi bài có chọn lọc:');
const p1 = testRoom.players[1];
p1.laidPhoms = [
  {
    id: 'p1_phom1',
    type: 'SANH',
    cards: [
      createCard(Suit.CLUBS, Rank.SEVEN),
      createCard(Suit.CLUBS, Rank.EIGHT),
      createCard(Suit.CLUBS, Rank.NINE),
    ],
    ownerSeat: 1,
  },
];
p1.hasLaidPhoms = true;

const sendableCard = createCard(Suit.CLUBS, Rank.TEN);
const unsendableCard = createCard(Suit.DIAMONDS, Rank.ACE);
p0.hand = [sendableCard, unsendableCard];
testRoom.turnPhase = 'SENDING_CARDS';

const sendSuccess = testRoom.playerSendSingleCard(0, sendableCard);
assert(sendSuccess, 'Gửi thành công 1 quân bài 10 Tép vào phỏm đối thủ');
assert(
  p0.hand.length === 1 && areCardsEqual(p0.hand[0], unsendableCard),
  'Quân 10 Tép đã gửi bị xóa khỏi tay, chỉ còn lại quân A Rô'
);

// 10. Kiểm tra Tự động Đánh (Bảo vệ bài ăn)
console.log('\n10. Kiểm tra getAutoDiscardCard (Bảo vệ Phỏm Ăn):');
const eatenCardTest = { ...createCard(Suit.HEARTS, Rank.SEVEN), isEaten: true };
p0.hand = [
  eatenCardTest,
  createCard(Suit.HEARTS, Rank.EIGHT),
  createCard(Suit.HEARTS, Rank.NINE),
  createCard(Suit.CLUBS, Rank.ACE), // Rác hợp lệ
];
p0.eatenCards = [eatenCardTest];
p0.hasLaidPhoms = false;

const autoDiscard = testRoom.getAutoDiscardCard(0);
assert(autoDiscard !== null, 'Tìm được quân bài tự động đánh hợp lệ');
assert(!autoDiscard?.isEaten, 'Quân bài tự động đánh KHÔNG BAO GIỜ là lá bài đã ăn');
assert(
  autoDiscard?.suit === Suit.CLUBS && autoDiscard?.rank === Rank.ACE,
  'Hệ thống tự động chọn cây rác (A Tép), bảo vệ toàn bộ phỏm ăn (7-8-9 Cơ)'
);

console.log(`\n=== TỔNG KẾT: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) process.exit(1);
