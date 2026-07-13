// Firebase 및 카카오맵 설정값
const firebaseConfig = {
  apiKey: "AIzaSyALgz1N0v8yuRxzhqfDuHFMjNh3xZ8GgwE",
  authDomain: "barrier-free-pocheon-dajeong.firebaseapp.com",
  projectId: "barrier-free-pocheon-dajeong",
  storageBucket: "barrier-free-pocheon-dajeong.firebasestorage.app",
  messagingSenderId: "457062698782",
  appId: "1:457062698782:web:0a96364ea3757b3aa5430f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

const TMAP_APP_KEY = "여기에_발급받은_Tmap_appKey_입력"; // openapi.sk.com에서 발급

// DOM 요소 탐색 및 변수 할당
const menuEl = document.getElementById("register-menu");
const modalEl = document.getElementById("register-modal");
const openFormBtn = document.getElementById("open-form-btn");
const cancelBtn = document.getElementById("cancel-btn");
const saveBtn = document.getElementById("save-btn");
const photoInput = document.getElementById("place-photo");
const photoPreview = document.getElementById("photo-preview");
const photoGuide = document.getElementById("photo-guide");
const photoControls = document.getElementById("photo-controls");
const photoCount = document.getElementById("photo-count");
const prevPhotoBtn = document.getElementById("prev-photo-btn");
const nextPhotoBtn = document.getElementById("next-photo-btn");
const deletePhotoBtn = document.getElementById("delete-photo-btn");
const placeForm = document.getElementById("place-form");
const nameInput = document.getElementById("place-name");
const reasonInput = document.getElementById("place-reason");
const placeSearchInput = document.getElementById("place-search-input");
const placeSearchBtn = document.getElementById("place-search-btn");
const placeSearchResults = document.getElementById("place-search-results");

// 길찾기 관련 DOM 요소
const routeStartInput = document.getElementById("route-start-input");
const routeEndInput = document.getElementById("route-end-input");
const routeStartSuggestions = document.getElementById("route-start-suggestions");
const routeEndSuggestions = document.getElementById("route-end-suggestions");
const swapBtn = document.getElementById("swap-btn");
const findRouteBtn = document.getElementById("find-route-btn");

// 동적 데이터 관리를 위한 전역 변수 설정
let map = null; // 길찾기 함수들도 접근해야 해서 전역으로 관리
let selectedLatLng = null;
let selectedPhotos = [];
let currentPhotoIndex = 0;
let registerMenuOverlay = null;
let currentInfoWindow = null;
let placesService = null;
let searchResultMarkers = [];

// 길찾기 상태 관리용 전역 변수
let routeStartPoint = null; // { lat, lng, name }
let routeEndPoint = null;
let routeStartMarker = null;
let routeEndMarker = null;
let routePolyline = null;
let routeSearchDebounce = null;

// 카카오 지도 API 로드 완료 시 초기화 함수(initMap) 실행
kakao.maps.load(initMap);

function initMap() {
  const pocheonCenter = new kakao.maps.LatLng(37.894911, 127.200332);

  const pocheonBounds = new kakao.maps.LatLngBounds(
    new kakao.maps.LatLng(37.75, 127.05),
    new kakao.maps.LatLng(38.15, 127.35)
  );

  map = new kakao.maps.Map(document.getElementById("map"), {
    center: pocheonCenter,
    level: 4
  });

  map.setMaxLevel(8);

  registerMenuOverlay = new kakao.maps.CustomOverlay({
    content: menuEl,
    clickable: true,
    xAnchor: 0,
    yAnchor: 0,
    zIndex: 30
  });

  kakao.maps.event.addListener(map, "rightclick", function (mouseEvent) {
    selectedLatLng = mouseEvent.latLng;
    closeInfoWindow();
    hideModal();
    showRegisterMenu(map, selectedLatLng);
  });

  kakao.maps.event.addListener(map, "dragend", function () {
    if (!pocheonBounds.contain(map.getCenter())) {
      map.panTo(pocheonCenter);
      alert("포천 지역 안에서만 이동 가능합니다.");
    }
  });

  window.addEventListener("resize", function () {
    map.relayout();
  });

  openFormBtn.addEventListener("click", function () {
    kakao.maps.event.preventMap();
    hideRegisterMenu();
    showModal();
  });

  cancelBtn.addEventListener("click", resetForm);
  photoInput.addEventListener("change", addPhotos);
  prevPhotoBtn.addEventListener("click", showPreviousPhoto);
  nextPhotoBtn.addEventListener("click", showNextPhoto);
  deletePhotoBtn.addEventListener("click", deleteCurrentPhoto);

  placeForm.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  saveBtn.addEventListener("click", savePlace);

  loadSavedPlaces(map);

  placesService = new kakao.maps.services.Places(map);

  placeSearchBtn.addEventListener("click", function () {
    searchPlaces(map);
  });

  placeSearchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") searchPlaces(map);
  });

  // 길찾기 출발/도착 입력창 자동완성 설정
  setupRouteInput(routeStartInput, routeStartSuggestions, "start");
  setupRouteInput(routeEndInput, routeEndSuggestions, "end");

  swapBtn.addEventListener("click", swapRoutePoints);
  findRouteBtn.addEventListener("click", searchPedestrianRoute);

  // 입력창/드롭다운 바깥을 클릭하면 드롭다운 닫기
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".route-input-wrapper")) {
      hideSuggestions(routeStartSuggestions);
      hideSuggestions(routeEndSuggestions);
    }
  });
}

