// Firebase 및 카카오맵 설정값
const firebaseConfig = {
  apiKey: "AIzaSyALgz1N0v8yuRxzhqfDuHFMjNh3xZ8GgwE", // Firebase 프로젝트 인증 키 (API Key)
  authDomain: "barrier-free-pocheon-dajeong.firebaseapp.com", // Firebase 인증(Auth) 도메인 주소
  projectId: "barrier-free-pocheon-dajeong", // Firebase 프로젝트 ID
  storageBucket: "barrier-free-pocheon-dajeong.firebasestorage.app", // 이미지/파일 저장용 스토리지 버킷 주소
  messagingSenderId: "457062698782", // 클라우드 메시징(FCM) 발신자 ID (현재 미사용)
  appId: "1:457062698782:web:0a96364ea3757b3aa5430f" // Firebase 웹 앱 식별자 (App ID)
};

firebase.initializeApp(firebaseConfig); // Firebase 초기화 및 시작
const db = firebase.firestore(); // Firestore 데이터베이스 인스턴스 할당
const storage = firebase.storage(); // Firebase Storage 인스턴스 할당

// DOM 요소 탐색 및 변수 할당 (DOM 탐색 최소화를 위해 전역 변수로 관리)
const menuEl = document.getElementById("register-menu"); // 지도 우클릭 시 나타나는 컨텍스트 메뉴
const modalEl = document.getElementById("register-modal"); // 장소 등록용 팝업 모달창
const openFormBtn = document.getElementById("open-form-btn"); // "신규 장소 등록" 버튼
const cancelBtn = document.getElementById("cancel-btn"); // 폼 입력 취소 버튼
const saveBtn = document.getElementById("save-btn"); // 데이터 저장 버튼
const photoInput = document.getElementById("place-photo"); // 파일 선택 <input> (숨김 처리됨)
const photoPreview = document.getElementById("photo-preview"); // 선택한 이미지 미리보기 컴포넌트
const photoGuide = document.getElementById("photo-guide"); // 이미지 없을 때 표시되는 기본 안내 가이드 (+)
const photoControls = document.getElementById("photo-controls"); // 이미지 제어 버튼 그룹 (이전/다음/삭제)
const photoCount = document.getElementById("photo-count"); // 현재 이미지 인덱스 및 전체 개수 표시 영역 (ex: 1/3)
const prevPhotoBtn = document.getElementById("prev-photo-btn"); // 이전 이미지 보기 버튼
const nextPhotoBtn = document.getElementById("next-photo-btn"); // 다음 이미지 보기 버튼
const deletePhotoBtn = document.getElementById("delete-photo-btn"); // 현재 이미지 삭제 버튼
const placeForm = document.getElementById("place-form"); // 장소 등록 <form> 엘리먼트
const nameInput = document.getElementById("place-name"); // 장소명 입력 필드
const reasonInput = document.getElementById("place-reason"); // 등록 사유 입력 필드
const placeSearchInput = document.getElementById("place-search-input"); // 장소 검색어 입력창
const placeSearchBtn = document.getElementById("place-search-btn"); // 검색 버튼
const placeSearchResults = document.getElementById("place-search-results"); // 검색 결과 목록 <ul>


// 동적 데이터 관리를 위한 전역 변수 설정
let selectedLatLng = null; // 지도에서 선택(우클릭)한 좌표 상태 값 (kakao.maps.LatLng)
let selectedPhotos = []; // 사용자가 업로드하기 위해 선택한 File 객체 배열
let currentPhotoIndex = 0; // 미리보기 이미지 노출 인덱스 
let registerMenuOverlay = null; // 지도 위에 컨텍스트 메뉴를 띄우기 위한 커스텀 오버레이 인스턴스
let currentInfoWindow = null; // 현재 지도상에 활성화된 인포윈도우 인스턴스
let placesService = null; // 카카오 장소 검색 서비스 객체 (initMap에서 초기화)
let searchResultMarkers = []; // 검색 결과로 지도에 표시된 마커들을 담아두는 배열 (다음 검색 때 지우기 위함)


// 카카오 지도 API 로드 완료 시 초기화 함수(initMap) 실행
kakao.maps.load(initMap);

