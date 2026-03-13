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
};

async function initApp() {
    try {
        const response = await fetch('question_bank.json');
        if (!response.ok) throw new Error('無法讀取題庫檔案');
        const data = await response.json();
        
        processQuestions(data);
        Elements.loadingOverlay.classList.add('hide');
        Elements.homeScreen.classList.add('active');
        
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
    State.timeLeft = 120 * 60;
    
    const TARGET_PER_SUBJ = 30;
    
    for (const [subj, groupList] of Object.entries(State.questionsGrouped)) {
        // Shuffle groups
        const shuffledGroups = [...groupList].sort(() => 0.5 - Math.random());
        let selectedForSubj = [];
        let count = 0;
        
        for (const group of shuffledGroups) {
            if (count >= TARGET_PER_SUBJ && count > 0) break;
            selectedForSubj = selectedForSubj.concat(group);
            count += group.length;
        }
        
        State.examQuestions = State.examQuestions.concat(selectedForSubj);
    }
}

function startExam() {
    generateExam();
    Elements.homeScreen.classList.remove('active');
    Elements.examScreen.classList.add('active');
    
    updateTimerDisplay();
    State.timerId = setInterval(tickTimer, 1000);
    renderQuestion();
}

function tickTimer() {
    if (State.timeLeft > 0) {
        State.timeLeft--;
        updateTimerDisplay();
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

function submitExam() {
    clearInterval(State.timerId);
    Elements.examScreen.classList.remove('active');
    Elements.resultScreen.classList.add('active');
    
    calculateAndRenderScore();
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
        </div>
    `;
}

Elements.btnRestart.addEventListener('click', () => {
    Elements.resultScreen.classList.remove('active');
    Elements.homeScreen.classList.add('active');
    Elements.reviewList.innerHTML = ''; // 清除大量 DOM
});

// Boot app
window.addEventListener('DOMContentLoaded', initApp);
