const EXAM_STORAGE_KEY = 'exam-clock-settings';
const SCHEDULE_STORAGE_KEY = 'school-bell-schedule';
const POMODORO_STORAGE_KEY = 'study-pomodoro-settings';
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

let app;
let tabButtons = {};
let tabPanels = {};
let dateDisplay;
let clockDisplay;
let examInfoDisplay;
let countdownDisplay;
let fullscreenButton;
let fields = {};
let infoValues = {};
let scheduleList;
let autoBellCheckbox;
let audioStatus;
let pomodoroDisplay;
let pomodoroPhaseDisplay;
let pomodoroRoundDisplay;
let pomodoroStatus;
let pomodoroFields = {};
let audioContext;
let schedule = [];
let autoBellEnabled = false;
let lastAutoBellMinute = '';
let pomodoro = {
  focusMinutes: 25,
  breakMinutes: 5,
  phase: 'focus',
  round: 1,
  remainingSeconds: 25 * 60,
  running: false,
  deadline: null
};

function setup() {
  noCanvas();
  document.documentElement.lang = 'zh-Hant';
  buildPage();
  loadExamSettings();
  loadScheduleSettings();
  loadPomodoroSettings();
  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);
  syncFullscreenState();
  updateClock();
  setInterval(() => {
    updateClock();
    checkAutomaticBell();
    updatePomodoro();
  }, 1000);
}

function buildPage() {
  app = createDiv().addClass('app-shell');
  buildTabs();
  buildExamClockPage();
  buildSchoolBellPage();
  buildPomodoroPage();
  activateTab('exam');
}

function buildTabs() {
  const navigation = createDiv().addClass('tab-navigation').parent(app);
  navigation.attribute('role', 'tablist');
  navigation.attribute('aria-label', '功能分頁');

  [
    ['exam', '考試大鐘'],
    ['bells', '上下課鐘'],
    ['pomodoro', '讀書番茄鐘']
  ].forEach(([id, label]) => {
    const button = createButton(label).addClass('tab-button').parent(navigation);
    button.attribute('type', 'button');
    button.attribute('role', 'tab');
    button.attribute('aria-controls', `panel-${id}`);
    button.mousePressed(() => activateTab(id));
    tabButtons[id] = button;

    const panel = createElement('section')
      .addClass('tab-panel')
      .parent(app);
    panel.attribute('id', `panel-${id}`);
    panel.attribute('role', 'tabpanel');
    panel.attribute('aria-label', label);
    tabPanels[id] = panel;
  });
}

function activateTab(tabId) {
  Object.keys(tabPanels).forEach((id) => {
    const active = id === tabId;
    tabPanels[id].elt.hidden = !active;
    tabButtons[id].elt.setAttribute('aria-selected', String(active));
    tabButtons[id].elt.tabIndex = active ? 0 : -1;
    if (active) {
      tabButtons[id].addClass('is-active');
    } else {
      tabButtons[id].removeClass('is-active');
    }
  });
  if (tabId === 'bells' && autoBellEnabled) {
    prepareAudio();
  }
}

function buildExamClockPage() {
  const panel = tabPanels.exam;
  const header = createDiv().addClass('clock-panel').parent(panel);
  dateDisplay = createDiv().addClass('date-display').parent(header);
  clockDisplay = createDiv().addClass('clock-display').parent(header);

  const information = createDiv().addClass('exam-information').parent(panel);
  examInfoDisplay = createDiv().addClass('exam-details').parent(information);
  buildExamInfo();
  countdownDisplay = createDiv().addClass('countdown').parent(information);

  const settingsPanel = createDiv().addClass('settings-panel').parent(panel);
  const form = createDiv().addClass('settings-grid').parent(settingsPanel);
  addTextField(form, 'subject', '考試科目', '例如：數學');
  addTimeField(form, 'startTime', '開始時間');
  addTimeField(form, 'endTime', '結束時間');
  addTextField(form, 'teacher', '監考老師', '請輸入姓名');
  addNumberField(form, 'expected', '應到人數');
  addNumberField(form, 'present', '實到人數');

  const actions = createDiv().addClass('actions').parent(panel);
  fullscreenButton = createButton('進入全螢幕').addClass('fullscreen-button').parent(actions);
  fullscreenButton.attribute('type', 'button');
  fullscreenButton.mousePressed(toggleFullscreen);
}

