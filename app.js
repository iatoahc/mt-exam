const State = {
    questionsGrouped: {},
    examQuestions: [],
    answers: {},
    currentIndex: 0,
    timeLeft: 120 * 60,
    timerId: null,
};

const Elements = {
    homeScreen: document.getElementById('home-screen'),
    examScreen: document.getElementById('exam-screen'),
    resultScreen: document.getElementById('result-screen'),
    loadingOverlay: document.getElementById('loading-overlay'),
    
    btnStart: document.getElementById('btn-start'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnSubmit: document.getElementById('btn-submit'),
    btnEarlySubmit: document.getElementById('btn-early-submit'),
    btnRestart: document.getElementById('btn-restart'),
    
    timer: document.getElementById('timer'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),
    subjectLabel: document.getElementById('subject-label'),
    questionText: document.getElementById('question-text'),
    imageContainer: document.getElementById('image-container'),
    optionsContent: document.querySelectorAll('.option-label'),
    
    totalScore: document.getElementById('total-score'),
    subjectScores: document.getElementById('subject-scores'),
    reviewList: document.getElementById('review-list'),
    
    // 新增配置與恢復/下載元素
    subjectSelectList: document.getElementById('subject-select-list'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnSelectNone: document.getElementById('btn-select-none'),
    examConfigDesc: document.getElementById('exam-config-desc'),
    btnResume: document.getElementById('btn-resume'),
    btnViewLast: document.getElementById('btn-view-last'),
    btnDownloadRecord: document.getElementById('btn-download-record'),
};

async function initApp() {
    try {
        const response = await fetch('question_bank.json');
        if (!response.ok) throw new Error('無法讀取題庫檔案');
        const data = await response.json();
        
        processQuestions(data);
        Elements.loadingOverlay.classList.add('hide');
        Elements.homeScreen.classList.add('active');
        
        initHomeUI();
        checkLocalStorageButtons();
    } catch (error) {
        alert('載入題庫失敗！請確保您在伺服器環境下開啟此網頁（例如使用 Live Server），或檢查檔案是否存在。');
        console.error(error);
    }
}

function processQuestions(data) {
    const subjects = {};
    let currentGroup = [];
    
    data.forEach(q => {
        const qText = q.question || '';
        const subj = q.subject || '未知';
        
        if (!subjects[subj]) subjects[subj] = [];
        
        if (qText.startsWith('承上題') || qText.startsWith('承第')) {
            if (currentGroup.length > 0 && currentGroup[0].subject === subj && currentGroup[0].exam_id === q.exam_id) {
                currentGroup.push(q);
            } else {
                if (currentGroup.length > 0) {
                    subjects[currentGroup[0].subject].push(currentGroup);
                }
                currentGroup = [q];
            }
        } else {
            if (currentGroup.length > 0) {
                subjects[currentGroup[0].subject].push(currentGroup);
            }
            currentGroup = [q];
        }
    });
    
    if (currentGroup.length > 0) {
        subjects[currentGroup[0].subject].push(currentGroup);
    }
    
    State.questionsGrouped = subjects;
}

function generateExam() {
    State.examQuestions = [];
    State.answers = {};
    State.currentIndex = 0;
    
    // 取得選取的科目
    const selectedSubjs = Array.from(document.querySelectorAll('input[name="subject"]:checked')).map(cb => cb.value);
    // 取得選取的題數
    const qCountRadio = document.querySelector('input[name="q-count"]:checked');
    const targetPerSubj = qCountRadio ? parseInt(qCountRadio.value) : 30;
    
    // 計算限時：30題每科20分，80題每科60分
    const timePerSubj = targetPerSubj === 30 ? 20 : 60;
    State.timeLeft = selectedSubjs.length * timePerSubj * 60;
    
    selectedSubjs.forEach(subj => {
        const groupList = State.questionsGrouped[subj] || [];
        
        // 將題目群組分類為 110年及以後 (新) 與 110年以前 (舊)
        const newGroups = [];
        const oldGroups = [];
        
        groupList.forEach(group => {
            if (group.length === 0) return;
            const examIdStr = String(group[0].exam_id || '');
            const year = parseInt(examIdStr.substring(0, 3));
            if (year >= 110) {
                newGroups.push(group);
            } else {
                oldGroups.push(group);
            }
        });
        
        // 各自隨機洗牌
        const shuffledNew = [...newGroups].sort(() => 0.5 - Math.random());
        const shuffledOld = [...oldGroups].sort(() => 0.5 - Math.random());
        
        let selectedForSubj = [];
        let newQCount = 0;
        let oldQCount = 0;
        
        // 目標：新題目佔 60% (例如 30 題中的 18 題)，舊題目佔 40% (例如 30 題中的 12 題)
        const targetNew = Math.round(targetPerSubj * 0.6);
        
        // 1. 抽取 110 年之後的題目 (主範圍 60%)
        let newIdx = 0;
        for (; newIdx < shuffledNew.length; newIdx++) {
            const group = shuffledNew[newIdx];
            if (newQCount >= targetNew && newQCount > 0) break;
            selectedForSubj = selectedForSubj.concat(group);
            newQCount += group.length;
        }
        
        // 2. 抽取 110 年之前的題目 (次範圍 40%)
        let oldIdx = 0;
        for (; oldIdx < shuffledOld.length; oldIdx++) {
            const group = shuffledOld[oldIdx];
            if ((newQCount + oldQCount) >= targetPerSubj && oldQCount > 0) break;
            selectedForSubj = selectedForSubj.concat(group);
            oldQCount += group.length;
        }
        
        // 3. 補位機制：如果其中一邊題目不夠，再拿另外一邊剩下的題目補滿目標總題數
        if ((newQCount + oldQCount) < targetPerSubj && newIdx < shuffledNew.length) {
            for (; newIdx < shuffledNew.length; newIdx++) {
                const group = shuffledNew[newIdx];
                if ((newQCount + oldQCount) >= targetPerSubj) break;
                selectedForSubj = selectedForSubj.concat(group);
                newQCount += group.length;
            }
        }
        
        if ((newQCount + oldQCount) < targetPerSubj && oldIdx < shuffledOld.length) {
            for (; oldIdx < shuffledOld.length; oldIdx++) {
                const group = shuffledOld[oldIdx];
                if ((newQCount + oldQCount) >= targetPerSubj) break;
                selectedForSubj = selectedForSubj.concat(group);
                oldQCount += group.length;
            }
        }
        
        State.examQuestions = State.examQuestions.concat(selectedForSubj);
    });
}

function startExam() {
    generateExam();
    Elements.homeScreen.classList.remove('active');
    Elements.examScreen.classList.add('active');
    
    updateTimerDisplay();
    State.timerId = setInterval(tickTimer, 1000);
    renderQuestion();
    
    saveActiveSession();
    checkLocalStorageButtons();
}
 
function tickTimer() {
    if (State.timeLeft > 0) {
        State.timeLeft--;
        updateTimerDisplay();
        if (State.timeLeft % 5 === 0) {
            saveActiveSession();
        }
    } else {
        clearInterval(State.timerId);
        alert('考試時間到！系統將自動交卷。');
        submitExam();
    }
}

function updateTimerDisplay() {
    const m = Math.floor(State.timeLeft / 60).toString().padStart(2, '0');
    const s = (State.timeLeft % 60).toString().padStart(2, '0');
    Elements.timer.innerText = `${m}:${s}`;
}

function renderQuestion() {
    const idx = State.currentIndex;
    const total = State.examQuestions.length;
    const q = State.examQuestions[idx];
    
    // Progress bar and text
    Elements.progressText.innerText = `${idx + 1} / ${total}`;
    Elements.progressBar.style.width = `${((idx + 1) / total) * 100}%`;
    Elements.subjectLabel.innerText = q.subject || '未知';
    
    // Question Text
    const examInfo = q.exam_id ? `(${q.exam_id}) ` : '';
    Elements.questionText.innerText = `${idx + 1}. ${examInfo}${q.question}`;
    
    // Images
    Elements.imageContainer.innerHTML = '';
    if (q.images && q.images.length > 0) {
        q.images.forEach(imgSrc => {
            const img = document.createElement('img');
            // Clean up windows path separators from python script
            img.src = imgSrc.replace(/\\/g, '/'); 
            // fallback error handling
            img.onerror = () => { img.style.display = 'none'; };
            Elements.imageContainer.appendChild(img);
        });
    }
    
    // Options
    Elements.optionsContent.forEach(label => {
        const input = label.querySelector('input');
        const textSpan = label.querySelector('.opt-text');
        const val = input.value;
        
        textSpan.innerText = q.options ? (q.options[val] || '') : '';
        
        // Restore previous answer
        if (State.answers[idx] === val) {
            input.checked = true;
        } else {
            input.checked = false;
        }
        
        // Listeners for click map
        input.onchange = () => {
            State.answers[idx] = input.value;
            saveActiveSession();
        };
    });
    
    // Buttons state
    Elements.btnPrev.disabled = idx === 0;
    
    if (idx === total - 1) {
        Elements.btnNext.classList.add('hide');
        Elements.btnSubmit.classList.remove('hide');
    } else {
        Elements.btnNext.classList.remove('hide');
        Elements.btnSubmit.classList.add('hide');
    }
    
    // Scroll to top
    Elements.examScreen.querySelector('.scrollable').scrollTop = 0;
    saveActiveSession();
}

Elements.btnStart.addEventListener('click', startExam);

Elements.btnNext.addEventListener('click', () => {
    if (State.currentIndex < State.examQuestions.length - 1) {
        State.currentIndex++;
        renderQuestion();
    }
});

Elements.btnPrev.addEventListener('click', () => {
    if (State.currentIndex > 0) {
        State.currentIndex--;
        renderQuestion();
    }
});

Elements.btnSubmit.addEventListener('click', () => {
    if (confirm('確定要交卷嗎？未作答的題目將不予計分。')) {
        submitExam();
    }
});

Elements.btnEarlySubmit.addEventListener('click', () => {
    if (confirm('確定要提前交卷嗎？未作答的題目將不予計分。')) {
        submitExam();
    }
});

function submitExam() {
    clearInterval(State.timerId);
    localStorage.removeItem('mt_exam_active_session');
    Elements.examScreen.classList.remove('active');
    Elements.resultScreen.classList.add('active');
    
    calculateAndRenderScore();
    saveLastResult();
    checkLocalStorageButtons();
}

function calculateAndRenderScore() {
    const scoreBySubject = {};
    let totalCorrect = 0;
    let totalQ = State.examQuestions.length;
    
    // Init Subjects mapping
    State.examQuestions.forEach(q => {
        const subj = q.subject || '未知';
        if (!scoreBySubject[subj]) {
            scoreBySubject[subj] = { correct: 0, total: 0 };
        }
        scoreBySubject[subj].total++;
    });
    
    let htmlContent = '';
    
    State.examQuestions.forEach((q, idx) => {
        const subj = q.subject || '未知';
        const correctAns = (q.answer || '').trim().toUpperCase();
        const userAns = (State.answers[idx] || '').trim().toUpperCase();
        const isCorrect = userAns === correctAns;
        
        if (isCorrect) {
            scoreBySubject[subj].correct++;
            totalCorrect++;
        }
        
        // Render Review Item
        htmlContent += buildReviewItemHTML(idx, q, userAns, correctAns, isCorrect);
    });
    
    // Render Scope Header
    Elements.totalScore.innerText = `${(totalCorrect * 1.25).toFixed(2)} / ${(totalQ * 1.25).toFixed(2)}`;
    
    let subjHtml = '';
    for (const [subj, stats] of Object.entries(scoreBySubject)) {
        subjHtml += `
            <div class="subj-score-item">
                <span>【${subj}】 答對: ${stats.correct} / ${stats.total} 題</span>
                <span>${(stats.correct * 1.25).toFixed(2)} / ${(stats.total * 1.25).toFixed(2)} 分</span>
            </div>
        `;
    }
    Elements.subjectScores.innerHTML = subjHtml;
    
    Elements.reviewList.innerHTML = htmlContent;
}

function buildReviewItemHTML(idx, q, userAns, correctAns, isCorrect) {
    const examInfo = q.exam_id ? `(${q.exam_id}) ` : '';
    let imgsHtml = '';
    if (q.images && q.images.length > 0) {
        imgsHtml = `<div class="review-img">`;
        q.images.forEach(img => {
            imgsHtml += `<img src="${img.replace(/\\/g, '/')}" loading="lazy" alt="Question Image">`;
        });
        imgsHtml += `</div>`;
    }
    
    let optsHtml = '<div class="review-opts">';
    if (q.options) {
        ['A','B','C','D'].forEach(k => {
            if (q.options[k]) {
                optsHtml += `<div>${k}. ${q.options[k]}</div>`;
            }
        });
    }
    optsHtml += '</div>';
    
    const userClass = isCorrect ? 'user-correct' : 'user-wrong';
    const statusText = isCorrect ? '✔️ 答對' : '❌ 答錯';
    
    let explanationHtml = '';
    if (q.explanation) {
        explanationHtml = `
            <div class="review-explanation">
                <strong>💡 詳解：</strong>
                <p>${q.explanation}</p>
            </div>
        `;
    }

    return `
        <div class="review-item ${isCorrect ? '' : 'wrong'}">
            <div class="review-head">
                <span>第 ${idx + 1} 題 [${q.subject || '未知'}]</span>
                <span>${statusText}</span>
            </div>
            <div class="review-question">${examInfo}${q.question}</div>
            ${imgsHtml}
            ${optsHtml}
            <div class="review-ans">
                <span class="user-ans ${userClass}">你的答案: ${userAns || '未作答'}</span>
                <span class="correct-ans">正確答案: ${correctAns}</span>
            </div>
            ${explanationHtml}
        </div>
    `;
}

Elements.btnRestart.addEventListener('click', () => {
    Elements.resultScreen.classList.remove('active');
    Elements.homeScreen.classList.add('active');
    Elements.reviewList.innerHTML = ''; // 清除大量 DOM
    checkLocalStorageButtons();
});

// 新增輔助函式與 LocalStorage 管理
function initHomeUI() {
    const subjects = Object.keys(State.questionsGrouped);
    Elements.subjectSelectList.innerHTML = '';
    
    subjects.forEach((subj) => {
        const totalQForSubj = State.questionsGrouped[subj].reduce((sum, g) => sum + g.length, 0);
        const label = document.createElement('label');
        label.className = 'subj-item';
        label.innerHTML = `
            <input type="checkbox" name="subject" value="${subj}" checked>
            <span>${subj} (共 ${totalQForSubj} 題)</span>
        `;
        Elements.subjectSelectList.appendChild(label);
        
        label.querySelector('input').addEventListener('change', updateConfigSummary);
    });
    
    document.querySelectorAll('input[name="q-count"]').forEach(radio => {
        radio.addEventListener('change', updateConfigSummary);
    });
    
    Elements.btnSelectAll.addEventListener('click', () => {
        document.querySelectorAll('input[name="subject"]').forEach(cb => cb.checked = true);
        updateConfigSummary();
    });
    
    Elements.btnSelectNone.addEventListener('click', () => {
        document.querySelectorAll('input[name="subject"]').forEach(cb => cb.checked = false);
        updateConfigSummary();
    });
    
    Elements.btnResume.addEventListener('click', resumeActiveSession);
    Elements.btnViewLast.addEventListener('click', loadLastResult);
    Elements.btnDownloadRecord.addEventListener('click', downloadExamRecord);
    
    updateConfigSummary();
}

function updateConfigSummary() {
    const selectedCbs = document.querySelectorAll('input[name="subject"]:checked');
    const selectedCount = selectedCbs.length;
    
    const qCountRadio = document.querySelector('input[name="q-count"]:checked');
    const qCountPerSubj = parseInt(qCountRadio.value);
    
    if (selectedCount === 0) {
        Elements.examConfigDesc.innerText = '請至少選擇一個科目！';
        Elements.btnStart.disabled = true;
        Elements.btnStart.style.opacity = 0.5;
        return;
    }
    
    Elements.btnStart.disabled = false;
    Elements.btnStart.style.opacity = 1;
    
    let totalQuestions = 0;
    selectedCbs.forEach(cb => {
        const subj = cb.value;
        const groupList = State.questionsGrouped[subj] || [];
        const subjTotalQ = groupList.reduce((sum, g) => sum + g.length, 0);
        totalQuestions += Math.min(subjTotalQ, qCountPerSubj);
    });
    
    const timePerSubj = qCountPerSubj === 30 ? 20 : 60;
    const timeLimitMinutes = selectedCount * timePerSubj;
    
    Elements.examConfigDesc.innerHTML = `
        包含：<strong>${selectedCount}</strong> 個科目<br>
        估計題數：約 <strong>${totalQuestions}</strong> 題 (每科最多 ${qCountPerSubj} 題)<br>
        測驗限時：<strong>${timeLimitMinutes}</strong> 分鐘
    `;
}

function saveActiveSession() {
    if (State.examQuestions.length === 0) return;
    localStorage.setItem('mt_exam_active_session', JSON.stringify({
        examQuestions: State.examQuestions,
        answers: State.answers,
        currentIndex: State.currentIndex,
        timeLeft: State.timeLeft
    }));
}

function resumeActiveSession() {
    const dataStr = localStorage.getItem('mt_exam_active_session');
    if (!dataStr) return;
    try {
        const session = JSON.parse(dataStr);
        State.examQuestions = session.examQuestions;
        State.answers = session.answers;
        State.currentIndex = session.currentIndex;
        State.timeLeft = session.timeLeft;
        
        Elements.homeScreen.classList.remove('active');
        Elements.examScreen.classList.add('active');
        
        updateTimerDisplay();
        clearInterval(State.timerId);
        State.timerId = setInterval(tickTimer, 1000);
        renderQuestion();
    } catch (e) {
        console.error("無法恢復測驗狀態", e);
    }
}

function saveLastResult() {
    try {
        localStorage.setItem('mt_exam_last_result', JSON.stringify({
            examQuestions: State.examQuestions,
            answers: State.answers,
            totalScore: Elements.totalScore.innerText,
            subjectScoresHtml: Elements.subjectScores.innerHTML,
            reviewListHtml: Elements.reviewList.innerHTML
        }));
    } catch (e) {
        console.error("無法儲存測驗結果至 LocalStorage", e);
    }
}

function loadLastResult() {
    const dataStr = localStorage.getItem('mt_exam_last_result');
    if (!dataStr) return;
    try {
        const lastResult = JSON.parse(dataStr);
        State.examQuestions = lastResult.examQuestions;
        State.answers = lastResult.answers;
        
        Elements.totalScore.innerText = lastResult.totalScore;
        Elements.subjectScores.innerHTML = lastResult.subjectScoresHtml;
        Elements.reviewList.innerHTML = lastResult.reviewListHtml;
        
        Elements.homeScreen.classList.remove('active');
        Elements.resultScreen.classList.add('active');
    } catch (e) {
        console.error("無法載入上一次測驗結果", e);
    }
}

function checkLocalStorageButtons() {
    if (localStorage.getItem('mt_exam_active_session')) {
        Elements.btnResume.classList.remove('hide');
    } else {
        Elements.btnResume.classList.add('hide');
    }
    
    if (localStorage.getItem('mt_exam_last_result')) {
        Elements.btnViewLast.classList.remove('hide');
    } else {
        Elements.btnViewLast.classList.add('hide');
    }
}

function downloadExamRecord() {
    const now = new Date();
    const dateTimeStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const filename = `醫檢師模擬測驗紀錄_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}.html`;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = Elements.reviewList.innerHTML;
    tempDiv.querySelectorAll('img').forEach(img => {
        img.setAttribute('src', img.src);
    });
    const absoluteReviewHtml = tempDiv.innerHTML;
    
    const totalScore = Elements.totalScore.innerText;
    const subjectScoresHtml = Elements.subjectScores.innerHTML;
    
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>醫檢師國考模擬測驗紀錄 - ${dateTimeStr}</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1e293b;
            font-size: 24px;
            margin-bottom: 5px;
        }
        .header p {
            color: #64748b;
            margin: 0;
        }
        .glass-card {
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
        }
        .score-number {
            font-size: 48px;
            font-weight: 800;
            color: #3b82f6;
            margin: 10px 0;
            text-align: center;
        }
        .subject-scores-list {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .subj-score-item {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
        }
        .subj-score-item span:last-child {
            font-weight: 600;
        }
        .review-title {
            margin-bottom: 15px;
            border-left: 4px solid #3b82f6;
            padding-left: 10px;
            font-size: 20px;
            color: #1e293b;
        }
        .review-item {
            background: #ffffff;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            border: 1px solid #e2e8f0;
            border-left: 5px solid #10b981;
        }
        .review-item.wrong {
            border-left-color: #ef4444;
        }
        .review-head {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
        }
        .review-question {
            font-weight: 600;
            margin-bottom: 12px;
            font-size: 16px;
        }
        .review-img {
            margin-bottom: 12px;
        }
        .review-img img {
            max-width: 100%;
            max-height: 400px;
            margin-bottom: 10px;
            border-radius: 8px;
            display: block;
        }
        .review-opts {
            font-size: 14px;
            margin-bottom: 10px;
            color: #64748b;
            line-height: 1.6;
        }
        .review-ans {
            background: #f8fafc;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
        }
        .user-wrong {
            color: #ef4444;
        }
        .user-correct {
            color: #10b981;
        }
        .correct-ans {
            color: #10b981;
        }
        .review-explanation {
            margin-top: 12px;
            padding: 12px 15px;
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            border-radius: 6px;
            font-size: 14px;
            color: #333;
        }
        .review-explanation strong {
            color: #e65100;
            display: block;
            margin-bottom: 5px;
        }
        .review-explanation p {
            margin: 0;
            line-height: 1.6;
        }
        @media print {
            body {
                background-color: #fff;
                padding: 0;
            }
            .glass-card, .review-item {
                box-shadow: none;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚕️ 醫檢師國考模擬測驗作答紀錄</h1>
        <p>測驗時間：${dateTimeStr}</p>
    </div>
    
    <div class="glass-card">
        <h3 style="text-align: center; color: #64748b; margin-top: 0;">總得分</h3>
        <div class="score-number">${totalScore}</div>
        <div class="subject-scores-list">
            ${subjectScoresHtml}
        </div>
    </div>
    
    <h3 class="review-title">全卷作答與錯題檢討</h3>
    <div class="review-list">
        ${absoluteReviewHtml}
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Boot app
window.addEventListener('DOMContentLoaded', initApp);
