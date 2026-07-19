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

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjZiNGNmNDE3MDI5ODQzNzc4M2ZmYzc2YTlmNzc1N2ZlIiwiaCI6Im11cm11cjY0In0="; 
const TMAP_APP_KEY = "1J5KkitZChKc1Qfl5U3U8IJyDkqLojt3gDGrtYbh"; 

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

// 길찾기 관련 DOM 요소 완벽 복구 매칭
const routeStartInput = document.getElementById("route-start-input");
const routeEndInput = document.getElementById("route-end-input");
const routeStartSuggestions = document.getElementById("route-start-suggestions");
const routeEndSuggestions = document.getElementById("route-end-suggestions");
const swapBtn = document.getElementById("swap-btn");
const findRouteBtn = document.getElementById("find-route-btn");
const moveCurrentLocationBtn = document.getElementById("move-current-location-btn"); 
const setStartCurrentBtn = document.getElementById("set-start-current-btn"); 
const setEndCurrentBtn = document.getElementById("set-end-current-btn"); 

// 전역 변수 관리 설정
let map = null;
let selectedLatLng = null;
let selectedPhotos = [];
let currentPhotoIndex = 0;
let registerMenuOverlay = null;
let currentInfoWindow = null;
let placesService = null;

let routeStartPoint = null; 
let routeEndPoint = null;   
let routeStartMarker = null;
let routeEndMarker = null;
let routePolyline = null;
let routeSearchDebounce = null;

const HAZARD_DETECT_RADIUS_METERS = 20;   
const HAZARD_AVOID_RADIUS_METERS = 35;    
const START_GPS_BUFFER_METERS = 50;       
const TMAP_DETOUR_TRY_LIMIT = 8;
const MAX_HAZARD_AVOID_ITERATIONS = 4;    
const OFF_ROUTE_DISTANCE_METERS = 30;     
const REROUTE_COOLDOWN_MS = 8000;         

let currentLocationMarker = null;
let isRouteStartFollowingGps = false;
let isRouteEndFollowingGps = false; 
let lastRerouteAt = 0;
let currentGpsPoint = null;               

kakao.maps.load(initMap);

function initMap() {
  const pocheonCenter = new kakao.maps.LatLng(37.894911, 127.200332);
  const pocheonBounds = new kakao.maps.LatLngBounds(
    new kakao.maps.LatLng(37.75, 127.05),
    new kakao.maps.LatLng(38.15, 127.35)
  );

  map = new kakao.maps.Map(document.getElementById("map"), { center: pocheonCenter, level: 4 });
  map.setMaxLevel(8);

  registerMenuOverlay = new kakao.maps.CustomOverlay({
    content: menuEl, clickable: true, xAnchor: 0, yAnchor: 0, zIndex: 30
  });

  kakao.maps.event.addListener(map, "rightclick", function (mouseEvent) {
    selectedLatLng = mouseEvent.latLng;
    closeInfoWindow();
    hideModal();
    showRegisterMenu(map, selectedLatLng);
  });

  kakao.maps.event.addListener(map, "click", closeInfoWindow);

  kakao.maps.event.addListener(map, "dragend", function () {
    if (!pocheonBounds.contain(map.getCenter())) {
      map.panTo(pocheonCenter);
      alert("포천 지역 안에서만 이동 가능합니다.");
    }
  });

  window.addEventListener("resize", function () { map.relayout(); });

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
  placeForm.addEventListener("submit", function (event) { event.preventDefault(); });
  saveBtn.addEventListener("click", savePlace);

  loadSavedPlaces(map);
  placesService = new kakao.maps.services.Places(map);

  setupRouteInput(routeStartInput, routeStartSuggestions, "start");
  setupRouteInput(routeEndInput, routeEndSuggestions, "end");

  swapBtn.addEventListener("click", swapRoutePoints);
  findRouteBtn.addEventListener("click", searchPedestrianRoute);
  
  if (setStartCurrentBtn) { setStartCurrentBtn.addEventListener("click", useCurrentLocationAsStart); }
  if (setEndCurrentBtn) { setEndCurrentBtn.addEventListener("click", useCurrentLocationAsEnd); }
  if (moveCurrentLocationBtn) { moveCurrentLocationBtn.addEventListener("click", moveMapToCurrentLocation); }

  startLocationWatch();

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".route-input-wrapper")) {
      hideSuggestions(routeStartSuggestions);
      hideSuggestions(routeEndSuggestions);
    }
    if (!event.target.closest("#map") && !event.target.closest(".place-info-window")) {
      closeInfoWindow();
    }
  });
}