function showRegisterMenu(map, latLng) {
  menuEl.style.display = "block";
  registerMenuOverlay.setPosition(latLng);
  registerMenuOverlay.setMap(map);
}

function hideRegisterMenu() {
  registerMenuOverlay.setMap(null);
}

function showModal() {
  modalEl.style.display = "block";
  nameInput.focus();
}

function hideModal() {
  modalEl.style.display = "none";
}

function resetForm() {
  hideModal();
  hideRegisterMenu();
  selectedLatLng = null;
  selectedPhotos = [];
  currentPhotoIndex = 0;
  nameInput.value = "";
  reasonInput.value = "";
  photoInput.value = "";
  photoPreview.removeAttribute("src");
  photoPreview.style.display = "none";
  photoGuide.style.display = "block";
  photoControls.style.display = "none";
  saveBtn.disabled = false;
  saveBtn.textContent = "등록";
}

function addPhotos() {
  const newPhotos = Array.from(photoInput.files || []);

  if (newPhotos.length === 0) {
    updatePhotoPreview();
    return;
  }

  selectedPhotos = selectedPhotos.concat(newPhotos);
  currentPhotoIndex = selectedPhotos.length - newPhotos.length;
  photoInput.value = "";
  updatePhotoPreview();
}

function updatePhotoPreview() {
  if (selectedPhotos.length === 0) {
    photoPreview.removeAttribute("src");
    photoPreview.style.display = "none";
    photoGuide.style.display = "block";
    photoControls.style.display = "none";
    return;
  }

  const currentPhoto = selectedPhotos[currentPhotoIndex];
  const reader = new FileReader();

  reader.onload = function (event) {
    photoPreview.src = event.target.result;
    photoPreview.style.display = "block";
    photoGuide.style.display = "none";
    photoControls.style.display = "flex";
    photoCount.textContent = `${currentPhotoIndex + 1}/${selectedPhotos.length}`;
  };

  reader.readAsDataURL(currentPhoto);
}

function showPreviousPhoto(event) {
  event.preventDefault();
  event.stopPropagation();

  if (selectedPhotos.length === 0) return;

  currentPhotoIndex = (currentPhotoIndex - 1 + selectedPhotos.length) % selectedPhotos.length;
  updatePhotoPreview();
}

function showNextPhoto(event) {
  event.preventDefault();
  event.stopPropagation();

  if (selectedPhotos.length === 0) return;

  currentPhotoIndex = (currentPhotoIndex + 1) % selectedPhotos.length;
  updatePhotoPreview();
}

function deleteCurrentPhoto(event) {
  event.preventDefault();
  event.stopPropagation();

  selectedPhotos.splice(currentPhotoIndex, 1);

  if (currentPhotoIndex >= selectedPhotos.length) {
    currentPhotoIndex = Math.max(0, selectedPhotos.length - 1);
  }

  updatePhotoPreview();
}