function initMap() {
  // 지도 초기화 및 이벤트 리스너 바인딩 (최초 1회 실행)

  const pocheonCenter = new kakao.maps.LatLng(37.894911, 127.200332);
  // 초기 지도 중심 좌표 (포천시청 인근)

  const pocheonBounds = new kakao.maps.LatLngBounds(
    new kakao.maps.LatLng(37.75, 127.05), // 포천시 경계 영역의 남서쪽(SW) 좌표
    new kakao.maps.LatLng(38.15, 127.35)  // 포천시 경계 영역의 북동쪽(NE) 좌표
  );
  // 지도 이동 범위를 포천시 관내로 제한하기 위한 경계(Bounds) 설정

  const map = new kakao.maps.Map(document.getElementById("map"), {
    center: pocheonCenter, // 중심 좌표 설정
    level: 4 // 초기 확대 레벨 (축척 조절)
  });
  // #map 엘리먼트에 카카오 지도 인스턴스 생성

  map.setMaxLevel(8);
  // 지도의 최대 축소 레벨 제한 (타 지역 노출 방지)

  // 커스텀 오버레이 생성 (clickable: true 설정을 통해 내부 클릭 이벤트가 지도로 전파되는 것 방지)
  registerMenuOverlay = new kakao.maps.CustomOverlay({
    content: menuEl, // 오버레이로 사용할 DOM 엘리먼트
    clickable: true, // 오버레이 영역 클릭 시 지도 클릭 이벤트 발생 방지
    xAnchor: 0, // 컨텍스트 메뉴 좌측 상단을 좌표 기준점으로 설정
    yAnchor: 0, 
    zIndex: 30 // 최상단 레이어 배치를 위한 z-index 설정
  });
  // 오버레이 인스턴스 생성 완료 (지도에 바인딩 전 단계)

  kakao.maps.event.addListener(map, "rightclick", function (mouseEvent) {
    // 지도 우클릭(Context Menu 수동 구현) 이벤트 리스너
    selectedLatLng = mouseEvent.latLng; // 우클릭한 위치의 좌표 저장
    closeInfoWindow(); // 기존 활성화된 인포윈도우 닫기
    hideModal(); // 장소 등록 모달 열려있을 경우 닫기
    showRegisterMenu(map, selectedLatLng); // 해당 좌표에 컨텍스트 메뉴 활성화
  });

  kakao.maps.event.addListener(map, "dragend", function () {
    // 지도 드래그 종료(이동 완료) 이벤트 리스너
    if (!pocheonBounds.contain(map.getCenter())) {
      // 지도 중심 좌표가 포천시 경계 영역(pocheonBounds)을 벗어난 경우
      map.panTo(pocheonCenter); // 초기 지정된 포천시 중심점으로 부드럽게 이동
      alert("포천 지역 안에서만 이동 가능합니다."); // 이탈 경고 안내
    }
  });

  window.addEventListener("resize", function () {
    // 브라우저 윈도우 리사이즈 이벤트 리스너
    map.relayout();
    // 지도 레이아웃 재계산 (화면 크기 변경 시 발생할 수 있는 렌더링 오류 및 회색 깨짐 현상 방지)
  });

  openFormBtn.addEventListener("click", function () {
    // 컨텍스트 메뉴의 "신규 장소 등록" 버튼 클릭 이벤트 리스너
    kakao.maps.event.preventMap();
    // 버튼 클릭 이벤트가 카카오 지도 API 내부 클릭 이벤트로 겹쳐 실행되는 현상 방지
    hideRegisterMenu(); // 우클릭 메뉴 숨김
    showModal(); // 상세 등록 모달창 활성화
  });

  cancelBtn.addEventListener("click", resetForm);
  // 취소 버튼 클릭 시 폼 초기화 함수 호출

  photoInput.addEventListener("change", addPhotos);
  // 파일 인풋 변경(이미지 선택) 시 이미지 추가 프로세스 실행

  prevPhotoBtn.addEventListener("click", showPreviousPhoto);
  // 이미지 슬라이더: 이전 버튼 핸들러 연결

  nextPhotoBtn.addEventListener("click", showNextPhoto);
  // 이미지 슬라이더: 다음 버튼 핸들러 연결

  deletePhotoBtn.addEventListener("click", deleteCurrentPhoto);
  // 이미지 슬라이더: 현재 인덱스 이미지 삭제 핸들러 연결

  placeForm.addEventListener("submit", function (event) {
    event.preventDefault();
    // Form의 기본 Submit 동작 차단 (페이지 리로드 및 새로고침 방지)
  });

  saveBtn.addEventListener("click", savePlace);
  // 등록 버튼 클릭 시 Firestore 저장 로직 실행

  loadSavedPlaces(map);

  // 초기 로드 시 데이터베이스에 저장된 기존 데이터 마커 표시
  placesService = new kakao.maps.services.Places(map);
  // 카카오 장소 검색 서비스 객체 생성 (이 지도 인스턴스 기준으로 검색)

  placeSearchBtn.addEventListener("click", function () {
    searchPlaces(map);
  });
  // 검색 버튼 클릭 시 검색 실행

  placeSearchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") searchPlaces(map);
  });
  // 입력창에서 엔터 쳤을 때도 검색 실행되도록 설정
}

