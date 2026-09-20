// app.js - Part 1
// 🌟 [원상복구] 깃허브 캐시 대신 사용자님의 구글 웹앱 주소로 직접 데이터를 실시간 요청합니다.
const GOOGLE_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxY7eALGsOKtXsh0vZ8EtcHigpCykqHDSw1CpfI3zA--8vq7IZbW4XmrN2wYi3AOXtS/exec';
const SHEET_URL = GOOGLE_WEB_APP_URL; 

// 🎯 [오류 영구 파쇄 완결] 로컬 스토리지 공통 이름표 상수를 최선단에 명확하게 신설 정의합니다.
const STORAGE_KEY = 'ff14_achievements_v2';

// [순정 구조 복원] 수집된 데이터 원본 배열과 상수를 연동 호출합니다.
let rawData = [];
let checkedItems = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; // 상수를 안정적으로 바라보도록 연동 매핑

// [상태 변수 관리 변수 스코프] 필터링 및 복합 연산에 연동되는 글로벌 제어 인덱스 목록입니다.
let currentMain = '';            // [분류] 카테고리 기록용 변수 (소분류 변수 제거 상태 유지)
let currentRewardFilters = [];   // [획득처] 다중 토글 누적 저장용 배열 변수
let currentStatusFilter = 'ALL'; // 달성 상태 필터 기록용 변수 (ALL / 미완료 / 완료)
let currentSearchQuery = '';     // 통합 검색 키워드 실시간 소문자 저장용 변수

// 🌟 [정렬 전용 제어 인덱스 변수 신설] 초기값은 사진 기준인 'PATCH_ASC'(패치 낮은순)로 설정합니다.
let currentSortFilter = 'PATCH_ASC'; 

/**
 * ------------------------------------------------------------------------------
 * 1. 테마 모드 영구 기억 및 실시간 전환 엔진 (applySavedThemeMode, toggleThemeMode)
 * ------------------------------------------------------------------------------
 */
function applySavedThemeMode() {
    const savedTheme = localStorage.getItem("ff14_theme_mode") || "dark";
    const body = document.body;
    const icon = document.getElementById("theme-icon");
    const text = document.getElementById("theme-text");

    if (!icon || !text) return;

    if (savedTheme === "light") {
        body.classList.add("light-mode"); 
        icon.textContent = "☀️";          
        text.textContent = "라이트 모드";   
    } else {
        body.classList.remove("light-mode"); 
        icon.textContent = "🌙";
        text.textContent = "다크 모드";
    }
}

function toggleThemeMode() {
    const body = document.body;
    const icon = document.getElementById("theme-icon");
    const text = document.getElementById("theme-text");

    if (!icon || !text) return;

    if (body.classList.contains("light-mode")) {
        body.classList.remove("light-mode");
        icon.textContent = "🌙";
        text.textContent = "다크 모드";
        localStorage.setItem("ff14_theme_mode", "dark"); 
    } else {
        body.classList.add("light-mode");
        icon.textContent = "☀️";
        text.textContent = "라이트 모드";
        localStorage.setItem("ff14_theme_mode", "light"); 
    }
    renderList();
}

/**
 * =========================================================================
 * 📋 비동기 데이터 fetch 원격 수집 및 검색·달성 상태 필터부
 * =========================================================================
 */

/**
 * ------------------------------------------------------------------------------
 * 1. 구글 스프레드시트 데이터 비동기 원격 로더 및 스키마 직렬화 (fetchData)
 * ------------------------------------------------------------------------------
 */
