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

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjZiNGNmNDE3MDI5ODQzNzc4M2ZmYzc2YTlmNzc1N2ZlIiwiaCI6Im11cm11cjY0In0="; // OpenRouteService API 키

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
const HAZARD_DETECT_RADIUS_METERS = 60;
const HAZARD_AVOID_RADIUS_METERS = 35;

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

// ===== 길찾기 (도보, OpenRouteService) =====

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
  // 좌표를 선택했거나, 입력창에 출발/도착이 모두 적혀 있으면 길찾기 버튼을 활성화합니다.
  const hasStart = routeStartPoint || routeStartInput.value.trim();
  const hasEnd = routeEndPoint || routeEndInput.value.trim();
  findRouteBtn.disabled = !(hasStart && hasEnd);
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
  // OpenRouteService 보행자 경로 API를 호출해 도보 경로를 조회합니다.
  await resolveTypedRouteInputs();

  if (!routeStartPoint || !routeEndPoint) {
    alert("출발지와 도착지를 검색 결과에서 선택해주세요.");
    updateFindRouteButtonState();
    return;
  }

  findRouteBtn.disabled = true;
  findRouteBtn.textContent = "검색중...";

  try {
    const data = await requestWalkingRoute();
    const coordinates = getRouteCoordinates(data);

    if (coordinates.length === 0) {
      clearRoutePolyline();
      alert("도보 경로를 찾을 수 없습니다.");
      return;
    }

    const hazard = await findHazardNearRoute(coordinates);

    if (!hazard) {
      drawRouteCoordinates(coordinates);
      return;
    }

    try {
      const safeData = await requestWalkingRoute(makeAvoidPolygon(hazard, HAZARD_AVOID_RADIUS_METERS));
      const safeCoordinates = getRouteCoordinates(safeData);

      if (safeCoordinates.length === 0) {
        throw new Error("회피 경로 좌표가 비어 있습니다.");
      }

      drawRouteCoordinates(safeCoordinates);
      alert(`경로 근처의 "${hazard.name}" 지점을 피해 안내합니다.`);
    } catch (avoidError) {
      console.error("위험 지점 회피 경로 검색 오류:", avoidError);
      drawRouteCoordinates(coordinates);
      alert(`"${hazard.name}" 지점이 경로 가까이에 있지만, 회피 경로를 찾지 못해 기본 경로를 표시합니다.`);
    }
  } catch (error) {
    console.error("OpenRouteService 보행자 경로 검색 오류:", error);
    clearRoutePolyline();
    alert("길찾기 API 오류: " + error.message);
  } finally {
    findRouteBtn.disabled = false;
    findRouteBtn.innerHTML = '길찾기 <span class="arrow">›</span>';
  }
}