function showRegisterMenu(map, latLng) {
  // 특정 좌표에 컨텍스트 메뉴(우클릭 메뉴)를 표시하는 함수
  menuEl.style.display = "block"; // 오버레이 엘리먼트 가시화
  registerMenuOverlay.setPosition(latLng); // 오버레이 위치 지정
  registerMenuOverlay.setMap(map); // 지도 위에 오버레이 렌더링
}

function hideRegisterMenu() {
  // 컨텍스트 메뉴를 지도에서 제거 및 숨김 처리하는 함수
  registerMenuOverlay.setMap(null);
}

function showModal() {
  // 장소 등록 모달창을 표시하는 함수
  modalEl.style.display = "block"; // 모달 가시화
  nameInput.focus(); // 사용자 편의를 위해 장소명 입력란에 포커스 자동 지정
}

function hideModal() {
  // 장소 등록 모달창을 숨기는 함수
  modalEl.style.display = "none";
}

function resetForm() {
  // 모달 및 폼 내 모든 입력 상태를 초기 상태로 리셋하는 함수
  hideModal(); 
  hideRegisterMenu(); 
  selectedLatLng = null; // 선택된 좌표 변수 초기화
  selectedPhotos = []; // 업로드 대상 사진 배열 비우기
  currentPhotoIndex = 0; // 사진 슬라이더 인덱스 초기화
  nameInput.value = ""; // 장소명 입력 필드 초기화
  reasonInput.value = ""; // 사유 입력 필드 초기화
  photoInput.value = ""; // 파일 인풋 스트링 초기화 (동일 파일 재선택 인식용)
  photoPreview.removeAttribute("src"); // 이미지 미리보기 경로 제거
  photoPreview.style.display = "none"; // 미리보기 엘리먼트 숨김
  photoGuide.style.display = "block"; // 등록 유도 가이드(+) 활성화
  photoControls.style.display = "none"; // 슬라이더 제어 버튼 숨김
  saveBtn.disabled = false; // 저장 버튼 잠금 해제
  saveBtn.textContent = "등록"; // 버튼 텍스트 원복
}

function addPhotos() {
  // 파일 인풋을 통해 새로운 사진들이 추가될 때 실행되는 함수
  const newPhotos = Array.from(photoInput.files || []);
  // FileList 객체를 순회 가능한 표준 Array 배열 형태로 변환

  if (newPhotos.length === 0) {
    // 파일 선택창을 열었다가 취소하여 선택된 파일이 없는 경우
    updatePhotoPreview(); // 현재 미리보기 상태 유지 및 갱신
    return; 
  }

  selectedPhotos = selectedPhotos.concat(newPhotos);
  // 기존 선택 이미지 배열 뒤에 새로 추가된 이미지 배열 병합 (기존 파일 유지)

  currentPhotoIndex = selectedPhotos.length - newPhotos.length;
  // 방금 새로 추가된 이미지 그룹의 첫 번째 장으로 슬라이더 포커스 이동

  photoInput.value = "";
  // 파일 인풋 값을 리셋하여 동일한 파일명을 가진 이미지를 다시 선택해도 change 이벤트가 정상 트리거되도록 설정

  updatePhotoPreview(); // 이미지 미리보기 UI 업데이트
}