function showRegisterMenu(map, latLng) {
  menuEl.style.display = "block";
  registerMenuOverlay.setPosition(latLng);
  registerMenuOverlay.setMap(map);
}
function hideRegisterMenu() { registerMenuOverlay.setMap(null); }
function showModal() { modalEl.style.display = "block"; nameInput.focus(); }
function hideModal() { modalEl.style.display = "none"; }

function resetForm() {
  hideModal(); hideRegisterMenu(); selectedLatLng = null; selectedPhotos = []; currentPhotoIndex = 0;
  nameInput.value = ""; reasonInput.value = ""; photoInput.value = "";
  photoPreview.removeAttribute("src"); photoPreview.style.display = "none";
  photoGuide.style.display = "block"; photoControls.style.display = "none";
  saveBtn.disabled = false; saveBtn.textContent = "등록";
}

function addPhotos() {
  const newPhotos = Array.from(photoInput.files || []);
  if (newPhotos.length === 0) { updatePhotoPreview(); return; }
  selectedPhotos = selectedPhotos.concat(newPhotos);
  currentPhotoIndex = selectedPhotos.length - newPhotos.length;
  photoInput.value = "";
  updatePhotoPreview();
}

function updatePhotoPreview() {
  if (selectedPhotos.length === 0) {
    photoPreview.removeAttribute("src"); photoPreview.style.display = "none";
    photoGuide.style.display = "block"; photoControls.style.display = "none"; return;
  }
  const currentPhoto = selectedPhotos[currentPhotoIndex];
  const reader = new FileReader();
  reader.onload = function (event) {
    photoPreview.src = event.target.result; photoPreview.style.display = "block";
    photoGuide.style.display = "none"; photoControls.style.display = "flex";
    photoCount.textContent = `${currentPhotoIndex + 1}/${selectedPhotos.length}`;
  };
  reader.readAsDataURL(currentPhoto);
}

function showPreviousPhoto(event) {
  event.preventDefault(); event.stopPropagation(); if (selectedPhotos.length === 0) return;
  currentPhotoIndex = (currentPhotoIndex - 1 + selectedPhotos.length) % selectedPhotos.length; updatePhotoPreview();
}
function showNextPhoto(event) {
  event.preventDefault(); event.stopPropagation(); if (selectedPhotos.length === 0) return;
  currentPhotoIndex = (currentPhotoIndex + 1) % selectedPhotos.length; updatePhotoPreview();
}
function deleteCurrentPhoto(event) {
  event.preventDefault(); event.stopPropagation(); selectedPhotos.splice(currentPhotoIndex, 1);
  if (currentPhotoIndex >= selectedPhotos.length) { currentPhotoIndex = Math.max(0, selectedPhotos.length - 1); }
  updatePhotoPreview();
}

