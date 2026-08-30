/* Budget Hero — 백그라운드 푸시 알림용 서비스워커.
   앱이 완전히 꺼져 있어도 예산 초과·구독 결제일 알림을 받기 위한 파일.
   Firebase Cloud Messaging(FCM)이 사용자를 대신해 이 파일을 통해 알림을 띄운다.

   동작 조건 (전부 갖춰져야 실제로 알림이 옴):
   1) 이 파일과 manifest.json이 index.html과 같은 경로에 배포돼 있을 것 (완료)
   2) Firebase 프로젝트가 Blaze(종량제) 요금제로 전환돼 있을 것 (카드 등록 필요 — 사용자 액션)
   3) Firebase 콘솔 > 프로젝트 설정 > Cloud Messaging에서 발급한 VAPID 키를
      앱 설정(백그라운드 푸시 카드)에 붙여넣었을 것 (사용자 액션)
   4) 예산 초과 등을 감지해서 실제로 푸시를 "보내는" Cloud Function이 배포돼 있을 것
      (저장소 /functions 폴더에 코드는 준비돼 있음, `firebase deploy --only functions`
       실행은 3번의 Blaze 전환 이후 사용자가 직접 해야 함)
*/
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

/* 이 파일은 index.html의 registerBackgroundPush()가
   `firebase-messaging-sw.js?cfg=<encodeURIComponent(JSON.stringify(firebaseConfig))>`
   형태로 등록해준다 — 별도 빌드 과정 없는 단일 정적 파일 앱이라, 페이지의 설정값을
   쿼리스트링으로 서비스워커에 전달하는 방식을 쓴다 (민감정보 아님: Firebase 웹 config는
   공개돼도 안전하도록 설계되어 있고, 실제 보호는 Firestore 보안 규칙이 담당한다). */
try {
  const params = new URL(self.location.href).searchParams;
  const cfgRaw = params.get('cfg');
  if (cfgRaw) {
    const firebaseConfig = JSON.parse(decodeURIComponent(cfgRaw));
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || 'Budget Hero';
      const body = (payload.notification && payload.notification.body) || '';
      self.registration.showNotification(title, { body, icon: 'icon-192.png' });
    });
  }
} catch (e) {
  // 설정 전이면 조용히 무시 — 서비스워커 자체는 설치돼 있어야 나중에 켜자마자 바로 동작하므로
}