function updatePhotoPreview() {
  // 현재 인덱스(currentPhotoIndex)에 매칭되는 사진 파일로 미리보기 영역을 갱신하는 함수
  if (selectedPhotos.length === 0) {
    // 선택된 사진이 없는 경우 초기 가이드 상태로 복구
    photoPreview.removeAttribute("src");
    photoPreview.style.display = "none";
    photoGuide.style.display = "block";
    photoControls.style.display = "none";
    return; 
  }

  const currentPhoto = selectedPhotos[currentPhotoIndex];
  // 현재 뷰어 인덱스에 해당하는 File 객체 추출

  const reader = new FileReader();
  // 비동기 파일 읽기를 위한 FileReader 인스턴스 생성

  reader.onload = function (event) {
    // 파일 로드(Base64 인코딩) 완료 시 실행되는 콜백 함수
    photoPreview.src = event.target.result; // Base64 Data URL을 이미지 src에 바인딩
    photoPreview.style.display = "block"; 
    photoGuide.style.display = "none"; 
    photoControls.style.display = "flex"; // 이미지 컨트롤 패널 활성화
    photoCount.textContent = `${currentPhotoIndex + 1}/${selectedPhotos.length}`;
    // 현재 사진 번호와 총 사진 개수 표시 업데이트 (ex: 2/4)
  };

  reader.readAsDataURL(currentPhoto);
  // File 객체를 Base64 Data URL 포맷으로 읽기 시작
}

function showPreviousPhoto(event) {
  // 이미지 슬라이더: 이전 사진으로 인덱스를 전환하는 함수
  event.preventDefault(); 
  event.stopPropagation();
  // 버튼 클릭 이벤트가 부모 엘리먼트(.photo-box)로 전파되어 파일 탐색창이 중복 실행되는 현상 방지

  if (selectedPhotos.length === 0) return; 

  currentPhotoIndex = (currentPhotoIndex - 1 + selectedPhotos.length) % selectedPhotos.length;
  // 음수 인덱스 연산 방지용 순환 알고리즘 (첫 번째 사진에서 이전 클릭 시 마지막 사진으로 순환)

  updatePhotoPreview();
}

function showNextPhoto(event) {
  // 이미지 슬라이더: 다음 사진으로 인덱스를 전환하는 함수
  event.preventDefault();
  event.stopPropagation();

  if (selectedPhotos.length === 0) return; 

  currentPhotoIndex = (currentPhotoIndex + 1) % selectedPhotos.length;
  // 최대 범위 이탈 방지용 순환 알고리즘 (마지막 사진에서 다음 클릭 시 첫 번째 사진으로 순환)

  updatePhotoPreview();
}

function deleteCurrentPhoto(event) {
  // 이미지 슬라이더: 현재 화면에 표시 중인 사진을 배열에서 제거하는 함수
  event.preventDefault();
  event.stopPropagation();

  selectedPhotos.splice(currentPhotoIndex, 1);
  // 현재 인덱스 위치의 요소 1개 삭제

  if (currentPhotoIndex >= selectedPhotos.length) {
    // 삭제 후 인덱스가 범위를 초과한 경우 (배열의 마지막 요소를 삭제했을 때)
    currentPhotoIndex = Math.max(0, selectedPhotos.length - 1);
    // 배열 경계값에 맞게 인덱스 한 칸 보정 (배열이 비었을 경우 0으로 수렴)
  }

  updatePhotoPreview(); // UI 리렌더링
}

async function savePlace() {
  // 입력 폼 데이터를 검증하고 Firebase 인프라(Storage, Firestore)에 영구 저장하는 비동기 함수
  const name = nameInput.value.trim(); // 문자열 앞뒤 공백 제거 후 장소명 추출
  const reason = reasonInput.value.trim(); // 문자열 앞뒤 공백 제거 후 사유 추출

  // 데이터 유효성 검사 (Validation Check)
  if (!selectedLatLng) return alert("지도에서 위치를 먼저 선택해주세요.");
  if (!name) return alert("장소 이름을 입력해야 합니다.");
  if (!reason) return alert("등록 이유를 입력해야 합니다.");

  saveBtn.disabled = true;
  // 다중 클릭으로 인한 중복 트랜잭션 및 데이터 중복 삽입 방지를 위해 버튼 비활성화

  saveBtn.textContent = "등록중";
  // 처리 상태 인지를 위한 UI 텍스트 변경

  try {
    const photoData = await uploadPhotos();
    // 1단계: 선택된 모든 파일을 Firebase Storage에 먼저 업로드 후 메타데이터 반환 대기

    await db.collection("places").add({
      // 2단계: Firestore 'places' 컬렉션에 새 문서 생성
      name, 
      reason, 
      lat: selectedLatLng.getLat(), // 위도 추출 데이터 인코딩
      lng: selectedLatLng.getLng(), // 경도 추출 데이터 인코딩
      ...photoData, // 업로드 완료된 사진 경로 메타데이터 병합
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
        // 클라이언트 기기 시간 변조 방지 및 정합성을 위해 Firebase 서버 타임스탬프 적용
    });

    alert("장소가 성공적으로 등록되었습니다."); 
    location.reload(); // 신규 마커 렌더링을 위해 전체 페이지 새로고침(리로드) 수행
  } catch (error) {
    // 예외 처리 블록 (네트워크 장애, 권한 오류 등)
    console.error("장소 등록 오류:", error); // 디버깅용 콘솔 로그 출력
    alert("장소 등록 중 오류가 발생했습니다."); 
    saveBtn.disabled = false; // 오류 발생 시 입력 재시도를 위한 버튼 활성화 상태 복원
    saveBtn.textContent = "등록"; 
  }
}