async function requestWalkingRoute(avoidPolygon) {
  const body = {
    coordinates: [
      [routeStartPoint.lng, routeStartPoint.lat],
      [routeEndPoint.lng, routeEndPoint.lat]
    ],
    instructions: false
  };

  if (avoidPolygon) {
    body.options = {
      avoid_polygons: avoidPolygon
    };
  }

  const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: ORS_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouteService 응답 오류: ${response.status} ${errorText}`);
  }

  return response.json();
}

function drawRouteCoordinates(coordinates) {
  const path = coordinates.map(function (coordinate) {
    return new kakao.maps.LatLng(coordinate[1], coordinate[0]);
  });

  if (path.length === 0) {
    clearRoutePolyline();
    alert("도보 경로를 찾을 수 없습니다.");
    return;
  }

  drawRoutePath(path);
}

function getRouteCoordinates(response) {
  if (response.features && response.features[0]?.geometry?.coordinates) {
    return response.features[0].geometry.coordinates;
  }

  if (response.routes && response.routes[0]?.geometry?.coordinates) {
    return response.routes[0].geometry.coordinates;
  }

  if (response.routes && typeof response.routes[0]?.geometry === "string") {
    return decodePolyline(response.routes[0].geometry);
  }

  return [];
}

function decodePolyline(encoded) {
  // ORS 기본 응답의 압축 polyline 문자열을 [경도, 위도] 좌표 배열로 바꿉니다.
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latResult = decodePolylineValue(encoded, index);
    lat += latResult.value;
    index = latResult.index;

    const lngResult = decodePolylineValue(encoded, index);
    lng += lngResult.value;
    index = lngResult.index;

    coordinates.push([lng / 100000, lat / 100000]);
  }

  return coordinates;
}

function decodePolylineValue(encoded, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    index,
    value: result & 1 ? ~(result >> 1) : result >> 1
  };
}

function clearRoutePolyline() {
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }
}

function drawRoutePath(path) {
  // 지도에 이미 그려진 경로가 있으면 지우고, ORS가 준 실제 경로만 파란색으로 그립니다.
  clearRoutePolyline();

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

async function findHazardNearRoute(routeCoordinates) {
  // 지금은 Firebase에 등록된 모든 장소를 피해야 하는 위험 마커로 봅니다.
  const hazards = await loadRouteHazards();

  return hazards.find(function (hazard) {
    return getDistanceFromHazardToRoute(hazard, routeCoordinates) <= HAZARD_DETECT_RADIUS_METERS;
  });
}

async function loadRouteHazards() {
  const hazards = [];

  try {
    const snapshot = await db.collection("places").get();

    snapshot.forEach(function (doc) {
      const place = doc.data();
      if (!place.lat || !place.lng) return;

      hazards.push({
        name: place.name || "등록된 위험 지점",
        lat: Number(place.lat),
        lng: Number(place.lng)
      });
    });
  } catch (error) {
    console.error("위험 마커 로드 오류:", error);
  }

  return hazards;
}

function getDistanceFromHazardToRoute(hazard, routeCoordinates) {
  let minDistance = Infinity;

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = coordinateToPoint(routeCoordinates[index]);
    const end = coordinateToPoint(routeCoordinates[index + 1]);
    const distance = getDistanceFromPointToSegmentMeters(hazard, start, end);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

function makeAvoidPolygon(hazard, radiusMeters) {
  // ORS avoid_polygons는 원이 아니라 다각형을 받으므로, 작은 원을 16각형으로 근사합니다.
  const ring = [];
  const steps = 16;

  for (let index = 0; index <= steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const latOffset = (Math.sin(angle) * radiusMeters) / 111320;
    const lngOffset = (Math.cos(angle) * radiusMeters) / (111320 * Math.cos((hazard.lat * Math.PI) / 180));
    ring.push([hazard.lng + lngOffset, hazard.lat + latOffset]);
  }

  return {
    type: "Polygon",
    coordinates: [ring]
  };
}

function coordinateToPoint(coordinate) {
  return {
    lng: coordinate[0],
    lat: coordinate[1]
  };
}

function getDistanceFromPointToSegmentMeters(point, start, end) {
  const x = point.lng;
  const y = point.lat;
  const x1 = start.lng;
  const y1 = start.lat;
  const x2 = end.lng;
  const y2 = end.lat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return getDistanceMeters(point, start);
  }

  const ratio = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const nearest = {
    lng: x1 + ratio * dx,
    lat: y1 + ratio * dy
  };

  return getDistanceMeters(point, nearest);
}

function getDistanceMeters(a, b) {
  const latMeters = (a.lat - b.lat) * 111320;
  const lngMeters = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);
}

async function resolveTypedRouteInputs() {
  // 사용자가 자동완성 목록을 클릭하지 않고 바로 길찾기를 누른 경우를 보완합니다.
  if (!routeStartPoint && routeStartInput.value.trim()) {
    routeStartPoint = await searchFirstPlace(routeStartInput.value.trim(), "start");
  }

  if (!routeEndPoint && routeEndInput.value.trim()) {
    routeEndPoint = await searchFirstPlace(routeEndInput.value.trim(), "end");
  }
}

function searchFirstPlace(keyword, target) {
  return new Promise(function (resolve) {
    placesService.keywordSearch(keyword, function (data, status) {
      if (status !== kakao.maps.services.Status.OK || data.length === 0) {
        resolve(null);
        return;
      }

      const place = data[0];
      const point = {
        lat: Number(place.y),
        lng: Number(place.x),
        name: place.place_name
      };

      if (target === "start") {
        routeStartInput.value = place.place_name;
      } else {
        routeEndInput.value = place.place_name;
      }

      placeRouteMarker(target, point);
      resolve(point);
    });
  });
}
