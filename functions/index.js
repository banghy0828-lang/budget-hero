/**
 * Budget Hero — 백그라운드 푸시를 실제로 "보내는" 쪽 (서버 코드).
 *
 * 이 파일은 로컬 index.html이 아니라 Firebase Cloud Functions에 배포되는 서버 코드입니다.
 * 배포 전 필요한 것 (전부 사용자가 직접 해야 하는 일회성 설정):
 *   1) Firebase 콘솔에서 프로젝트를 Blaze(종량제) 요금제로 전환 (카드 등록 필요 —
 *      다만 실사용량이 무료 한도 안이면 실제 청구는 0원에 가까움, budget-hero-확장-로드맵 참고)
 *   2) 이 폴더에서 `npm install` 실행
 *   3) `firebase deploy --only functions` 실행
 *
 * 배포되면: 사용자 계정마다 매일 오전 8시에 "구독 결제일이 내일인 것"을 확인해서
 * FCM으로 푸시를 보냅니다. 필요하면 이 조건(스케줄, 알림 종류)을 자유롭게 바꾸면 됩니다.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.dailySubscriptionReminder = onSchedule(
  { schedule: 'every day 08:00', timeZone: 'Asia/Seoul' },
  async () => {
    const db = getFirestore();
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const syncCode = userDoc.id;
      const subsSnap = await db.collection(`users/${syncCode}/subs`).get();
      const tokenDoc = await db.doc(`users/${syncCode}/meta/fcmToken`).get();
      const token = tokenDoc.exists ? tokenDoc.data().token : null;
      if (!token) continue;

      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const dueSoon = [];

      subsSnap.forEach((doc) => {
        const sub = doc.data();
        // cycle 예: "매월 15일" — 숫자만 뽑아서 내일 날짜와 비교
        const m = (sub.cycle || '').match(/(\d{1,2})\s*일/);
        if (m && parseInt(m[1], 10) === tomorrow.getDate()) {
          dueSoon.push(sub.name);
        }
      });

      if (dueSoon.length > 0) {
        await getMessaging().send({
          token,
          notification: {
            title: '📺 내일 구독 결제 예정',
            body: `${dueSoon.join(', ')} 결제일이 내일이에요.`,
          },
        });
      }
    }
  }
);