async function uploadPhotos() {
  // 선택된 이미지 파일 배열을 순회하며 Firebase Storage에 비동기 일괄 업로드하는 함수
  if (selectedPhotos.length === 0) return {};
  // 업로드할 사진이 없는 경우 빈 객체 반환 (사진 첨부는 필수 조건이 아님)

  const photos = []; // 개별 이미지의 메타데이터(이름, 경로, 다운로드 URL)를 수집할 임시 배열

  for (let index = 0; index < selectedPhotos.length; index += 1) {
    const photo = selectedPhotos[index];

    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // 파일명 호환성 확보: 정규식을 사용해 한글, 특수문자, 공백을 언더바("_")로 인코딩 처리

    const photoPath = `place-proposals/${Date.now()}-${index}-${safeName}`;
    // 고유 파일 경로 생성 패턴: "폴더명/타임스탬프-인덱스-파일명" 구조로 파일명 충돌 전면 차단

    const snapshot = await storage.ref(photoPath).put(photo);
    // Firebase 스토리지의 지정 경로로 바이너리 파일 업로드 트랜잭션 완료 대기

    const photoUrl = await snapshot.ref.getDownloadURL();
    // 익전 접근 가능한 퍼블릭 HTTP 다운로드 URL 발급

    photos.push({
      photoName: photo.name, // 원본 파일명
      photoPath, // 스토리지 내부 저장 상대 경로
      photoUrl // 웹 브라우저 로드용 URL
    });
  }

  const firstPhoto = photos[0];
  // 리스트 뷰 및 목록 화면 등에서 대표(썸네일)로 매칭하여 사용할 첫 번째 사진 메타데이터 추출

  return {
    photos, // 전체 서브 사진 정보 객체 배열
    photoName: firstPhoto.photoName, // 대표 이미지 명칭
    photoPath: firstPhoto.photoPath, // 대표 이미지 스토리지 경로
    photoUrl: firstPhoto.photoUrl // 대표 이미지 HTTP URL
  };
}

async function loadSavedPlaces(map) {
  // Firestore에 등록된 모든 장소 스냅샷을 조회하여 지도상에 마커로 시각화하는 비동기 함수
  const snapshot = await db.collection("places").get();
  // 'places' 컬렉션 데이터 전건 조회 완료 대기

  snapshot.forEach(function (doc) {
    // 반환된 컬렉션 다큐먼트 배열 순회
    const place = doc.data();
    // 데이터 스키마 파싱

    if (!place.lat || !place.lng) return;
    // 필수 데이터 누락 및 비정상 데이터 무조건 스킵 처리

    const marker = new kakao.maps.Marker({
      map, // 마커를 출력할 지도 인스턴스 지정
      position: new kakao.maps.LatLng(Number(place.lat), Number(place.lng))
      // 좌표계 포맷 유효성 확보를 위해 명시적 Number 타입 변환 후 마커 좌표 지정
    });

    const infoWindow = new kakao.maps.InfoWindow({
      content: makeInfoWindowContent(place)
      // 마커 클릭 시 팝업될 레이아웃 HTML 빌드 함수 호출 및 콘텐츠 지정
    });

    kakao.maps.event.addListener(marker, "click", function () {
      // 지도 마커 클릭 이벤트 리스너
      closeInfoWindow();
      // 단일 인포윈도우 제어: 기존에 활성화되어 열려있는 인포윈도우 강제 닫기
      infoWindow.open(map, marker); // 클릭한 마커 상단에 인포윈도우 바인딩 및 오픈
      currentInfoWindow = infoWindow; // 전역 추적 참조 변수에 현재 활성화된 인포윈도우 인스턴스 캐싱
    });
  });
}