function buildExamInfo() {
  [
    ['subject', '考試科目'],
    ['examTime', '考試時間'],
    ['teacher', '監考老師'],
    ['expected', '應到人數'],
    ['present', '實到人數'],
    ['absent', '缺考人數']
  ].forEach(([key, labelText]) => {
    const item = createDiv().addClass('info-item').parent(examInfoDisplay);
    createSpan(labelText).addClass('info-label').parent(item);
    infoValues[key] = createElement('strong', '尚未設定')
      .addClass('info-value')
      .parent(item);
  });
}

function buildSchoolBellPage() {
  const panel = tabPanels.bells;
  createElement('h1', '上下課鐘').addClass('page-title').parent(panel);

  const manualBells = createDiv().addClass('manual-bells').parent(panel);
  const startBell = createButton('上課鈴').addClass('bell-button start-bell').parent(manualBells);
  const endBell = createButton('下課鈴').addClass('bell-button end-bell').parent(manualBells);
  startBell.attribute('type', 'button');
  endBell.attribute('type', 'button');
  startBell.mousePressed(() => playBell('start'));
  endBell.mousePressed(() => playBell('end'));
  audioStatus = createDiv('按下鈴聲按鈕即可播放').addClass('audio-status').parent(panel);

  const schedulePanel = createDiv().addClass('settings-panel schedule-panel').parent(panel);
  createElement('h2', '課表').addClass('section-title').parent(schedulePanel);
  const scheduleForm = createDiv().addClass('schedule-form').parent(schedulePanel);
  const startField = createField(scheduleForm, 'new-period-start', '上課時間');
  const newStartTime = createInput('', 'time').parent(startField);
  newStartTime.attribute('id', 'new-period-start');
  newStartTime.attribute('step', '60');
  const endField = createField(scheduleForm, 'new-period-end', '下課時間');
  const newEndTime = createInput('', 'time').parent(endField);
  newEndTime.attribute('id', 'new-period-end');
  newEndTime.attribute('step', '60');
  const addButton = createButton('新增一節').addClass('secondary-button').parent(scheduleForm);
  addButton.attribute('type', 'button');
  addButton.mousePressed(() => addSchedulePeriod(newStartTime.value(), newEndTime.value()));

  autoBellCheckbox = createCheckbox('啟用自動打鐘', false).addClass('auto-bell-toggle').parent(schedulePanel);
  autoBellCheckbox.changed(() => {
    autoBellEnabled = autoBellCheckbox.checked();
    saveScheduleSettings();
    if (autoBellEnabled) {
      prepareAudio();
    }
  });

  scheduleList = createDiv().addClass('schedule-list').parent(schedulePanel);
  renderSchedule();
}

function buildPomodoroPage() {
  const panel = tabPanels.pomodoro;
  createElement('h1', '讀書番茄鐘').addClass('page-title').parent(panel);

  const timerCard = createDiv().addClass('pomodoro-card').parent(panel);
  pomodoroPhaseDisplay = createDiv().addClass('pomodoro-phase').parent(timerCard);
  pomodoroDisplay = createDiv().addClass('pomodoro-display').parent(timerCard);
  pomodoroRoundDisplay = createDiv().addClass('pomodoro-round').parent(timerCard);
  pomodoroStatus = createDiv('準備開始').addClass('pomodoro-status').parent(timerCard);

  const controls = createDiv().addClass('pomodoro-controls').parent(timerCard);
  [
    ['開始', 'pomodoro-start', startPomodoro],
    ['暫停', 'pomodoro-pause', pausePomodoro],
    ['重設', 'pomodoro-reset', resetPomodoro],
    ['跳過', 'pomodoro-skip', skipPomodoro]
  ].forEach(([label, className, handler]) => {
    const button = createButton(label).addClass(`timer-button ${className}`).parent(controls);
    button.attribute('type', 'button');
    button.mousePressed(handler);
  });

  const settings = createDiv().addClass('settings-panel pomodoro-settings').parent(panel);
  createElement('h2', '時間設定（分鐘）').addClass('section-title').parent(settings);
  const form = createDiv().addClass('settings-grid pomodoro-settings-grid').parent(settings);
  addPomodoroField(form, 'focusMinutes', '專注時間');
  addPomodoroField(form, 'breakMinutes', '休息時間');
}

function addPomodoroField(parent, name, labelText) {
  const field = createField(parent, `pomodoro-${name}`, labelText);
  const input = createInput('', 'number').parent(field);
  input.attribute('id', `pomodoro-${name}`);
  input.attribute('min', '1');
  input.attribute('max', '180');
  input.attribute('step', '1');
  input.attribute('inputmode', 'numeric');
  input.input(() => updatePomodoroDuration(name, input.value()));
  input.changed(() => updatePomodoroDuration(name, input.value()));
  pomodoroFields[name] = input;
}