async function fetchData() {
    try {
        const res = await fetch(SHEET_URL);
        if (!res.ok) throw new Error(`구글 웹 앱 응답 오류 (상태코드: ${res.status})`);
        
        const rows = await res.json();
        if (!rows || rows.length <= 1) throw new Error("시트 내부에 파싱할 데이터 행이 부족합니다.");

        rawData = rows.slice(1).map((row) => {
            const getVal = (colIdx) => {
                return row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]).trim() : '';
            };

            const musicName = getVal(2); // 2번 열: [악보명] 추출
            
            // O/X 치환 가동 인터페이스
            const rawTradeVal = getVal(6).toUpperCase();
            let tradeText = '-';
            if (rawTradeVal === 'O' || rawTradeVal === 'ㅇ') tradeText = '거래 가능';
            if (rawTradeVal === 'X' || rawTradeVal === 'ㄴ') tradeText = '거래 불가';

            return {
                id: musicName,          // 고유 식별자 (악보명 기준 일치)
                main: getVal(0),        // 0번 열: [분류]
                name: musicName,        // 2번 열: [악보명]
                newCol: getVal(1),      // 1번 열: [악보 번호]
                condition: getVal(3),   // 3번 열: [패치]
                score: getVal(4),       // 4번 열: [획득처]
                rewardType: getVal(5),  // 5번 열: [획득 방법]
                rewardContent: tradeText // 6번 열: [거래 여부] 치환 텍스트 매핑 보존
            };
        }).filter(item => item.name && item.main); 

        initMenu();
        initRewardMenu(); 
        calculateTotalProgress();
        applySavedThemeMode(); 
    } catch (error) {
        console.error(error);
        document.getElementById('achievement-list').innerHTML = `
            <tr><td colspan="9" style="text-align: center; color: #ff4d4d; font-weight: bold; padding: 40px;">
                구글 스프레드시트 데이터를 로드하지 못했습니다.<br>
                <span style="color: #aaa; font-size: 0.9em; font-weight: normal;">이유: ${error.message}</span>
            </td></tr>`;
    }
}
/**
 * ------------------------------------------------------------------------------
 * 2. 검색 인풋 인터페이스 감지 및 [Clear] 강제 청소 엔진 (handleSearchInput, clearSearch)
 * ------------------------------------------------------------------------------
 */
function handleSearchInput() {
    const inputElement = document.getElementById('search-keyword');
    if (inputElement) {
        currentSearchQuery = inputElement.value.trim().toLowerCase();
        renderList(); 
    }
}

function clearSearch() {
    const inputElement = document.getElementById('search-keyword');
    if (inputElement) {
        inputElement.value = ''; 
    }
    currentSearchQuery = ''; 
    updatePathDisplay(); 
    renderList(); 
}

function selectStatusFilter(status) {
    currentStatusFilter = status;
    document.querySelectorAll('.status-filter-btn').forEach(btn => btn.classList.remove('active'));
    if(status === 'ALL') document.getElementById('status-all').classList.add('active');
    if(status === 'UNCOMPLETED') document.getElementById('status-uncompleted').classList.add('active');
    if(status === 'COMPLETED') document.getElementById('status-completed').classList.add('active');
    renderList();
}

/**
 * 🌟 [신설: 사진 속 정렬 버튼 전용 액티브 스위칭 엔진]
 * 사용자가 선택한 정렬 방식에 따라 보라색 하이라이트 스타일을 정확하게 토글합니다.
 */
function changeSortingFilter(sortType) {
    currentSortFilter = sortType;
    
    // HTML에 생성된 모든 정렬 버튼에서 보라색 액티브 클래스를 일시 제거합니다.
    document.querySelectorAll('.sort-filter-btn').forEach(btn => btn.classList.remove('active'));
    
    // 선택한 조건에 부합하는 단추만 정밀하게 보라색으로 켭니다.
    if(sortType === 'PATCH_ASC') document.getElementById('sort-patch-asc').classList.add('active');
    if(sortType === 'PATCH_DESC') document.getElementById('sort-patch-desc').classList.add('active');
    if(sortType === 'SCORE_ASC') document.getElementById('sort-score-asc').classList.add('active');
    if(sortType === 'SCORE_DESC') document.getElementById('sort-score-desc').classList.add('active');
    
    // 정렬이 변경되었으므로 화면의 악보 리스트를 다시 정렬하여 출력합니다.
    renderList();
}