function closeInfoWindow() {
  // 현재 지도 화면에 열려 있는 전역 인포윈도우를 닫고 참조를 해제하는 함수
  if (!currentInfoWindow) return;

  currentInfoWindow.close();
  currentInfoWindow = null; // 참조 초기화
}

function makeInfoWindowContent(place) {
  // 마커를 클릭했을 때 노출할 인포윈도우 내부의 마크업(HTML) 스트링을 동적으로 생성하는 함수
  return `
    <div style="padding:8px; font-size:12px; color:#333; min-width:160px; max-width:220px;">
      <strong>${escapeHtml(place.name)}</strong>
      ${place.reason ? `<div style="margin-top:5px; line-height:1.35;">${escapeHtml(place.reason)}</div>` : ""}
    </div>
  `;
  // XSS 공격 방지를 위해 데이터 바인딩 전 단계에서 escapeHtml 필터 적용 실행
}

function escapeHtml(value) {
  // 크로스 사이트 스크립팅(XSS) 및 마크업 인젝션 차단을 위해 특수 기호를 HTML 엔티티 코드로 이스케이프하는 방어 코드
  return String(value || "")
    .replace(/&/g, "&amp;") // & 연산자 치환 (타 replace 규칙 간섭 방지를 위해 반드시 선행 처리 필수)
    .replace(/</g, "&lt;")  // < 태그 오프너 치환
    .replace(/>/g, "&gt;")  // > 태그 클로저 치환
    .replace(/"/g, "&quot;") // HTML 속성 탈출 방지용 큰따옴표 치환
    .replace(/'/g, "&#039;"); // HTML 속성 탈출 방지용 작은따옴표 치환
}

function searchPlaces(map) {
  // 입력된 검색어로 카카오 장소 검색을 실행하는 함수
  const keyword = placeSearchInput.value.trim();
  // 검색어 앞뒤 공백 제거

  if (!keyword) return;
  // 검색어가 비어있으면 실행하지 않음

  placesService.keywordSearch(keyword, function (data, status) {
    // 검색 완료 시 호출되는 콜백 함수
    if (status !== kakao.maps.services.Status.OK) {
      // 검색 결과가 없거나 에러인 경우
      placeSearchResults.innerHTML = "<li class=\"place-result-item\">검색 결과가 없습니다.</li>";
      return;
    }

    displaySearchResults(map, data);
    // 검색 성공 시 결과 목록과 마커를 화면에 표시
  });
}

function displaySearchResults(map, places) {
  // 검색 결과를 목록(사이드바)과 지도(마커)에 표시하는 함수
  clearSearchMarkers();
  // 이전 검색에서 표시했던 마커들을 먼저 지도에서 제거

  placeSearchResults.innerHTML = "";
  // 이전 검색 결과 목록 비우기

  places.forEach(function (place) {
    // 검색 결과 하나하나를 순회하며 목록 항목과 마커를 생성
    const position = new kakao.maps.LatLng(place.y, place.x);
    // 카카오 검색 결과는 x=경도, y=위도 순서로 옴 (반대이니 주의)

    const marker = new kakao.maps.Marker({
      map, // 마커를 표시할 지도
      position // 마커 위치
    });
    searchResultMarkers.push(marker);
    // 나중에 지우기 위해 배열에 저장

    const listItem = document.createElement("li");
    listItem.className = "place-result-item";
    listItem.innerHTML = `
      <div class="place-result-name">${escapeHtml(place.place_name)}</div>
      <div class="place-result-address">${escapeHtml(place.category_group_name || place.category_name)} · ${escapeHtml(place.road_address_name || place.address_name)}</div>
    `;
    // 목록 항목에 장소명, 카테고리, 주소를 표시 (escapeHtml로 XSS 방지)

    listItem.addEventListener("click", function () {
      // 목록 항목 클릭 시, 지도를 그 위치로 이동
      map.panTo(position);
      map.setLevel(3);
      // 확대 레벨을 좀 더 가까이 조정
    });

    placeSearchResults.appendChild(listItem);
  });

  if (places.length > 0) {
    map.panTo(new kakao.maps.LatLng(places[0].y, places[0].x));
    // 첫 번째 결과 위치로 지도 중심 이동
  }
}

function clearSearchMarkers() {
  // 검색 결과로 표시했던 마커들을 지도에서 전부 제거하는 함수
  searchResultMarkers.forEach(function (marker) {
    marker.setMap(null);
  });
  searchResultMarkers = [];
}