function addTextField(parent, name, labelText, placeholder) {
  const field = createField(parent, `exam-${name}`, labelText);
  const input = createInput('', 'text').parent(field);
  input.attribute('id', `exam-${name}`);
  input.attribute('placeholder', placeholder);
  input.attribute('maxlength', '80');
  fields[name] = input;
  input.input(() => {
    saveExamSettings();
    updateExamInformation();
  });
}

function addTimeField(parent, name, labelText) {
  const field = createField(parent, `exam-${name}`, labelText);
  const input = createInput('', 'time').parent(field);
  input.attribute('id', `exam-${name}`);
  input.attribute('step', '60');
  fields[name] = input;
  input.input(() => {
    saveExamSettings();
    updateExamInformation();
  });
}

function addNumberField(parent, name, labelText) {
  const field = createField(parent, `exam-${name}`, labelText);
  const input = createInput('', 'number').parent(field);
  input.attribute('id', `exam-${name}`);
  input.attribute('min', '0');
  input.attribute('step', '1');
  input.attribute('inputmode', 'numeric');
  fields[name] = input;
  input.input(() => {
    saveExamSettings();
    updateExamInformation();
  });
}

function createField(parent, name, labelText) {
  const field = createDiv().addClass('field').parent(parent);
  const label = createElement('label', labelText).parent(field);
  label.attribute('for', name);
  return field;
}

function loadExamSettings() {
  const settings = {
    subject: '',
    startTime: '',
    endTime: '',
    teacher: '',
    expected: '',
    present: ''
  };

  try {
    const saved = localStorage.getItem(EXAM_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(settings).forEach((key) => {
        if (parsed && typeof parsed[key] === 'string') {
          settings[key] = parsed[key];
        }
      });
    }
  } catch (error) {
    console.error('無法讀取已儲存的考試資訊：', error);
  }

  Object.keys(fields).forEach((key) => fields[key].value(settings[key]));
  updateExamInformation();
}

function saveExamSettings() {
  const settings = {};
  Object.keys(fields).forEach((key) => {
    settings[key] = fields[key].value();
  });
  saveToStorage(EXAM_STORAGE_KEY, settings, '考試資訊');
}

function loadScheduleSettings() {
  try {
    const saved = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.periods)) {
        schedule = parsed.periods.filter((period) =>
          period &&
          timeToMinutes(period.start) !== null &&
          timeToMinutes(period.end) !== null
        );
      }
      autoBellEnabled = parsed.autoEnabled === true;
    }
  } catch (error) {
    console.error('無法讀取已儲存的課表：', error);
  }

  autoBellCheckbox.checked(autoBellEnabled);
  renderSchedule();
}

function saveScheduleSettings() {
  saveToStorage(SCHEDULE_STORAGE_KEY, {
    periods: schedule,
    autoEnabled: autoBellEnabled
  }, '課表');
}

function addSchedulePeriod(start, end) {
  if (timeToMinutes(start) === null || timeToMinutes(end) === null || start === end) {
    window.alert('請輸入有效且不同的上課與下課時間。');
    return;
  }

  schedule.push({ start, end });
  schedule.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  saveScheduleSettings();
  renderSchedule();
}

function renderSchedule() {
  if (!scheduleList) {
    return;
  }
  scheduleList.elt.replaceChildren();

  if (schedule.length === 0) {
    createDiv('尚未新增課表').addClass('empty-schedule').parent(scheduleList);
    return;
  }

  schedule.forEach((period, index) => {
    const row = createDiv().addClass('schedule-row').parent(scheduleList);
    createSpan(`第 ${index + 1} 節`).addClass('schedule-period').parent(row);
    createSpan(`${period.start} – ${period.end}`).addClass('schedule-time').parent(row);
    const deleteButton = createButton('刪除').addClass('delete-button').parent(row);
    deleteButton.attribute('type', 'button');
    deleteButton.attribute('aria-label', `刪除第 ${index + 1} 節`);
    deleteButton.mousePressed(() => {
      schedule.splice(index, 1);
      saveScheduleSettings();
      renderSchedule();
    });
  });
}

