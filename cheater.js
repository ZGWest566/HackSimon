// ==UserScript==
// @name         HackSimon
// @namespace    http://tampermonkey.net/
// @version      v1.1
// @description  try to take over the world!
// @author       Hypergryph Network
// @match        http://simon.nekko.cn:1234/

// @grant        unsafeWindow

// ==/UserScript==

function showToast(message, duration = 1000) {
    // 如果已存在消息框，先移除旧的（保证只有一个）
    const existing = document.getElementById('toast-message');
    if (existing) existing.remove();

    // 创建新消息框
    const toast = document.createElement('div');
    toast.id = 'toast-message';
    toast.textContent = message;

    // 基础样式
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(20,20,20,0.8)',
        color: '#f0f0ff',
        padding: '10px 20px',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        zIndex: '9999',
        boxShadow: '0 2px 10px rgba(255,255,255,0.3)',
        opacity: '0',
        transition: 'opacity 0.2s ease'
    });

    document.body.appendChild(toast);
    // 强制重绘后淡入
    setTimeout(() => { toast.style.opacity = '1'; }, 10);

    // 设置自动消失
    if (duration > 0) {
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, duration);
    }
}

let cheatQuestionsList;

async function getData(id) {
    cheatQuestionsList = await api('GET', `/api/questions/${id}?role=teacher`);
    //I cracked the code:)
    console.log('=== 题目总数:', cheatQuestionsList.length, '===');
    cheatQuestionsList.forEach((q, i) => {
        const raw = q.correct_answer;
        const type = q.question_type || '?';
        console.log(
            `[${i}] type=${type} | correct_answer=`, raw,
            `| typeof=${typeof raw} | isArray=${Array.isArray(raw)} | [1]=${raw?.[1]}`,
            q
        );
    });
}

// ── 豆包嵌入式弹窗 ────────────────────────────────────────
let _doubaoPanel = null;

function toggleDoubao() {
    // 已存在 → 关闭
    if (_doubaoPanel) {
        _doubaoPanel.remove();
        _doubaoPanel = null;
        return;
    }
    // 创建容器
    _doubaoPanel = document.createElement('div');
    _doubaoPanel.id = 'doubao-panel';
    Object.assign(_doubaoPanel.style, {
        position: 'fixed',
        top: '10%',
        right: '20px',
        width: '420px',
        height: '75%',
        zIndex: '99999',
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        resize: 'both',
        minWidth: '300px',
        minHeight: '300px'
    });

    // 标题栏（可拖拽）
    const bar = document.createElement('div');
    bar.textContent = '🤖 豆包助手';
    Object.assign(bar.style, {
        padding: '10px 14px',
        background: '#1a1a2e',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'move',
        flexShrink: '0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        userSelect: 'none'
    });
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
        cursor: 'pointer',
        fontSize: '18px',
        padding: '0 4px',
        opacity: '0.7'
    });
    closeBtn.onclick = (e) => { e.stopPropagation(); toggleDoubao(); };
    bar.appendChild(closeBtn);

    // 拖拽
    let dragging = false, ox, oy;
    bar.onmousedown = (e) => {
        dragging = true;
        ox = e.clientX - _doubaoPanel.offsetLeft;
        oy = e.clientY - _doubaoPanel.offsetTop;
        document.body.style.userSelect = 'none';
    };
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        _doubaoPanel.style.left = (e.clientX - ox) + 'px';
        _doubaoPanel.style.top = (e.clientY - oy) + 'px';
        _doubaoPanel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
        dragging = false;
        document.body.style.userSelect = '';
    });

    // iframe
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.doubao.com/chat/';
    Object.assign(iframe.style, {
        flex: '1',
        border: 'none',
        width: '100%',
        height: '100%'
    });
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

    _doubaoPanel.appendChild(bar);
    _doubaoPanel.appendChild(iframe);
    document.body.appendChild(_doubaoPanel);
}

(function() {
    'use strict';
    // 禁用反作弊，覆写函数
    triggerAntiCheat = function() {
        if (!document.getElementById('screen-exam')?.classList.contains('active')) return;
        S.tabSwitches = 0;
        saveExamState();
        const overlay = document.getElementById('anticheat-overlay');
        const msgEl = document.getElementById('anticheat-msg');
        const countEl = document.getElementById('anticheat-count');
        const btnEl = document.getElementById('anticheat-btn');
        if (!overlay) return;
        countEl.textContent = S.tabSwitches;
        msgEl.textContent = `虽然但是，犯瘤蟀管不着你。`;
        btnEl.style.display = '';
        btnEl.textContent = '我知道错了，下次还干';
        btnEl.onclick = () => { overlay._shouldShow = false; overlay.style.display = 'none'; };
        overlay._shouldShow = true;
        overlay.style.display = 'flex';
    };

    // 解析 subs_json（可能是 JSON 字符串或已解析对象）
    function parseSubs(subs) {
        if (!subs) return null;
        if (typeof subs === 'string') {
            try { return JSON.parse(subs); } catch (e) { return null; }
        }
        return subs;
    }

    // 从题目对象中提取答案：多选读 subs_json.correct，单选读 correct_answer
    function getAnswer(q) {
        const subs = parseSubs(q.subs_json);
        if (subs && subs.multi && Array.isArray(subs.correct)) {
            return { multi: true, answer: subs.correct };
        }
        return { multi: false, answer: q.correct_answer };
    }

    // 将答案索引转为字母（0→A, 1→B, ...），多选用逗号分隔
    function answerToLetters(result) {
        if (result === null || result.answer === null || result.answer === undefined) return null;
        const ans = result.answer;
        if (result.multi) {
            return ans.map(i => String.fromCharCode(65 + i)).join(', ');
        }
        return String.fromCharCode(65 + ans);
    }

    document.addEventListener('keydown', function(event) {
        // 输入框内不触发快捷键
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

        if (event.key === 'w') {
            getData(S.activeExam.id);
            showToast("获取答案数据成功");
        }
        // E: 打开/关闭豆包弹窗
        if (event.key === 'e') {
            toggleDoubao();
        }
        // Q: 查看当前题目答案
        if (event.key === 'q') {
            if (!cheatQuestionsList) { showToast("请先按 W 获取答案数据"); return; }
            let currentQIdx = S.currentQIdx;
            let result = getAnswer(cheatQuestionsList[currentQIdx]);
            let letters = answerToLetters(result);
            let typeLabel = result.multi ? '【多选】' : '';
            if (letters) {
                showToast("第" + (currentQIdx + 1) + "题" + typeLabel + "答案: " + letters);
            } else {
                showToast("答案走丢了 (subs_json=" + JSON.stringify(cheatQuestionsList[currentQIdx].subs_json) + " correct_answer=" + cheatQuestionsList[currentQIdx].correct_answer + ")");
            }
        }
        // A: 一键填充所有答案
        if (event.key === 'a') {
            if (!cheatQuestionsList) { showToast("请先按 W 获取答案数据"); return; }
            let singleCount = 0, multiCount = 0;
            cheatQuestionsList.forEach((q, index) => {
                let result = getAnswer(q);
                if (result.answer === null || result.answer === undefined) return;
                S.answers[index] = result.answer;  // 单选是数字，多选是数组，直接存
                result.multi ? multiCount++ : singleCount++;
            });
            saveExamState();
            showToast("填充完成: " + singleCount + " 单选 + " + multiCount + " 多选");
            // 跳转到最后一题，触发提交确认
            const lastIdx = cheatQuestionsList.length - 1;
            S.currentQIdx = lastIdx;
            if (typeof renderQuestion === 'function') renderQuestion(lastIdx);
        }
    });

})();