async function savePlace() {
  const name = nameInput.value.trim(); const reason = reasonInput.value.trim();
  if (!selectedLatLng) return alert("지도에서 위치를 먼저 선택해주세요.");
  if (!name) return alert("장소 이름을 입력해야 합니다.");
  if (!reason) return alert("등록 이유를 입력해야 합니다.");
  saveBtn.disabled = true; saveBtn.textContent = "등록중";
  try {
    const photoData = await uploadPhotos();
    await db.collection("places").add({
      name, reason, lat: selectedLatLng.getLat(), lng: selectedLatLng.getLng(), ...photoData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("장소가 성공적으로 등록되었습니다."); location.reload();
  } catch (error) {
    console.error("장소 등록 오류:", error); alert("장소 등록 중 오류가 발생했습니다: " + error.message);
    saveBtn.disabled = false; saveBtn.textContent = "등록";
  }
}

function uploadSinglePhoto(photo, photoPath) {
  return new Promise(function (resolve, reject) {
    const uploadTask = storage.ref(photoPath).put(photo);
    const timeoutId = setTimeout(function () { reject(new Error("업로드 시간 초과(30초).")); }, 30000);
    uploadTask.on("state_changed", null, function (error) { clearTimeout(timeoutId); reject(error); },
      async function () {
        clearTimeout(timeoutId);
        try { const photoUrl = await uploadTask.snapshot.ref.getDownloadURL(); resolve(photoUrl); } catch (error) { reject(error); }
      }
    );
  });
}

async function uploadPhotos() {
  if (selectedPhotos.length === 0) return {};
  const photos = [];
  for (let index = 0; index < selectedPhotos.length; index += 1) {
    const photo = selectedPhotos[index];
    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const photoPath = `place-proposals/${Date.now()}-${index}-${safeName}`;
    const photoUrl = await uploadSinglePhoto(photo, photoPath);
    photos.push({ photoName: photo.name, photoPath, photoUrl });
  }
  const firstPhoto = photos[0];
  return { photos, photoName: firstPhoto.photoName, photoPath: firstPhoto.photoPath, photoUrl: firstPhoto.photoUrl };
}

async function loadSavedPlaces(map) {
  const snapshot = await db.collection("places").get();
  snapshot.forEach(function (doc) {
    const place = doc.data(); if (!place.lat || !place.lng) return;
    const marker = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(Number(place.lat), Number(place.lng)) });
    const infoWindow = new kakao.maps.InfoWindow({});
    kakao.maps.event.addListener(marker, "click", function () {
      closeInfoWindow(); currentInfoWindowPlace = place;
      infoWindow.setContent(makeInfoWindowContent(place)); infoWindow.open(map, marker); currentInfoWindow = infoWindow;
    });
  });
}

function closeInfoWindow() { if (!currentInfoWindow) return; currentInfoWindow.close(); currentInfoWindow = null; }

let infoWindowPhotos = []; let infoWindowPhotoIndex = 0; let currentInfoWindowPlace = null;

function makeInfoWindowContent(place, photoIndex) {
  const photos = place.photos && place.photos.length > 0 ? place.photos : place.photoUrl ? [{ photoUrl: place.photoUrl }] : [];
  const index = photoIndex && photoIndex < photos.length ? photoIndex : 0;
  infoWindowPhotos = photos; infoWindowPhotoIndex = index;
  const photoHtml = photos.length > 0 ? makeInfoWindowPhotoHtml(photos, index) : "";
  return `<div class="place-info-window" style="padding:8px; font-size:12px; color:#333; min-width:160px; max-width:220px;">
    ${photoHtml}<strong>${escapeHtml(place.name)}</strong>
    ${place.reason ? `<div style="margin-top:5px; line-height:1.35;">${escapeHtml(place.reason)}</div>` : ""}
  </div>`;
}

function makeInfoWindowPhotoHtml(photos, index) {
  const photo = photos[index]; const showControls = photos.length > 1;
  return `<div style="position:relative; margin-bottom:6px;">
    <img src="${escapeHtml(photo.photoUrl)}" alt="사진" style="display:block; width:100%; height:140px; object-fit:cover; border-radius:6px;" />
    ${showControls ? `<button type="button" onclick="changeInfoWindowPhoto(-1)" style="position:absolute; top:50%; left:4px; transform:translateY(-50%); border:0; border-radius:999px; background:rgba(0,0,0,0.45); color:#fff; width:24px; height:24px; cursor:pointer;">‹</button>
      <button type="button" onclick="changeInfoWindowPhoto(1)" style="position:absolute; top:50%; right:4px; transform:translateY(-50%); border:0; border-radius:999px; background:rgba(0,0,0,0.45); color:#fff; width:24px; height:24px; cursor:pointer;">›</button>
      <span style="position:absolute; right:6px; bottom:6px; padding:2px 6px; border-radius:999px; background:rgba(0,0,0,0.55); color:#fff; font-size:10px;">${index + 1}/${photos.length}</span>` : ""}
  </div>`;
}