function checkAutomaticBell() {
  if (!autoBellEnabled) {
    return;
  }
  const now = new Date();
  if (now.getSeconds() > 5) {
    return;
  }

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${time}`;
  if (lastAutoBellMinute === minuteKey) {
    return;
  }

  const period = schedule.find((item) => item.start === time || item.end === time);
  if (!period) {
    return;
  }

  lastAutoBellMinute = minuteKey;
  playBell(period.start === time ? 'start' : 'end');
}

function loadPomodoroSettings() {
  try {
    const saved = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      pomodoro.focusMinutes = validDuration(parsed.focusMinutes, 25);
      pomodoro.breakMinutes = validDuration(parsed.breakMinutes, 5);
    }
  } catch (error) {
    console.error('無法讀取已儲存的番茄鐘設定：', error);
  }

  pomodoro.remainingSeconds = durationForPhase('focus') * 60;
  pomodoroFields.focusMinutes.value(String(pomodoro.focusMinutes));
  pomodoroFields.breakMinutes.value(String(pomodoro.breakMinutes));
  renderPomodoro();
}

function updatePomodoroDuration(name, value) {
  if (!pomodoroFields[name]) {
    return;
  }
  if (!/^\d{1,3}$/.test(value)) {
    return;
  }
  const minutes = Number(value);
  if (minutes < 1 || minutes > 180) {
    return;
  }

  pomodoro[name] = minutes;
  pomodoro.running = false;
  pomodoro.deadline = null;
  pomodoro.phase = 'focus';
  pomodoro.round = 1;
  pomodoro.remainingSeconds = durationForPhase('focus') * 60;
  saveToStorage(POMODORO_STORAGE_KEY, {
    focusMinutes: pomodoro.focusMinutes,
    breakMinutes: pomodoro.breakMinutes
  }, '番茄鐘設定');
  renderPomodoro();
}

function startPomodoro() {
  if (pomodoro.running) {
    return;
  }
  prepareAudio();
  pomodoro.running = true;
  pomodoro.deadline = Date.now() + pomodoro.remainingSeconds * 1000;
  pomodoroStatus.elt.textContent = '計時中';
  renderPomodoro();
}

function pausePomodoro() {
  if (!pomodoro.running) {
    return;
  }
  pomodoro.remainingSeconds = Math.max(0, Math.ceil((pomodoro.deadline - Date.now()) / 1000));
  pomodoro.running = false;
  pomodoro.deadline = null;
  pomodoroStatus.elt.textContent = '已暫停';
  renderPomodoro();
}

function resetPomodoro() {
  pomodoro.running = false;
  pomodoro.deadline = null;
  pomodoro.phase = 'focus';
  pomodoro.round = 1;
  pomodoro.remainingSeconds = durationForPhase('focus') * 60;
  pomodoroStatus.elt.textContent = '已重設';
  renderPomodoro();
}

function skipPomodoro() {
  advancePomodoro(false);
}

function updatePomodoro() {
  if (!pomodoro.running) {
    return;
  }
  pomodoro.remainingSeconds = Math.max(0, Math.ceil((pomodoro.deadline - Date.now()) / 1000));
  if (pomodoro.remainingSeconds === 0) {
    advancePomodoro(true);
    return;
  }
  renderPomodoro();
}

function advancePomodoro(playNotification) {
  const wasRunning = pomodoro.running;
  if (playNotification) {
    playBell('timer');
  }

  if (pomodoro.phase === 'focus') {
    pomodoro.phase = 'break';
  } else {
    pomodoro.phase = 'focus';
    pomodoro.round += 1;
  }

  pomodoro.remainingSeconds = durationForPhase(pomodoro.phase) * 60;
  pomodoro.running = wasRunning;
  pomodoro.deadline = wasRunning ? Date.now() + pomodoro.remainingSeconds * 1000 : null;
  pomodoroStatus.elt.textContent = wasRunning ? '計時中' : '已切換階段';
  renderPomodoro();
}

function renderPomodoro() {
  if (!pomodoroDisplay) {
    return;
  }
  const minutes = Math.floor(pomodoro.remainingSeconds / 60);
  const seconds = pomodoro.remainingSeconds % 60;
  pomodoroDisplay.elt.textContent = `${pad(minutes)}:${pad(seconds)}`;
  pomodoroPhaseDisplay.elt.textContent = pomodoro.phase === 'focus' ? '專注時間' : '休息時間';
  pomodoroRoundDisplay.elt.textContent = `第 ${pomodoro.round} 輪`;
}

function durationForPhase(phase) {
  return phase === 'focus' ? pomodoro.focusMinutes : pomodoro.breakMinutes;
}

function validDuration(value, fallback) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 180 ? minutes : fallback;
}

function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    audioStatus.elt.textContent = '此瀏覽器不支援 Web Audio API。';
    return false;
  }

  try {
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch((error) => {
        console.error('無法啟用音訊：', error);
        audioStatus.elt.textContent = '無法啟用音訊，請再次按下鈴聲按鈕。';
      });
    }
    return true;
  } catch (error) {
    console.error('無法建立音訊：', error);
    audioStatus.elt.textContent = '無法啟用音訊，請檢查瀏覽器設定。';
    return false;
  }
}

function playBell(type) {
  if (!prepareAudio()) {
    return;
  }

  const profiles = {
    start: { notes: [880, 1108, 1320], strikes: 3 },
    end: { notes: [660, 880, 1108], strikes: 2 },
    timer: { notes: [784, 988, 1175], strikes: 2 }
  };
  const profile = profiles[type];
  const startAt = audioContext.currentTime + 0.04;

  profile.notes.forEach((frequency, noteIndex) => {
    for (let strike = 0; strike < profile.strikes; strike += 1) {
      const when = startAt + strike * 0.48 + noteIndex * 0.025;
      const oscillator = audioContext.createOscillator();
      const overtone = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const overtoneGain = audioContext.createGain();
      oscillator.type = 'sine';
      overtone.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, when);
      overtone.frequency.setValueAtTime(frequency * 2.01, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.16, when + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.25);
      overtoneGain.gain.setValueAtTime(0.0001, when);
      overtoneGain.gain.exponentialRampToValueAtTime(0.035, when + 0.025);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.65);
      oscillator.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(audioContext.destination);
      overtoneGain.connect(audioContext.destination);
      oscillator.start(when);
      overtone.start(when);
      oscillator.stop(when + 1.3);
      overtone.stop(when + 0.7);
    }
  });

  audioStatus.elt.textContent = '鈴聲播放中';
}

function updateClock() {
  const now = new Date();
  dateDisplay.elt.textContent =
    `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日　${WEEKDAYS[now.getDay()]}`;
  clockDisplay.elt.textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  updateExamInformation(now);
}

function updateExamInformation(now = new Date()) {
  const subject = fields.subject.value().trim();
  const startTime = fields.startTime.value();
  const endTime = fields.endTime.value();
  const teacher = fields.teacher.value().trim();
  const expected = parseCount(fields.expected.value());
  const present = parseCount(fields.present.value());
  const absent = expected === null || present === null ? '—' : Math.max(0, expected - present);
  const examTime = startTime && endTime ? `${startTime} – ${endTime}` : '尚未設定';

  infoValues.subject.elt.textContent = subject || '尚未設定';
  infoValues.examTime.elt.textContent = examTime;
  infoValues.teacher.elt.textContent = teacher || '尚未設定';
  infoValues.expected.elt.textContent = expected === null ? '—' : String(expected);
  infoValues.present.elt.textContent = present === null ? '—' : String(present);
  infoValues.absent.elt.textContent = String(absent);
  updateCountdown(now, endTime, startTime);
}

function updateCountdown(now, endTime, startTime) {
  countdownDisplay.removeClass('is-warning');
  if (!endTime) {
    countdownDisplay.elt.textContent = '請設定考試結束時間';
    return;
  }
  const endMinutes = timeToMinutes(endTime);
  if (endMinutes === null) {
    countdownDisplay.elt.textContent = '請設定有效的結束時間';
    return;
  }

  const startMinutes = timeToMinutes(startTime);
  const end = new Date(now);
  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  if (startMinutes !== null && endMinutes < startMinutes) {
    end.setDate(end.getDate() + 1);
  }

  const remainingMs = end.getTime() - now.getTime();
  if (remainingMs < 0) {
    countdownDisplay.elt.textContent = '考試時間已結束';
    countdownDisplay.addClass('is-warning');
    return;
  }

  const remainingMinutes = Math.ceil(remainingMs / 60000);
  countdownDisplay.elt.textContent = `距離考試結束還有 ${remainingMinutes} 分鐘`;
  if (remainingMinutes <= 10) {
    countdownDisplay.addClass('is-warning');
  }
}

function toggleFullscreen() {
  fullscreen(!fullscreen());
}

function syncFullscreenState() {
  const isFullscreen = Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  document.body.classList.toggle('is-fullscreen', isFullscreen);
  if (fullscreenButton) {
    fullscreenButton.elt.textContent = isFullscreen ? '離開全螢幕' : '進入全螢幕';
  }
}

function parseCount(value) {
  if (value === '' || !/^\d+$/.test(value)) {
    return null;
  }
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : null;
}

function timeToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function saveToStorage(key, value, label) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`無法儲存${label}：`, error);
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}