async function savePlace() {
  const name = nameInput.value.trim();
  const reason = reasonInput.value.trim();

  if (!selectedLatLng) return alert("지도에서 위치를 먼저 선택해주세요.");
  if (!name) return alert("장소 이름을 입력해야 합니다.");
  if (!reason) return alert("등록 이유를 입력해야 합니다.");

  saveBtn.disabled = true;
  saveBtn.textContent = "등록중";

  try {
    const photoData = await uploadPhotos();

    await db.collection("places").add({
      name,
      reason,
      lat: selectedLatLng.getLat(),
      lng: selectedLatLng.getLng(),
      ...photoData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("장소가 성공적으로 등록되었습니다.");
    location.reload();
  } catch (error) {
    console.error("장소 등록 오류:", error);
    alert("장소 등록 중 오류가 발생했습니다.");
    saveBtn.disabled = false;
    saveBtn.textContent = "등록";
  }
}

async function uploadPhotos() {
  if (selectedPhotos.length === 0) return {};

  const photos = [];

  for (let index = 0; index < selectedPhotos.length; index += 1) {
    const photo = selectedPhotos[index];
    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const photoPath = `place-proposals/${Date.now()}-${index}-${safeName}`;

    const snapshot = await storage.ref(photoPath).put(photo);
    const photoUrl = await snapshot.ref.getDownloadURL();

    photos.push({
      photoName: photo.name,
      photoPath,
      photoUrl
    });
  }

  const firstPhoto = photos[0];

  return {
    photos,
    photoName: firstPhoto.photoName,
    photoPath: firstPhoto.photoPath,
    photoUrl: firstPhoto.photoUrl
  };
}

async function loadSavedPlaces(map) {
  const snapshot = await db.collection("places").get();

  snapshot.forEach(function (doc) {
    const place = doc.data();

    if (!place.lat || !place.lng) return;

    const marker = new kakao.maps.Marker({
      map,
      position: new kakao.maps.LatLng(Number(place.lat), Number(place.lng))
    });

    const infoWindow = new kakao.maps.InfoWindow({
      content: makeInfoWindowContent(place)
    });

    kakao.maps.event.addListener(marker, "click", function () {
      closeInfoWindow();
      infoWindow.open(map, marker);
      currentInfoWindow = infoWindow;
    });
  });
}

function closeInfoWindow() {
  if (!currentInfoWindow) return;
  currentInfoWindow.close();
  currentInfoWindow = null;
}

function makeInfoWindowContent(place) {
  return `
    <div style="padding:8px; font-size:12px; color:#333; min-width:160px; max-width:220px;">
      <strong>${escapeHtml(place.name)}</strong>
      ${place.reason ? `<div style="margin-top:5px; line-height:1.35;">${escapeHtml(place.reason)}</div>` : ""}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function searchPlaces(map) {
  const keyword = placeSearchInput.value.trim();

  if (!keyword) return;

  placesService.keywordSearch(keyword, function (data, status) {
    if (status !== kakao.maps.services.Status.OK) {
      placeSearchResults.innerHTML = "<li class=\"place-result-item\">검색 결과가 없습니다.</li>";
      return;
    }

    displaySearchResults(map, data);
  });
}

function displaySearchResults(map, places) {
  clearSearchMarkers();
  placeSearchResults.innerHTML = "";

  places.forEach(function (place) {
    const position = new kakao.maps.LatLng(place.y, place.x);

    const marker = new kakao.maps.Marker({
      map,
      position
    });
    searchResultMarkers.push(marker);

    const listItem = document.createElement("li");
    listItem.className = "place-result-item";
    listItem.innerHTML = `
      <div class="place-result-name">${escapeHtml(place.place_name)}</div>
      <div class="place-result-address">${escapeHtml(place.category_group_name || place.category_name)} · ${escapeHtml(place.road_address_name || place.address_name)}</div>
    `;

    listItem.addEventListener("click", function () {
      map.panTo(position);
      map.setLevel(3);
    });

    placeSearchResults.appendChild(listItem);
  });

  if (places.length > 0) {
    map.panTo(new kakao.maps.LatLng(places[0].y, places[0].x));
  }
}

function clearSearchMarkers() {
  searchResultMarkers.forEach(function (marker) {
    marker.setMap(null);
  });
  searchResultMarkers = [];
}

// ===== 길찾기 (도보, Tmap 보행자 경로 API) =====

function setupRouteInput(inputEl, listEl, target) {
  // 출발/도착 입력창에 타이핑할 때마다 카카오 키워드 검색으로 자동완성 목록을 보여주는 함수
  inputEl.addEventListener("input", function () {
    const keyword = inputEl.value.trim();

    // 글자가 바뀌면 이전에 선택했던 좌표는 무효화 (다시 골라야 함)
    if (target === "start") {
      routeStartPoint = null;
    } else {
      routeEndPoint = null;
    }
    updateFindRouteButtonState();

    clearTimeout(routeSearchDebounce);

    if (!keyword) {
      hideSuggestions(listEl);
      return;
    }

    routeSearchDebounce = setTimeout(function () {
      placesService.keywordSearch(keyword, function (data, status) {
        if (status !== kakao.maps.services.Status.OK) {
          hideSuggestions(listEl);
          return;
        }
        renderRouteSuggestions(data, listEl, inputEl, target);
      });
    }, 250);
    // 250ms 정도 debounce를 줘서 타이핑할 때마다 매번 API를 호출하지 않도록 함
  });

  inputEl.addEventListener("focus", function () {
    if (listEl.children.length > 0) {
      listEl.style.display = "block";
    }
  });
}

function renderRouteSuggestions(places, listEl, inputEl, target) {
  // 검색 결과를 드롭다운 리스트(li)로 그리는 함수
  listEl.innerHTML = "";

  places.slice(0, 6).forEach(function (place) {
    const item = document.createElement("li");
    item.className = "route-suggestion-item";
    item.innerHTML = `
      <div class="route-suggestion-name">${escapeHtml(place.place_name)}</div>
      <div class="route-suggestion-address">${escapeHtml(place.road_address_name || place.address_name)}</div>
    `;

    item.addEventListener("click", function () {
      inputEl.value = place.place_name;

      const point = {
        lat: Number(place.y),
        lng: Number(place.x),
        name: place.place_name
      };

      if (target === "start") {
        routeStartPoint = point;
        placeRouteMarker("start", point);
      } else {
        routeEndPoint = point;
        placeRouteMarker("end", point);
      }

      hideSuggestions(listEl);
      updateFindRouteButtonState();
    });

    listEl.appendChild(item);
  });

  listEl.style.display = places.length > 0 ? "block" : "none";
}

function hideSuggestions(listEl) {
  listEl.style.display = "none";
}

function placeRouteMarker(target, point) {
  // 선택한 출발/도착 지점에 마커를 찍는 함수
  const position = new kakao.maps.LatLng(point.lat, point.lng);

  if (target === "start") {
    if (routeStartMarker) routeStartMarker.setMap(null);
    routeStartMarker = new kakao.maps.Marker({ map, position });
  } else {
    if (routeEndMarker) routeEndMarker.setMap(null);
    routeEndMarker = new kakao.maps.Marker({ map, position });
  }

  map.panTo(position);
}

function updateFindRouteButtonState() {
  // 출발/도착이 둘 다 채워졌을 때만 "길찾기" 버튼 활성화
  findRouteBtn.disabled = !(routeStartPoint && routeEndPoint);
}

function swapRoutePoints() {
  // 출발/도착 지점을 서로 바꾸는 함수
  const tempPoint = routeStartPoint;
  routeStartPoint = routeEndPoint;
  routeEndPoint = tempPoint;

  const tempValue = routeStartInput.value;
  routeStartInput.value = routeEndInput.value;
  routeEndInput.value = tempValue;

  const tempMarker = routeStartMarker;
  routeStartMarker = routeEndMarker;
  routeEndMarker = tempMarker;

  updateFindRouteButtonState();
}

async function searchPedestrianRoute() {
  // Tmap 보행자 경로안내 API를 호출해 도보 경로를 조회하는 함수
  if (!routeStartPoint || !routeEndPoint) return;

  findRouteBtn.disabled = true;
  findRouteBtn.textContent = "검색중...";

  try {
    const response = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        appKey: TMAP_APP_KEY
      },
      body: JSON.stringify({
        startX: routeStartPoint.lng,
        startY: routeStartPoint.lat,
        endX: routeEndPoint.lng,
        endY: routeEndPoint.lat,
        startName: routeStartPoint.name,
        endName: routeEndPoint.name,
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        searchOption: "0"
      })
    });

    if (!response.ok) {
      throw new Error("Tmap API 응답 오류: " + response.status);
    }

    const data = await response.json();
    drawPedestrianRoute(data);
  } catch (error) {
    console.error("보행자 경로 검색 오류:", error);
    alert("경로를 찾는 중 오류가 발생했습니다.");
  } finally {
    findRouteBtn.disabled = false;
    findRouteBtn.innerHTML = '길찾기 <span class="arrow">›</span>';
  }
}

function drawPedestrianRoute(geojson) {
  // Tmap 응답(GeoJSON)에서 좌표를 뽑아 지도에 폴리라인으로 그리는 함수
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }

  const path = [];

  (geojson.features || []).forEach(function (feature) {
    if (feature.geometry && feature.geometry.type === "LineString") {
      feature.geometry.coordinates.forEach(function (coordinate) {
        // Tmap 좌표는 [경도, 위도] 순서로 온다
        path.push(new kakao.maps.LatLng(coordinate[1], coordinate[0]));
      });
    }
  });

  if (path.length === 0) {
    alert("도보 경로를 찾을 수 없습니다.");
    return;
  }

  routePolyline = new kakao.maps.Polyline({
    map,
    path,
    strokeWeight: 5,
    strokeColor: "#2563eb",
    strokeOpacity: 0.85,
    strokeStyle: "solid"
  });

  const bounds = new kakao.maps.LatLngBounds();
  path.forEach(function (position) {
    bounds.extend(position);
  });
  map.setBounds(bounds);
}