function changeInfoWindowPhoto(direction) {
  if (!currentInfoWindow || !currentInfoWindowPlace || infoWindowPhotos.length === 0) return;
  const nextIndex = (infoWindowPhotoIndex + direction + infoWindowPhotos.length) % infoWindowPhotos.length;
  currentInfoWindow.setContent(makeInfoWindowContent(currentInfoWindowPlace, nextIndex));
}
function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

function setupRouteInput(inputEl, listEl, target) {
  inputEl.addEventListener("input", function () {
    const keyword = inputEl.value.trim();
    if (target === "start") { routeStartPoint = null; isRouteStartFollowingGps = false; } 
    else { routeEndPoint = null; isRouteEndFollowingGps = false; }
    updateFindRouteButtonState();
    clearTimeout(routeSearchDebounce);
    if (!keyword) { hideSuggestions(listEl); return; }
    routeSearchDebounce = setTimeout(function () {
      placesService.keywordSearch(keyword, function (data, status) {
        if (status !== kakao.maps.services.Status.OK) { hideSuggestions(listEl); return; }
        renderRouteSuggestions(data, listEl, inputEl, target);
      });
    }, 250);
  });
  inputEl.addEventListener("focus", function () { if (listEl.children.length > 0) { listEl.style.display = "block"; } });
}

function renderRouteSuggestions(places, listEl, inputEl, target) {
  listEl.innerHTML = "";
  places.slice(0, 6).forEach(function (place) {
    const item = document.createElement("li"); item.className = "route-suggestion-item";
    item.innerHTML = `<div class="route-suggestion-name">${escapeHtml(place.place_name)}</div>
      <div class="route-suggestion-address">${escapeHtml(place.road_address_name || place.address_name)}</div>`;
    item.addEventListener("click", function () {
      inputEl.value = place.place_name;
      const point = { lat: Number(place.y), lng: Number(place.x), name: place.place_name };
      if (target === "start") { routeStartPoint = point; isRouteStartFollowingGps = false; placeRouteMarker("start", point); } 
      else { routeEndPoint = point; isRouteEndFollowingGps = false; placeRouteMarker("end", point); }
      hideSuggestions(listEl); updateFindRouteButtonState();
    });
    listEl.appendChild(item);
  });
  listEl.style.display = places.length > 0 ? "block" : "none";
}
function hideSuggestions(listEl) { listEl.style.display = "none"; }

function placeRouteMarker(target, point) {
  const position = new kakao.maps.LatLng(point.lat, point.lng);
  if (target === "start") { if (routeStartMarker) routeStartMarker.setMap(null); routeStartMarker = new kakao.maps.Marker({ map, position }); } 
  else { if (routeEndMarker) routeEndMarker.setMap(null); routeEndMarker = new kakao.maps.Marker({ map, position }); }
  map.panTo(position);
}
function updateFindRouteButtonState() {
  const hasStart = routeStartPoint || routeStartInput.value.trim();
  const hasEnd = routeEndPoint || routeEndInput.value.trim();
  findRouteBtn.disabled = !(hasStart && hasEnd);
}

function swapRoutePoints() {
  const tempPoint = routeStartPoint; routeStartPoint = routeEndPoint; routeEndPoint = tempPoint;
  const tempValue = routeStartInput.value; routeStartInput.value = routeEndInput.value; routeEndInput.value = tempValue;
  const tempMarker = routeStartMarker; routeStartMarker = routeEndMarker; routeEndMarker = tempMarker;
  const tempGps = isRouteStartFollowingGps; isRouteStartFollowingGps = isRouteEndFollowingGps; isRouteEndFollowingGps = tempGps;
  updateFindRouteButtonState();
}