/**
 * ------------------------------------------------------------------------------
 * 3. 중복 없는 데이터 기반 카테고리 [분류] 버튼 생성기 (initMenu)
 * ------------------------------------------------------------------------------
 */
function initMenu() {
    const mains = [...new Set(rawData.map(item => item.main))];
    const mainGroup = document.getElementById('main-category-group');
    mainGroup.innerHTML = ''; 

    mains.forEach((main, idx) => {
        if(!main) return;
        const btn = document.createElement('button');
        btn.textContent = main;
        btn.onclick = () => selectMainCategory(main, btn); 
        mainGroup.appendChild(btn);
    });
}

function selectMainCategory(main, btn) {
    currentMain = main;
    currentRewardFilters = []; 
    updateRewardFilterUI();

    document.querySelectorAll('#main-category-group button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    updatePathDisplay(); 
    renderList();        
}

/**
 * ------------------------------------------------------------------------------
 * 4. [획득처별 모아보기] 필터 메뉴 생성기 (initRewardMenu)
 * ------------------------------------------------------------------------------
 */
function initRewardMenu() {
    const scoreTypes = [...new Set(rawData.map(item => item.score))].filter(t => t && t !== '-');
    const rewardGroup = document.getElementById('reward-category-group');
    rewardGroup.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.textContent = '필터 해제'; 
    allBtn.classList.add('reward-filter-btn', 'active');
    allBtn.id = 'rw-btn-all';
    allBtn.onclick = () => selectRewardMultiFilter('ALL');
    rewardGroup.appendChild(allBtn);

    scoreTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.textContent = type; 
        btn.classList.add('reward-filter-btn');
        btn.setAttribute('data-reward-type', type); 
        btn.onclick = () => selectRewardMultiFilter(type); 
        rewardGroup.appendChild(btn);
    });
}

function selectRewardMultiFilter(type) {
    if (type === 'ALL') {
        currentRewardFilters = []; 
    } else {
        const index = currentRewardFilters.indexOf(type);
        if (index > -1) {
            currentRewardFilters.splice(index, 1); 
        } else {
            currentRewardFilters.push(type); 
            document.querySelectorAll('#main-category-group button').forEach(b => b.classList.remove('active'));
        }
    }
    
    updateRewardFilterUI(); 
    updatePathDisplay();    
    renderList();           
}