async function searchPedestrianRoute() {
  if (findRouteBtn.disabled) return;
  await resolveTypedRouteInputs();
  if (!routeStartPoint || !routeEndPoint) { alert("출발지와 도착지를 검색 결과에서 선택해주세요."); updateFindRouteButtonState(); return; }
  findRouteBtn.disabled = true; findRouteBtn.textContent = "검색중...";
  try {
    const result = await computeSafeRoute(); drawRouteCoordinates(result.coordinates);
    if (result.unavoidedHazards.length > 0) {
      const names = result.unavoidedHazards.map((h) => h.name).join(", ");
      alert(`"${names}" 지점은 출발/도착지와 너무 가깝거나 회피 경로를 찾지 못해 피하지 못했습니다.`);
    } else if (result.avoidedHazards.length > 0) {
      const names = result.avoidedHazards.map((h) => h.name).join(", ");
      alert(`경로 근처의 "${names}" 지점을 피하도록 안내합니다.`);
    }
  } catch (error) {
    console.error("길찾기 오류:", error); clearRoutePolyline(); alert("길찾기 API 오류: " + error.message);
  } finally { findRouteBtn.disabled = false; findRouteBtn.innerHTML = "길찾기 >"; }
}

async function computeSafeRoute() {
  const hazards = await loadRouteHazards(); let coordinates = getTmapRouteCoordinates(await requestTmapPedestrianRoute());
  if (coordinates.length === 0) { throw new Error("도보 경로를 찾을 수 없습니다."); }
  const avoidedHazards = []; const blockedHazards = []; const resolvedHazards = [];
  for (let attempt = 0; attempt < MAX_HAZARD_AVOID_ITERATIONS; attempt += 1) {
    const hazard = findNearestUnresolvedHazard(coordinates, hazards, resolvedHazards); if (!hazard) break;
    resolvedHazards.push(hazard);
    const dynamicStartRadius = isRouteStartFollowingGps ? START_GPS_BUFFER_METERS : HAZARD_AVOID_RADIUS_METERS;
    const dynamicEndRadius = isRouteEndFollowingGps ? START_GPS_BUFFER_METERS : HAZARD_AVOID_RADIUS_METERS;
    const hazardBlocksEndpoint = getDistanceMeters(hazard, routeStartPoint) <= dynamicStartRadius || getDistanceMeters(hazard, routeEndPoint) <= dynamicEndRadius;
    if (hazardBlocksEndpoint) { blockedHazards.push(hazard); continue; }
    avoidedHazards.push(hazard);
    try {
      const safeData = await requestOrsAvoidRoute(makeAvoidPolygon(avoidedHazards, HAZARD_AVOID_RADIUS_METERS));
      const safeCoordinates = getOrsRouteCoordinates(safeData);
      if (safeCoordinates.length === 0) { throw new Error("회피 경로 좌표가 비어 있습니다."); }
      coordinates = await requestTmapRouteAvoidingHazards(safeCoordinates, avoidedHazards);
    } catch (avoidError) { console.error("오류:", avoidError); avoidedHazards.pop(); blockedHazards.push(hazard); }
  }
  return { coordinates, avoidedHazards, unavoidedHazards: blockedHazards };
}

function findNearestUnresolvedHazard(routeCoordinates, hazards, resolvedHazards) {
  let nearest = null; let nearestDistance = Infinity;
  hazards.forEach(function (hazard) {
    if (resolvedHazards.includes(hazard)) return;
    const distance = getDistanceFromHazardToRoute(hazard, routeCoordinates);
    if (distance <= HAZARD_DETECT_RADIUS_METERS && distance < nearestDistance) { nearest = hazard; nearestDistance = distance; }
  });
  return nearest;
}