function updateRewardFilterUI() {
    const allBtn = document.getElementById('rw-btn-all');
    
    if (currentRewardFilters.length === 0) {
        document.querySelectorAll('.reward-filter-btn').forEach(b => b.classList.remove('active'));
        if (allBtn) allBtn.classList.add('active'); 
    } else {
        if (allBtn) allBtn.classList.remove('active'); 
        document.querySelectorAll('.reward-filter-btn').forEach(btn => {
            const type = btn.getAttribute('data-reward-type');
            if (currentRewardFilters.includes(type)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}
/**
 * =========================================================================
 * 📋 가변 레이아웃 교집합 연산 및 실시간 진척도 게이지 계산부
 * =========================================================================
 */

function updatePathDisplay() {
    const display = document.getElementById('current-path-display');
    if (!display) return;
    if (currentSearchQuery) {
        display.textContent = `🔍 전체 항목 중에서 '${currentSearchQuery}' 검색 결과`;
    } else if (currentRewardFilters.length > 0) {
        display.textContent = `🎁 [다중 필터] 획득처 : ${currentRewardFilters.join(', ')}`;
    } else {
        display.textContent = `${currentMain}`;
    }
}

function getRewardColor(type) {
    if (!type || type === '-') return '#666666'; 
    const isLight = document.body.classList.contains("light-mode");
    switch (type) {
        case '탈것': return isLight ? '#b80061' : '#ff70a6';      
        case '꼬마친구': return isLight ? '#0066cc' : '#4ea8de';    
        case '칭호': return isLight ? '#b55d00' : '#ff9f1c';      
        case '장비': return isLight ? '#7209b7' : '#b5179e';      
        case '가구': return isLight ? '#2d6a4f' : '#70e000';      
        case '초코보 갑주': return isLight ? '#995a00' : '#ffd166';  
        case '오케스트리온': return isLight ? '#0077b6' : '#48cae4'; 
        default: return isLight ? '#14746f' : '#5bc0be';         
    }
}

function renderList() {
    const listBody = document.getElementById('achievement-list');
    const thPath = document.getElementById('th-path');
    if (!listBody || !thPath) return;
    listBody.innerHTML = ''; 

    let filtered = [];
    
    if (!currentSearchQuery) {
        if (currentRewardFilters.length === 0) {
            filtered = rawData.filter(item => item.main === currentMain);
        } else {
            filtered = rawData.filter(item => currentRewardFilters.includes(item.score));
        }
    } else {
        filtered = rawData.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(currentSearchQuery);
            const newColMatch = item.newCol.toLowerCase().includes(currentSearchQuery);
            const condMatch = item.condition.toLowerCase().includes(currentSearchQuery);
            const typeMatch = item.rewardType.toLowerCase().includes(currentSearchQuery);
            const rewardMatch = item.rewardContent.toLowerCase().includes(currentSearchQuery);
            return nameMatch || newColMatch || condMatch || typeMatch || rewardMatch;
        });
    }

    if (currentStatusFilter === 'UNCOMPLETED') {
        filtered = filtered.filter(item => !checkedItems[item.id]); 
    } else if (currentStatusFilter === 'COMPLETED') {
        filtered = filtered.filter(item => checkedItems[item.id]);  
    }

    // 🌟 [정렬 필터 다차원 처리 아키텍처 탑재]
    // 렌더링 직전 단계에서 사용자가 켠 정렬 버튼에 맞춰 정밀 교차 연산을 수행합니다.
    filtered.sort((a, b) => {
        if (currentSortFilter === 'PATCH_ASC' || currentSortFilter === 'PATCH_DESC') {
            // 패치 컬럼 데이터를 온전한 소수점 수치(Float)로 변환해 크기를 대조합니다.
            const patchA = parseFloat(a.condition) || 0;
            const patchB = parseFloat(b.condition) || 0;
            return currentSortFilter === 'PATCH_ASC' ? patchA - patchB : patchB - patchA;
        } else if (currentSortFilter === 'SCORE_ASC' || currentSortFilter === 'SCORE_DESC') {
            // 획득처 컬럼 명칭을 유니코드(가나다순) 문자열 통계 공식으로 오름차순/내림차순 정렬합니다.
            const scoreA = a.score || '';
            const scoreB = b.score || '';
            if (scoreA < scoreB) return currentSortFilter === 'SCORE_ASC' ? -1 : 1;
            if (scoreA > scoreB) return currentSortFilter === 'SCORE_ASC' ? 1 : -1;
            return 0;
        }
        return 0;
    });

    const showPathColumn = (currentRewardFilters.length > 0 || currentSearchQuery !== '');
    if (showPathColumn) thPath.style.display = ''; 
    else thPath.style.display = 'none'; 

    const activeColspan = showPathColumn ? 9 : 8;

    if (filtered.length === 0) {
        listBody.innerHTML = `<tr><td colspan="${activeColspan}" style="text-align: center; padding: 40px; color: var(--text-color); opacity: 0.6;">필터 및 검색 조건에 부합하는 악보가 없습니다.</td></tr>`;
        calculateChapterProgress([]);
        return;
    }

    filtered.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const isChecked = checkedItems[item.id] ? 'checked' : '';
        if(isChecked) tr.classList.add('completed'); 

        const textColor = getRewardColor(item.rewardType);
        let pathTd = showPathColumn ? `<td class="col-path">${item.main}</td>` : '';

        tr.innerHTML = `
            <td class="col-no">${idx + 1}</td> 
            <td class="col-check"><input type="checkbox" ${isChecked} onchange="toggleItem('${item.id}', this)"></td>
            ${pathTd}
            <td class="col-new">${item.newCol}</td>
            <td class="col-name">${item.name}</td>
            <td class="col-cond">${item.condition}</td>
            <td class="col-score" style="color: ${textColor}; font-weight:bold;">${item.score || '-'}</td>
            <td class="col-rw-type">${item.rewardType || '-'}</td>
            <td class="col-rw-content">${item.rewardContent || '-'}</td>
        `;
        listBody.appendChild(tr);
    });

    if (currentSearchQuery || currentRewardFilters.length > 0) {
        calculateChapterProgress(filtered);
    } else {
        const currentViewItems = rawData.filter(item => item.main === currentMain);
        calculateChapterProgress(currentViewItems);
    }
}