async function requestTmapPedestrianRoute() {
  const response = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", appKey: TMAP_APP_KEY },
    body: JSON.stringify({
      startX: String(routeStartPoint.lng), startY: String(routeStartPoint.lat), endX: String(routeEndPoint.lng), endY: String(routeEndPoint.lat),
      startName: encodeURIComponent(routeStartPoint.name || "출발"), endName: encodeURIComponent(routeEndPoint.name || "도착"),
      reqCoordType: "WGS84GEO", resCoordType: "WGS84GEO", searchOption: "0"
    })
  });
  if (!response.ok) { throw new Error("TMAP 응답 오류"); } return response.json();
}
function getTmapRouteCoordinates(response) {
  if (!response.features) return []; const coordinates = [];
  response.features.forEach(function (feature) {
    if (feature.geometry?.type !== "LineString") return;
    feature.geometry.coordinates.forEach(function (coordinate) { coordinates.push(coordinate); });
  });
  return coordinates;
}

async function requestOrsAvoidRoute(avoidPolygon) {
  const response = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
    method: "POST", headers: { Accept: "application/geo+json", "Content-Type": "application/json", Authorization: ORS_API_KEY },
    body: JSON.stringify({ coordinates: [[routeStartPoint.lng, routeStartPoint.lat], [routeEndPoint.lng, routeEndPoint.lat]], instructions: false, options: { avoid_polygons: avoidPolygon } })
  });
  if (!response.ok) { throw new Error("ORS 오류"); } return response.json();
}
function drawRouteCoordinates(coordinates) {
  const path = coordinates.map(function (coordinate) { return new kakao.maps.LatLng(coordinate[1], coordinate[0]); });
  if (path.length === 0) { clearRoutePolyline(); alert("도보 경로를 찾을 수 없습니다."); return; } drawRoutePath(path);
}
function getOrsRouteCoordinates(response) { return response.features?.[0]?.geometry?.coordinates || []; }

async function requestTmapRouteViaPoint(detourPoint) {
  const originalEndPoint = routeEndPoint; const originalStartPoint = routeStartPoint; let firstLeg = []; let secondLeg = [];
  try {
    routeEndPoint = detourPoint; firstLeg = getTmapRouteCoordinates(await requestTmapPedestrianRoute());
    routeStartPoint = detourPoint; routeEndPoint = originalEndPoint; secondLeg = getTmapRouteCoordinates(await requestTmapPedestrianRoute());
  } finally { routeStartPoint = originalStartPoint; routeEndPoint = originalEndPoint; }
  if (firstLeg.length === 0 || secondLeg.length === 0) { throw new Error("경유 오류"); } return firstLeg.concat(secondLeg.slice(1));
}

async function requestTmapRouteAvoidingHazards(safeCoordinates, hazards) {
  const latestHazard = hazards[hazards.length - 1]; const candidates = getDetourCandidates(safeCoordinates, latestHazard);
  for (const detourPoint of candidates) {
    try {
      const tmapCoordinates = await requestTmapRouteViaPoint(detourPoint);
      const staysAwayFromAll = hazards.every(function (hazard) { return getDistanceFromHazardToRoute(hazard, tmapCoordinates) > HAZARD_DETECT_RADIUS_METERS; });
      if (staysAwayFromAll) return tmapCoordinates;
    } catch (e) { console.warn("재시도 실패"); }
  }
  throw new Error("우회 경로 탐색 불가");
}

function getDetourCandidates(routeCoordinates, hazard) {
  const minDistance = HAZARD_AVOID_RADIUS_METERS + 10; const maxDistance = 350;
  const startIndex = Math.floor(routeCoordinates.length * 0.15); const endIndex = Math.ceil(routeCoordinates.length * 0.85); const candidates = [];
  for (let index = startIndex; index < endIndex; index += 1) {
    const coordinate = routeCoordinates[index]; const point = coordinateToPoint(coordinate); const distance = getDistanceMeters(point, hazard);
    if (distance >= minDistance && distance <= maxDistance) { candidates.push({ lat: point.lat, lng: point.lng, name: "우회", distance }); }
  }
  candidates.sort(function (a, b) { return a.distance - b.distance; });
  if (candidates.length === 0) { candidates.push(pickDetourPoint(routeCoordinates, hazard)); } return candidates.slice(0, TMAP_DETOUR_TRY_LIMIT);
}