function toggleItem(id, checkbox) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) {
        checkedItems[id] = true;
        row.classList.add('completed');
    } else {
        delete checkedItems[id];
        row.classList.remove('completed');
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedItems)); 
    calculateTotalProgress();

    if (currentStatusFilter !== 'ALL' || currentSearchQuery || currentRewardFilters.length > 0) {
        renderList();
    } else {
        const currentViewItems = rawData.filter(item => item.main === currentMain);
        calculateChapterProgress(currentViewItems);
    }
}

function calculateTotalProgress() {
    const total = rawData.length;
    if(total === 0) return;
    
    const checkedCount = rawData.filter(item => checkedItems[item.id]).length;
    const percent = Math.round((checkedCount / total) * 100);

    document.getElementById('total-percent').textContent = `${percent}%`;
    document.getElementById('total-count').textContent = `${checkedCount}/${total}`;
    document.getElementById('total-bar').style.width = `${percent}%`;

    document.getElementById('score-total').textContent = `${checkedCount.toLocaleString()} 개`;
}

function calculateChapterProgress(currentItems) {
    const total = currentItems.length;
    
    if (currentSearchQuery) document.getElementById('chapter-percent').parentElement.firstChild.textContent = "현재 검색 항목 달성도: ";
    else if (currentRewardFilters.length > 0) document.getElementById('chapter-percent').parentElement.firstChild.textContent = "선택 보상 달성도: ";
    else document.getElementById('chapter-percent').parentElement.firstChild.textContent = "현재 필터 달성도: ";

    let exactTotal = total;
    if (exactTotal === 0 && currentMain && !currentSearchQuery && currentRewardFilters.length === 0) {
        exactTotal = rawData.filter(item => item.main === currentMain).length;
    }

    if(exactTotal === 0) {
        document.getElementById('chapter-percent').textContent = `0%`;
        document.getElementById('chapter-count').textContent = `0/0`;
        document.getElementById('chapter-bar').style.width = `0%`;
        return;
    }
    const checkedCount = currentItems.filter(item => checkedItems[item.id]).length;
    const percent = Math.round((checkedCount / exactTotal) * 100);

    document.getElementById('chapter-percent').textContent = `${percent}%`;
    document.getElementById('chapter-count').textContent = `${checkedCount}/${exactTotal}`;
    document.getElementById('chapter-bar').style.width = `${percent}%`;
}

/**
 * ==============================================================================
 * 🚀 [무결성 순차 제어 아키텍처 및 자동 클릭 물리 트리거 엔진]
 * ==============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchData().then(() => {
        updatePathDisplay(); 

        const mainButtons = document.querySelectorAll('#main-category-group button');
        const targetMainBtn = Array.from(mainButtons).find(btn => btn.textContent.trim() === '지역1');

        if (targetMainBtn) {
            targetMainBtn.click(); 
        } else {
            const firstMainBtn = document.querySelector('#main-category-group button');
            if (firstMainBtn) firstMainBtn.click();
        }
    });
});