function pickDetourPoint(routeCoordinates, hazard) {
  let bestCoordinate = routeCoordinates[Math.floor(routeCoordinates.length / 2)]; let bestDistance = -1;
  const startIndex = Math.floor(routeCoordinates.length * 0.2); const endIndex = Math.ceil(routeCoordinates.length * 0.8);
  for (let index = startIndex; index < endIndex; index += 1) {
    const point = coordinateToPoint(routeCoordinates[index]); const distance = getDistanceMeters(point, hazard);
    if (distance > bestDistance) { bestDistance = distance; bestCoordinate = routeCoordinates[index]; }
  }
  return { lat: bestCoordinate[1], lng: bestCoordinate[0], name: "우회" };
}

function clearRoutePolyline() { if (routePolyline) { routePolyline.setMap(null); routePolyline = null; } }
function drawRoutePath(path) {
  clearRoutePolyline(); routePolyline = new kakao.maps.Polyline({ map, path, strokeWeight: 5, strokeColor: "#2563eb", strokeOpacity: 0.85, strokeStyle: "solid" });
  const bounds = new kakao.maps.LatLngBounds(); path.forEach(function (pos) { bounds.extend(pos); }); map.setBounds(bounds);
}

async function loadRouteHazards() {
  const hazards = [];
  try {
    const snapshot = await db.collection("places").get();
    snapshot.forEach(function (doc) { const place = doc.data(); if (!place.lat || !place.lng) return; hazards.push({ name: place.name, lat: Number(place.lat), lng: Number(place.lng) }); });
  } catch (e) { console.error(e); } return hazards;
}

function getDistanceFromHazardToRoute(hazard, routeCoordinates) {
  let minDistance = Infinity;
  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = coordinateToPoint(routeCoordinates[index]); const end = coordinateToPoint(routeCoordinates[index + 1]);
    const distance = getDistanceFromPointToSegmentMeters(hazard, start, end); minDistance = Math.min(minDistance, distance);
  }
  return minDistance;
}

function makeAvoidPolygon(hazards, radiusMeters) { return { type: "MultiPolygon", coordinates: hazards.map(function (h) { return [makeCircleRing(h, radiusMeters)]; }) }; }
function makeCircleRing(hazard, radiusMeters) {
  const ring = []; const steps = 16;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps; const latOffset = (Math.sin(angle) * radiusMeters) / 111320;
    const lngOffset = (Math.cos(angle) * radiusMeters) / (111320 * Math.cos((hazard.lat * Math.PI) / 180)); ring.push([hazard.lng + lngOffset, hazard.lat + latOffset]);
  }
  return ring;
}

function coordinateToPoint(coordinate) { return { lng: coordinate[0], lat: coordinate[1] }; }
function getDistanceFromPointToSegmentMeters(point, start, end) {
  const x = point.lng; const y = point.lat; const x1 = start.lng; const y1 = start.lat; const x2 = end.lng; const y2 = end.lat;
  const dx = x2 - x1; const dy = y2 - y1; const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return getDistanceMeters(point, start);
  const ratio = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return getDistanceMeters(point, { lng: x1 + ratio * dx, lat: y1 + ratio * dy });
}
function getDistanceMeters(a, b) {
  const latMeters = (a.lat - b.lat) * 111320; const lngMeters = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);
}

async function resolveTypedRouteInputs() {
  if (!routeStartPoint && routeStartInput.value.trim() && routeStartInput.value !== "내 위치 (현위치)") { routeStartPoint = await searchFirstPlace(routeStartInput.value.trim(), "start"); }
  if (!routeEndPoint && routeEndInput.value.trim() && routeEndInput.value !== "내 위치 (현위치)") { routeEndPoint = await searchFirstPlace(routeEndInput.value.trim(), "end"); }
}
function searchFirstPlace(keyword, target) {
  return new Promise(function (resolve) {
    placesService.keywordSearch(keyword, function (data, status) {
      if (status !== kakao.maps.services.Status.OK || data.length === 0) { resolve(null); return; }
      const place = data[0]; const point = { lat: Number(place.y), lng: Number(place.x), name: place.place_name };
      if (target === "start") { routeStartInput.value = place.place_name; } else { routeEndInput.value = place.place_name; }
      placeRouteMarker(target, point); resolve(point);
    });
  });
}

function startLocationWatch() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(handleLocationUpdate, function (e) { console.warn(e.message); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
}

function handleLocationUpdate(position) {
  currentGpsPoint = { lat: position.coords.latitude, lng: position.coords.longitude };
  updateCurrentLocationMarker(currentGpsPoint);
  if (isRouteStartFollowingGps) { routeStartPoint = { lat: currentGpsPoint.lat, lng: currentGpsPoint.lng, name: "내 위치 (현위치)" }; checkRouteDeviation(currentGpsPoint); }
  if (isRouteEndFollowingGps) { routeEndPoint = { lat: currentGpsPoint.lat, lng: currentGpsPoint.lng, name: "내 위치 (현위치)" }; }
}

function updateCurrentLocationMarker(point) {
  const position = new kakao.maps.LatLng(point.lat, point.lng);
  if (!currentLocationMarker) { currentLocationMarker = new kakao.maps.Marker({ map, position, image: makeCurrentLocationMarkerImage(), zIndex: 50 }); } 
  else { currentLocationMarker.setPosition(position); }
}
function makeCurrentLocationMarkerImage() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="#2563eb" stroke="#fff" stroke-width="3" /></svg>';
  return new kakao.maps.MarkerImage("data:image/svg+xml;base64," + btoa(svg), new kakao.maps.Size(18, 18), { offset: new kakao.maps.Point(9, 9) });
}

function useCurrentLocationAsStart() {
  if (!currentGpsPoint) { alert("위치 정보를 가져올 수 없습니다."); return; }
  isRouteStartFollowingGps = true; routeStartPoint = { lat: currentGpsPoint.lat, lng: currentGpsPoint.lng, name: "내 위치 (현위치)" };
  routeStartInput.value = "내 위치 (현위치)"; if (routeStartMarker) { routeStartMarker.setMap(null); routeStartMarker = null; }
  updateFindRouteButtonState(); moveMapToCurrentLocation();
}
function useCurrentLocationAsEnd() {
  if (!currentGpsPoint) { alert("위치 정보를 가져올 수 없습니다."); return; }
  isRouteEndFollowingGps = true; routeEndPoint = { lat: currentGpsPoint.lat, lng: currentGpsPoint.lng, name: "내 위치 (현위치)" };
  routeEndInput.value = "내 위치 (현위치)"; if (routeEndMarker) { routeEndMarker.setMap(null); routeEndMarker = null; }
  updateFindRouteButtonState(); moveMapToCurrentLocation();
}
function moveMapToCurrentLocation() {
  if (!currentGpsPoint) return; map.panTo(new kakao.maps.LatLng(currentGpsPoint.lat, currentGpsPoint.lng)); map.setLevel(3);
}

function checkRouteDeviation(point) {
  if (!routePolyline || !routeEndPoint) return;
  const now = Date.now(); if (now - lastRerouteAt < REROUTE_COOLDOWN_MS) return;
  const routeCoordinates = routePolyline.getPath().map(function (latlng) { return [latlng.getLng(), latlng.getLat()]; });
  const distance = getDistanceFromHazardToRoute(point, routeCoordinates);
  if (distance > OFF_ROUTE_DISTANCE_METERS) {
    lastRerouteAt = now; console.log("경로 이탈 우회 재탐색");
    computeSafeRoute().then(result => { drawRouteCoordinates(result.coordinates); }).catch(e => console.error(e));
  }
}