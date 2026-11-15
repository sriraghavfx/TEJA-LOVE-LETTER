/**
 * Romantic Scrapbook Interactive Engine
 * Handles: Audio synthesis & playback, Love Counter, 3D Envelope, 
 * Polaroid Lightbox, Canvas Confetti, and LocalStorage Customization.
 */

(function () {
  'use strict';

  // --- Global State & Configuration ---
  const STORAGE_KEY = 'romantic_scrapbook_state_v2';
  let appState = {};
  let currentTimelineFilter = 'all';
  let timelineLayoutMode = 'zigzag'; // 'zigzag', 'left', 'center', 'right'

  // Initialize application state
  function initAppState() {
    const defaultData = window.ROMANTIC_CONFIG || {};
    
    // Check localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        appState = { ...defaultData, ...parsed };
        // Upgrade legacy default date to August 20, 2024
        if (!appState.anniversaryDate || appState.anniversaryDate === '2023-08-15') {
          appState.anniversaryDate = defaultData.anniversaryDate || '2024-08-20';
        }
        let needsUpgradeSave = false;
        // Upgrade milestones to use real couple photos and ensure all 11 photos are loaded
        if (!appState.milestones || appState.milestones.length < (defaultData.milestones || []).length || (appState.milestones[0].image && appState.milestones[0].image.includes('unsplash.com'))) {
          appState.milestones = defaultData.milestones;
          needsUpgradeSave = true;
        }
        // Upgrade polaroids to use real couple photos and ensure all 11 photos are loaded
        if (!appState.polaroids || appState.polaroids.length < (defaultData.polaroids || []).length || (appState.polaroids[0].image && appState.polaroids[0].image.includes('unsplash.com'))) {
          appState.polaroids = defaultData.polaroids;
          needsUpgradeSave = true;
        }
        if (needsUpgradeSave) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); } catch(e) {}
        }
        // Initialize couple auth settings if missing
        if (!appState.auth) {
          appState.auth = defaultData.auth || { boyfriendPin: '1234', girlfriendPin: '0820' };
        }
        // Initialize girlfriend love notes if missing
        if (!appState.girlfriendNotes) {
          appState.girlfriendNotes = defaultData.girlfriendNotes || [];
        }
      } catch (e) {
        console.warn('Failed to parse saved state, using default config:', e);
        appState = JSON.parse(JSON.stringify(defaultData));
      }
    } else {
      appState = JSON.parse(JSON.stringify(defaultData));
    }

    if (!appState.auth) {
      appState.auth = defaultData.auth || { boyfriendPin: '1234', girlfriendPin: '0820' };
    }
    if (!appState.girlfriendNotes) {
      appState.girlfriendNotes = defaultData.girlfriendNotes || [];
    }

    // Load saved layout mode
    const savedLayout = localStorage.getItem('timeline_layout_mode');
    if (savedLayout) timelineLayoutMode = savedLayout;

    // Check URL parameters for easy sharing (e.g. ?gf=Emma&bf=Liam&date=2024-08-20)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gf')) appState.girlfriendName = decodeURIComponent(urlParams.get('gf'));
    if (urlParams.get('bf')) appState.boyfriendName = decodeURIComponent(urlParams.get('bf'));
    if (urlParams.get('date')) appState.anniversaryDate = decodeURIComponent(urlParams.get('date'));
    if (urlParams.get('admin') === 'true' || window.location.hash === '#admin') {
      window.location.href = 'admin.html';
      return;
    }
  }

  // --- REAL-TIME PORTAL & SCRAPBOOK SYNCHRONIZATION ---
  let syncChannel = null;
  try {
    syncChannel = new BroadcastChannel('romantic_scrapbook_sync');
    syncChannel.onmessage = function (event) {
      if (event.data && event.data.type === 'SYNC_STATE') {
        onRemoteStateUpdated(event.data.state);
      }
    };
  } catch (e) {
    console.log('BroadcastChannel fallback to storage event listener');
  }

  // Cross-frame window message listener (instant iframe sync)
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SYNC_STATE') {
      onRemoteStateUpdated(event.data.state);
    }
  });

  function broadcastState(source = 'main') {
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: 'SYNC_STATE', source: source, state: appState, timestamp: Date.now() });
      } catch (e) {}
    }
  }

  function onRemoteStateUpdated(newState) {
    if (newState) {
      appState = { ...appState, ...newState };
      refreshAllContent(newState);
      showSyncToast();
    }
  }

  function refreshAllContent(freshState = null) {
    if (freshState) {
      appState = { ...appState, ...freshState };
    } else {
      initAppState();
    }
    updateDisplays();
    updateCounter();
    renderTimeline(currentTimelineFilter);
    renderPolaroids();
    renderLoveLetter();
    renderSurprise();
    updateHeroFeaturedPhoto();
    if (appState.music && appState.music.url && elements.bgAudio && elements.bgAudio.src !== appState.music.url) {
      elements.bgAudio.src = appState.music.url;
      if (elements.songTitleDisplay) {
        elements.songTitleDisplay.textContent = appState.music.title || 'Our Romantic Melody';
      }
    }
    updateNotesCountBadge();
  }

  function updateHeroFeaturedPhoto() {
    const heroImg = document.getElementById('hero-photo-img');
    const heroCap = document.getElementById('hero-photo-caption');
    if (heroImg && appState.polaroids && appState.polaroids.length > 0) {
      heroImg.src = appState.polaroids[0].image;
      if (heroCap) {
        heroCap.textContent = appState.polaroids[0].caption || 'August 20 • Where forever began 💕';
      }
    }
  }

  function showSyncToast() {
    let toast = document.getElementById('sync-live-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sync-live-toast';
      toast.className = 'sync-live-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<span>✨</span> Scrapbook updated live with latest changes! 💕';
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  // Cross-tab storage & focus listeners
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        onRemoteStateUpdated(parsed);
      } catch (err) {}
    }
  });

  window.addEventListener('focus', function () {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (JSON.stringify(parsed) !== JSON.stringify(appState)) {
          onRemoteStateUpdated(parsed);
        }
      } catch (err) {}
    }
  });

  function saveAppState(broadcast = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      if (broadcast) {
        broadcastState('main');
      }
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // --- DOM Elements ---
  const elements = {
    // Canvas
    heartsCanvas: document.getElementById('hearts-canvas'),
    
    // Audio & Vinyl Player
    audioBanner: document.getElementById('audio-banner'),
    bannerPlayBtn: document.getElementById('banner-play-btn'),
    bannerDismissBtn: document.getElementById('banner-dismiss-btn'),
    musicWidget: document.getElementById('music-widget'),
    vinylDisc: document.getElementById('vinyl-disc'),
    musicPlayBtn: document.getElementById('music-play-btn'),
    playIcon: document.getElementById('play-icon'),
    musicModeBtn: document.getElementById('music-mode-btn'),
    musicModeIcon: document.getElementById('music-mode-icon'),
    volumeSlider: document.getElementById('volume-slider'),
    songTitleDisplay: document.getElementById('widget-song-title'),
    bgAudio: document.getElementById('bg-audio'),

    // Navigation & Personalization
    navCoupleNames: document.getElementById('nav-couple-names'),
    openCustomizeBtn: document.getElementById('open-customize-btn'),
    personalizeDialog: document.getElementById('personalize-dialog'),
    personalizeForm: document.getElementById('personalize-form'),
    cfgGfName: document.getElementById('cfg-gf-name'),
    cfgBfName: document.getElementById('cfg-bf-name'),
    cfgAnniversary: document.getElementById('cfg-anniversary'),
    cfgQuote: document.getElementById('cfg-quote'),
    cfgAudioUrl: document.getElementById('cfg-audio-url'),
    cfgAudioFile: document.getElementById('cfg-audio-file'),

    // Boyfriend Edit Controls & Studio Elements
    openBfEditorBtn: document.getElementById('open-bf-editor-btn'),
    floatBfEditorBtn: document.getElementById('float-bf-editor-btn'),
    toggleEditModeBtn: document.getElementById('toggle-edit-mode-btn'),
    modeToggleText: document.getElementById('mode-toggle-text'),
    bfEditorDialog: document.getElementById('boyfriend-editor-dialog'),
    bfCoupleForm: document.getElementById('bf-couple-form'),
    bfCfgBfName: document.getElementById('bf-cfg-bf-name'),
    bfCfgGfName: document.getElementById('bf-cfg-gf-name'),
    bfCfgAnniversary: document.getElementById('bf-cfg-anniversary'),
    bfCfgTime: document.getElementById('bf-cfg-time'),
    bfCfgSubtitle: document.getElementById('bf-cfg-subtitle'),
    bfCfgQuote: document.getElementById('bf-cfg-quote'),
    studioTimelineList: document.getElementById('studio-timeline-list'),
    studioAddMemoryBtn: document.getElementById('studio-add-memory-btn'),
    studioPolaroidList: document.getElementById('studio-polaroid-list'),
    studioAddPhotoBtn: document.getElementById('studio-add-photo-btn'),
    bfLetterForm: document.getElementById('bf-letter-form'),
    bfSurpriseForm: document.getElementById('bf-surprise-form'),
    studioCouponsList: document.getElementById('studio-coupons-list'),
    btnResetCoupons: document.getElementById('btn-reset-coupons'),
    bfMusicForm: document.getElementById('bf-music-form'),
    editSingleMemoryDialog: document.getElementById('edit-single-memory-dialog'),
    editSingleMemoryForm: document.getElementById('edit-single-memory-form'),
    btnDeleteMemory: document.getElementById('btn-delete-memory'),
    editSinglePhotoDialog: document.getElementById('edit-single-photo-dialog'),
    editSinglePhotoForm: document.getElementById('edit-single-photo-form'),
    btnDeletePhoto: document.getElementById('btn-delete-photo'),

    // Couple Authentication & Role Elements
    navUserBadge: document.getElementById('nav-user-badge'),
    userRoleIcon: document.getElementById('user-role-icon'),
    userRoleName: document.getElementById('user-role-name'),
    coupleSwitchUserBtn: document.getElementById('couple-switch-user-btn'),
    switchUserText: document.getElementById('switch-user-text'),
    gfOpenNoteBtn: document.getElementById('gf-open-note-btn'),
    princessWelcomeBanner: document.getElementById('princess-welcome-banner'),
    princessNoteActionBtn: document.getElementById('princess-note-action-btn'),
    floatingRoleWidget: document.getElementById('floating-role-widget'),
    floatGfNoteBtn: document.getElementById('float-gf-note-btn'),
    floatLoginBtn: document.getElementById('float-login-btn'),

    // Couple Login Modal Elements
    coupleLoginDialog: document.getElementById('couple-login-dialog'),
    coupleLoginForm: document.getElementById('couple-login-form'),
    profileCardBf: document.getElementById('profile-card-bf'),
    profileCardGf: document.getElementById('profile-card-gf'),
    loginActiveRole: document.getElementById('login-active-role'),
    loginPinInput: document.getElementById('login-pin-input'),
    loginPinLabel: document.getElementById('login-pin-label'),
    loginRoleIcon: document.getElementById('login-role-icon'),
    loginHintText: document.getElementById('login-hint-text'),
    loginErrorMsg: document.getElementById('login-error-msg'),
    btnTogglePinVisibility: document.getElementById('btn-toggle-pin-visibility'),
    btnLoginGuest: document.getElementById('btn-login-guest'),

    // Girlfriend Love Note Modal Elements
    gfLoveNoteDialog: document.getElementById('gf-love-note-dialog'),
    gfLoveNoteForm: document.getElementById('gf-love-note-form'),
    gfNoteMessage: document.getElementById('gf-note-message'),
    noteMoodChips: document.getElementById('note-mood-chips'),
    noteSelectedMood: document.getElementById('note-selected-mood'),
    noteSelectedSticker: document.getElementById('note-selected-sticker'),

    // Studio Her Love Notes & Security Panes
    studioGfNotesList: document.getElementById('studio-gf-notes-list'),
    studioNotesCount: document.getElementById('studio-notes-count'),
    btnRefreshNotes: document.getElementById('btn-refresh-notes'),
    bfSecurityForm: document.getElementById('bf-security-form'),
    secBfPin: document.getElementById('sec-bf-pin'),
    secGfPin: document.getElementById('sec-gf-pin'),
    btnResetPins: document.getElementById('btn-reset-pins'),

    // Hero Section
    heroGirlfriend: document.getElementById('hero-girlfriend'),
    heroBoyfriend: document.getElementById('hero-boyfriend'),
    heroSubtitle: document.getElementById('hero-subtitle'),
    heroQuote: document.getElementById('hero-quote'),
    heroQuoteAuthor: document.getElementById('hero-quote-author'),
    counterDays: document.getElementById('counter-days'),
    counterHours: document.getElementById('counter-hours'),
    counterMinutes: document.getElementById('counter-minutes'),
    counterSeconds: document.getElementById('counter-seconds'),
    liveTimeNow: document.getElementById('live-time-now'),
    sendKissBtn: document.getElementById('send-kiss-btn'),

    // Timeline Section
    timelineContainer: document.getElementById('timeline-container'),
    timelineFilters: document.querySelectorAll('.filter-pill'),
    openAddMemoryBtn: document.getElementById('open-add-memory-btn'),
    memoryDialog: document.getElementById('memory-dialog'),
    memoryForm: document.getElementById('memory-form'),

    // Polaroids Section
    polaroidsContainer: document.getElementById('polaroids-container'),
    openAddPhotoBtn: document.getElementById('open-add-photo-btn'),
    photoDialog: document.getElementById('photo-dialog'),
    photoForm: document.getElementById('photo-form'),
    polaroidZoomDialog: document.getElementById('polaroid-zoom-dialog'),
    zoomImg: document.getElementById('zoom-img'),
    zoomTitle: document.getElementById('zoom-title'),
    zoomCaption: document.getElementById('zoom-caption'),
    zoomDate: document.getElementById('zoom-date'),

    // Love Letter Section
    loveEnvelope: document.getElementById('love-envelope'),
    waxSeal: document.getElementById('wax-seal'),
    envelopeHint: document.getElementById('envelope-hint'),
    letterSalutation: document.getElementById('letter-salutation'),
    letterBody: document.getElementById('letter-body'),
    letterClosing: document.getElementById('letter-closing'),
    letterSignature: document.getElementById('letter-signature'),
    letterPs: document.getElementById('letter-ps'),
    openEditLetterBtn: document.getElementById('open-edit-letter-btn'),
    letterDialog: document.getElementById('letter-dialog'),
    letterForm: document.getElementById('letter-form'),

    // Surprise Section
    surpriseLocked: document.getElementById('surprise-locked'),
    surpriseRevealed: document.getElementById('surprise-revealed'),
    unlockSurpriseBtn: document.getElementById('unlock-surprise-btn'),
    relockSurpriseBtn: document.getElementById('relock-surprise-btn'),
    surpriseTitle: document.getElementById('surprise-title'),
    surpriseMessage: document.getElementById('surprise-message'),
    couponsContainer: document.getElementById('coupons-container'),

    // Footer
    footerGirlfriend: document.getElementById('footer-girlfriend'),
    footerExportBtn: document.getElementById('footer-export-btn'),
    footerTopBtn: document.getElementById('footer-top-btn')
  };

  // --- AUDIO & MUSIC PLAYER ENGINE ---
  let isPlaying = false;
  let audioMode = 'audio'; // 'audio' or 'synth'
  let audioCtx = null;
  let synthInterval = null;

  function initAudio() {
    if (appState.music && appState.music.url) {
      elements.bgAudio.src = appState.music.url;
    }
    elements.bgAudio.volume = parseFloat(elements.volumeSlider.value);
    
    // Set song title
    if (appState.music && appState.music.title) {
      elements.songTitleDisplay.textContent = appState.music.title;
    }

    elements.bgAudio.addEventListener('error', function () {
      console.warn('Audio stream failed or blocked. Auto-switching to soothing synthesized music box.');
      setAudioMode('synth');
    });

    elements.volumeSlider.addEventListener('input', function (e) {
      const vol = parseFloat(e.target.value);
      elements.bgAudio.volume = vol;
    });

    // Handle music toggle button
    elements.musicPlayBtn.addEventListener('click', togglePlayAudio);
    elements.bannerPlayBtn.addEventListener('click', function () {
      togglePlayAudio();
      elements.audioBanner.classList.add('hidden');
    });
    elements.bannerDismissBtn.addEventListener('click', function () {
      elements.audioBanner.classList.add('hidden');
    });

    elements.musicModeBtn.addEventListener('click', function () {
      const nextMode = audioMode === 'audio' ? 'synth' : 'audio';
      setAudioMode(nextMode);
    });
  }

  function setAudioMode(mode) {
    audioMode = mode;
    if (mode === 'synth') {
      elements.musicModeIcon.textContent = '🎵';
      elements.songTitleDisplay.textContent = 'Lullaby Music Box 🎶';
      elements.bgAudio.pause();
      if (isPlaying) startSynthMusicBox();
    } else {
      elements.musicModeIcon.textContent = '🎹';
      elements.songTitleDisplay.textContent = (appState.music && appState.music.title) || 'Our Romantic Melody';
      stopSynthMusicBox();
      if (isPlaying) {
        elements.bgAudio.play().catch(() => setAudioMode('synth'));
      }
    }
  }

  function togglePlayAudio() {
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }

  function playAudio() {
    isPlaying = true;
    elements.playIcon.textContent = '❚❚';
    elements.vinylDisc.classList.add('spinning');
    elements.audioBanner.classList.add('hidden');

    if (audioMode === 'synth') {
      startSynthMusicBox();
    } else {
      const promise = elements.bgAudio.play();
      if (promise !== undefined) {
        promise.catch(function (error) {
          console.warn('Audio play restricted or failed, falling back to Web Audio synth:', error);
          setAudioMode('synth');
        });
      }
    }
  }

  function pauseAudio() {
    isPlaying = false;
    elements.playIcon.textContent = '▶';
    elements.vinylDisc.classList.remove('spinning');
    elements.bgAudio.pause();
    stopSynthMusicBox();
  }

  // Romantic Web Audio Synthesizer (Music Box Chimes)
  // Generates a soft, nostalgic music-box chord arpeggio completely in the browser with 0 dependencies!
  function startSynthMusicBox() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    stopSynthMusicBox();

    // Romantic music box notes (C major / A minor progression in Pentatonic frequencies)
    const melody = [
      523.25, 659.25, 783.99, 1046.50, // C5, E5, G5, C6
      587.33, 698.46, 880.00, 1174.66, // D5, F5, A5, D6
      440.00, 523.25, 659.25, 880.00,  // A4, C5, E5, A5
      392.00, 493.88, 587.33, 783.99   // G4, B4, D5, G5
    ];

    let noteIndex = 0;
    synthInterval = setInterval(function () {
      if (!isPlaying || audioMode !== 'synth') return;
      playMusicBoxPluck(melody[noteIndex % melody.length]);
      noteIndex++;
    }, 420);
  }

  function stopSynthMusicBox() {
    if (synthInterval) {
      clearInterval(synthInterval);
      synthInterval = null;
    }
  }

  function playMusicBoxPluck(freq) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    const masterVol = parseFloat(elements.volumeSlider.value) * 0.18;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(masterVol, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.25);
  }

  // --- RELATIONSHIP COUNTER ENGINE (August 20 to Live Time) ---
  function updateCounter() {
    const annivStr = appState.anniversaryDate || '2024-08-20';
    const annivTimeStr = appState.anniversaryTime || '00:00:00';
    const annivDate = new Date(`${annivStr}T${annivTimeStr}`);
    const now = new Date();

    const diff = Math.max(0, now - annivDate);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    elements.counterDays.textContent = days.toLocaleString();
    elements.counterHours.textContent = String(hours).padStart(2, '0');
    elements.counterMinutes.textContent = String(minutes).padStart(2, '0');
    elements.counterSeconds.textContent = String(seconds).padStart(2, '0');

    // Display current live time
    if (elements.liveTimeNow) {
      const liveTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const liveDateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      elements.liveTimeNow.textContent = `Live Time: ${liveDateStr} • ${liveTimeStr}`;
    }
  }

  // --- FLOATING HEARTS & PARTICLES CANVAS ---
  let canvasCtx = null;
  let heartsParticles = [];
  let burstParticles = [];

  function initCanvas() {
    const canvas = elements.heartsCanvas;
    if (!canvas) return;
    canvasCtx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Populate ambient floating hearts
    for (let i = 0; i < 22; i++) {
      heartsParticles.push(createAmbientHeart(true));
    }

    // Animate loop
    requestAnimationFrame(renderCanvasParticles);

    // Click anywhere creates mini heart burst
    window.addEventListener('click', function (e) {
      // Don't trigger on modal backdrop clicks or inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      spawnHeartBurst(e.clientX, e.clientY, 8);
    });
  }

  function createAmbientHeart(randomY = false) {
    const canvas = elements.heartsCanvas;
    return {
      x: Math.random() * canvas.width,
      y: randomY ? Math.random() * canvas.height : canvas.height + 20,
      size: Math.random() * 14 + 10,
      speedY: Math.random() * 0.8 + 0.4,
      speedX: Math.sin(Math.random() * Math.PI) * 0.4,
      opacity: Math.random() * 0.4 + 0.2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 1.5,
      color: ['#f8a5b8', '#ff7597', '#ffcad4', '#fce4ec', '#f48fb1'][Math.floor(Math.random() * 5)]
    };
  }

  function spawnHeartBurst(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5);
      const speed = Math.random() * 4 + 2;
      burstParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: Math.random() * 14 + 10,
        opacity: 1,
        life: 1,
        decay: Math.random() * 0.02 + 0.015,
        rotation: Math.random() * 360,
        color: ['#ff4071', '#ff7597', '#ffd54f', '#f06292', '#e91e63'][Math.floor(Math.random() * 5)]
      });
    }
  }

  function drawHeart(ctx, x, y, size, color, opacity, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    ctx.beginPath();
    const d = size;
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-d / 2, -d / 2, -d, d / 3, 0, d);
    ctx.bezierCurveTo(d, d / 3, d / 2, -d / 2, 0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function renderCanvasParticles() {
    if (!canvasCtx) return;
    const canvas = elements.heartsCanvas;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Ambient Floating Hearts
    for (let i = 0; i < heartsParticles.length; i++) {
      const p = heartsParticles[i];
      p.y -= p.speedY;
      p.x += Math.sin(p.y * 0.02) * 0.6;
      p.rotation += p.rotationSpeed;

      drawHeart(canvasCtx, p.x, p.y, p.size, p.color, p.opacity, p.rotation);

      if (p.y < -30) {
        heartsParticles[i] = createAmbientHeart(false);
      }
    }

    // Render Interactive Bursts
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const b = burstParticles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.08; // gravity
      b.opacity -= b.decay;

      if (b.opacity <= 0) {
        burstParticles.splice(i, 1);
      } else {
        drawHeart(canvasCtx, b.x, b.y, b.size, b.color, b.opacity, b.rotation);
      }
    }

    requestAnimationFrame(renderCanvasParticles);
  }

  // --- CELEBRATION KISS SHOWER ---
  function triggerKissCelebration() {
    const count = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    spawnHeartBurst(centerX, centerY, count);

    // Play sweet chime
    if (audioCtx && audioCtx.state !== 'suspended') {
      [659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
        setTimeout(() => playMusicBoxPluck(f), i * 120);
      });
    }

    // Floating kiss notification
    const toast = document.createElement('div');
    toast.className = 'kiss-toast';
    toast.innerHTML = '💋 Mwah! A million kisses sent to ' + (appState.girlfriendName || 'My Love') + '! 💖';
    toast.style.position = 'fixed';
    toast.style.bottom = '90px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'linear-gradient(135deg, #ff4071, #ff7597)';
    toast.style.color = '#fff';
    toast.style.padding = '12px 28px';
    toast.style.borderRadius = '30px';
    toast.style.boxShadow = '0 10px 25px rgba(255, 64, 113, 0.4)';
    toast.style.fontWeight = '700';
    toast.style.fontFamily = 'var(--font-round)';
    toast.style.zIndex = '9999';
    toast.style.animation = 'stampImpact 0.4s ease';

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 2800);
  }

  // --- TIMELINE RENDERING & ALIGNMENT ENGINE ---
  function renderTimeline(filterCategory = 'all') {
    currentTimelineFilter = filterCategory;
    elements.timelineContainer.innerHTML = '';
    const milestones = appState.milestones || [];

    const filtered = filterCategory === 'all' 
      ? milestones 
      : milestones.filter(m => m.category === filterCategory);

    if (filtered.length === 0) {
      elements.timelineContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; font-family: var(--font-notes); font-size: 1.4rem; color: var(--text-muted);">
          No memories in this category yet. Click below to add one! 🌸
        </div>
      `;
      return;
    }

    filtered.forEach((item, index) => {
      // Determine effective alignment for this card
      let effectiveAlign = 'left';
      if (timelineLayoutMode === 'left') {
        effectiveAlign = 'left';
      } else if (timelineLayoutMode === 'right') {
        effectiveAlign = 'right';
      } else if (timelineLayoutMode === 'center') {
        effectiveAlign = 'center';
      } else {
        // Zig-zag layout mode: use specific item alignment or alternate
        if (item.alignment && ['left', 'center', 'right'].includes(item.alignment)) {
          effectiveAlign = item.alignment;
        } else {
          effectiveAlign = index % 2 === 0 ? 'left' : 'right';
        }
      }

      const itemEl = document.createElement('div');
      itemEl.className = `timeline-item ${effectiveAlign}`;
      itemEl.setAttribute('data-id', item.id);

      itemEl.innerHTML = `
        <div class="timeline-peg"></div>
        <div class="timeline-card">
          <span class="timeline-date-badge">${item.date}</span>
          <h3 class="timeline-title">${item.title}</h3>
          <p class="timeline-story">${item.description}</p>
          ${item.image ? `
            <div class="timeline-mini-polaroid">
              <img src="${item.image}" alt="${item.caption || item.title}" class="mini-polaroid-img" loading="lazy">
              <div class="mini-polaroid-caption">${item.caption || ''}</div>
            </div>
          ` : ''}

          <!-- Individual Photo Alignment Toolbar on Card -->
          <div class="card-align-bar">
            <span class="align-bar-label">📍 Align:</span>
            <button class="btn-card-align ${effectiveAlign === 'left' ? 'active' : ''}" data-align="left" title="Pin Photo Left">Left ⬅️</button>
            <button class="btn-card-align ${effectiveAlign === 'center' ? 'active' : ''}" data-align="center" title="Center Photo Card">Center 🎯</button>
            <button class="btn-card-align ${effectiveAlign === 'right' ? 'active' : ''}" data-align="right" title="Pin Photo Right">Right ➡️</button>
            <button class="btn-card-edit" data-id="${item.id}" title="Edit this memory">✏️ Edit</button>
            <button class="btn-card-delete btn-mini-del" data-id="${item.id}" title="Delete memory">🗑️</button>
          </div>
        </div>
      `;

      // Interactive alignment button click handler on this card
      const alignBtns = itemEl.querySelectorAll('.btn-card-align');
      alignBtns.forEach(btn => {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const targetAlign = this.getAttribute('data-align');
          item.alignment = targetAlign;
          itemEl.className = `timeline-item ${targetAlign}`;

          // Update active buttons on this card
          alignBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');

          saveAppState();

          // Mini celebratory heart burst
          const rect = this.getBoundingClientRect();
          spawnHeartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 8);
        });
      });

      // Edit memory button on card
      const cardEditBtn = itemEl.querySelector('.btn-card-edit');
      if (cardEditBtn) {
        cardEditBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openEditMemoryModal(item.id);
        });
      }

      // Delete memory button on card
      const cardDelBtn = itemEl.querySelector('.btn-card-delete');
      if (cardDelBtn) {
        cardDelBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteMemory(item.id);
        });
      }

      elements.timelineContainer.appendChild(itemEl);
    });
  }

  function initTimeline() {
    renderTimeline('all');

    // Category filter pills
    elements.timelineFilters.forEach(pill => {
      pill.addEventListener('click', function () {
        elements.timelineFilters.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        const filter = this.getAttribute('data-filter');
        renderTimeline(filter);
      });
    });

    // Global Layout Toolbar (Zigzag, Left, Center, Right)
    const layoutBtns = document.querySelectorAll('#timeline-layout-btns .layout-pill');
    layoutBtns.forEach(btn => {
      if (btn.getAttribute('data-layout') === timelineLayoutMode) {
        layoutBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }

      btn.addEventListener('click', function () {
        layoutBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        timelineLayoutMode = this.getAttribute('data-layout');
        localStorage.setItem('timeline_layout_mode', timelineLayoutMode);
        renderTimeline(currentTimelineFilter);

        const rect = this.getBoundingClientRect();
        spawnHeartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 14);
      });
    });

    // Add Memory Dialog
    elements.openAddMemoryBtn.addEventListener('click', () => {
      elements.memoryDialog.showModal();
    });

    elements.memoryForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const title = document.getElementById('mem-title').value.trim();
      const date = document.getElementById('mem-date').value.trim();
      const category = document.getElementById('mem-category').value;
      const alignment = (document.getElementById('mem-alignment') && document.getElementById('mem-alignment').value) || 'center';
      const badge = document.getElementById('mem-badge').value.trim();
      const desc = document.getElementById('mem-desc').value.trim();
      const caption = document.getElementById('mem-caption').value.trim();
      const photoFile = document.getElementById('mem-photo-file').files[0];
      const photoUrl = document.getElementById('mem-photo-url').value.trim();

      const newMilestone = {
        id: 'm-' + Date.now(),
        date: date,
        category: category,
        alignment: alignment,
        title: title,
        badge: badge || 'Special Moment',
        description: desc,
        caption: caption,
        image: photoUrl || 'images/photo_selfie_outdoor.jpg'
      };

      if (photoFile) {
        const reader = new FileReader();
        reader.onload = function (event) {
          newMilestone.image = event.target.result;
          addMilestoneToState(newMilestone);
        };
        reader.readAsDataURL(photoFile);
      } else {
        addMilestoneToState(newMilestone);
      }
    });
  }

  function addMilestoneToState(milestone) {
    if (!appState.milestones) appState.milestones = [];
    appState.milestones.push(milestone);
    saveAppState();
    renderTimeline(currentTimelineFilter);
    elements.memoryDialog.close();
    elements.memoryForm.reset();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
  }

  // --- POLAROID GALLERY ENGINE ---
  function renderPolaroids() {
    elements.polaroidsContainer.innerHTML = '';
    const polaroids = appState.polaroids || [];

    polaroids.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'polaroid-item';
      const rot = item.rotation !== undefined ? item.rotation : (index % 2 === 0 ? -3 : 3);
      card.style.transform = `rotate(${rot}deg)`;

      const tapeClass = item.tapeColor || 'tape-pink';

      card.innerHTML = `
        <div class="polaroid-tape washi-tape ${tapeClass}"></div>
        <div class="polaroid-photo-wrap">
          <img src="${item.image}" alt="${item.title}" class="polaroid-photo" loading="lazy">
        </div>
        <div class="polaroid-caption-box">
          <h4 class="polaroid-title">${item.title}</h4>
          <p class="polaroid-caption-text">${item.caption}</p>
          <div class="polaroid-footer-row">
            <span class="polaroid-date-tag">${item.date || ''}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="polaroid-edit-btn" data-id="${item.id}" title="Edit this polaroid">✏️ Edit</button>
              <button class="polaroid-like-btn" data-id="${item.id}" aria-label="Like memory">
                <span>❤️</span>
                <span class="like-num">${item.likes || 0}</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Polaroid edit button handler
      const photoEditBtn = card.querySelector('.polaroid-edit-btn');
      if (photoEditBtn) {
        photoEditBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openEditPhotoModal(item.id);
        });
      }

      // Zoom click handler (except when clicking like or edit button)
      card.addEventListener('click', function (e) {
        if (e.target.closest('.polaroid-like-btn') || e.target.closest('.polaroid-edit-btn')) return;
        openPolaroidZoom(item);
      });

      // Like button handler
      const likeBtn = card.querySelector('.polaroid-like-btn');
      likeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        item.likes = (item.likes || 0) + 1;
        card.querySelector('.like-num').textContent = item.likes;
        saveAppState();

        const rect = likeBtn.getBoundingClientRect();
        spawnHeartBurst(rect.left + 15, rect.top + 10, 6);
      });

      elements.polaroidsContainer.appendChild(card);
    });
  }

  function openPolaroidZoom(item) {
    elements.zoomImg.src = item.image;
    elements.zoomTitle.textContent = item.title;
    elements.zoomCaption.textContent = item.caption;
    elements.zoomDate.textContent = item.date || '';
    elements.polaroidZoomDialog.showModal();
  }

  function initPolaroidGallery() {
    renderPolaroids();

    elements.openAddPhotoBtn.addEventListener('click', () => {
      elements.photoDialog.showModal();
    });

    elements.photoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const title = document.getElementById('photo-title').value.trim();
      const date = document.getElementById('photo-date').value.trim();
      const caption = document.getElementById('photo-caption').value.trim();
      const file = document.getElementById('photo-file').files[0];
      const url = document.getElementById('photo-url').value.trim();

      const newPolaroid = {
        id: 'p-' + Date.now(),
        title: title,
        date: date,
        caption: caption,
        rotation: (Math.random() * 6 - 3).toFixed(1),
        tapeColor: ['tape-pink', 'tape-cream', 'tape-mint', 'tape-gold', 'tape-lavender'][Math.floor(Math.random() * 5)],
        likes: 1,
        image: url || 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=800&q=80'
      };

      if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
          newPolaroid.image = event.target.result;
          addPolaroidToState(newPolaroid);
        };
        reader.readAsDataURL(file);
      } else {
        addPolaroidToState(newPolaroid);
      }
    });
  }

  function addPolaroidToState(polaroid) {
    if (!appState.polaroids) appState.polaroids = [];
    appState.polaroids.unshift(polaroid);
    saveAppState();
    renderPolaroids();
    elements.photoDialog.close();
    elements.photoForm.reset();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
  }

  // --- 3D LOVE LETTER & ENVELOPE ---
  function renderLoveLetter() {
    const letter = appState.letter || {};
    elements.letterSalutation.textContent = letter.salutation || 'To My Beautiful Girl,';
    elements.letterClosing.textContent = letter.closing || 'Forever and always yours,';
    elements.letterSignature.textContent = (appState.boyfriendName || 'Yours Always') + ' ❤️';
    elements.letterPs.textContent = letter.postscript || 'P.S. You will always be my favorite.';

    // Populate paragraphs
    elements.letterBody.innerHTML = '';
    const paragraphs = letter.paragraphs || [
      "Every single page of my life became magical the day you walked into it.",
      "You are my greatest love, my safe haven, and my favorite adventure."
    ];
    paragraphs.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      elements.letterBody.appendChild(p);
    });
  }

  function initLoveLetter() {
    renderLoveLetter();

    // Wax seal click event
    elements.waxSeal.addEventListener('click', toggleEnvelope);
    elements.waxSeal.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleEnvelope();
      }
    });

    elements.openEditLetterBtn.addEventListener('click', () => {
      const letter = appState.letter || {};
      document.getElementById('cfg-letter-salutation').value = letter.salutation || '';
      document.getElementById('cfg-letter-text').value = (letter.paragraphs || []).join('\n\n');
      document.getElementById('cfg-letter-closing').value = letter.closing || '';
      document.getElementById('cfg-letter-signature').value = letter.signature || '';
      document.getElementById('cfg-letter-ps').value = letter.postscript || '';
      elements.letterDialog.showModal();
    });

    elements.letterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const rawText = document.getElementById('cfg-letter-text').value;
      const paragraphs = rawText.split('\n\n').map(s => s.trim()).filter(Boolean);

      appState.letter = {
        salutation: document.getElementById('cfg-letter-salutation').value.trim(),
        paragraphs: paragraphs,
        closing: document.getElementById('cfg-letter-closing').value.trim(),
        signature: document.getElementById('cfg-letter-signature').value.trim(),
        postscript: document.getElementById('cfg-letter-ps').value.trim()
      };

      saveAppState();
      renderLoveLetter();
      elements.letterDialog.close();
      spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 16);
    });
  }

  function toggleEnvelope() {
    const isOpening = !elements.loveEnvelope.classList.contains('open');
    elements.loveEnvelope.classList.toggle('open');

    if (isOpening) {
      elements.envelopeHint.textContent = '💖 Read with an open heart...';
      const rect = elements.waxSeal.getBoundingClientRect();
      spawnHeartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 25);
      
      // Auto-start music if not playing yet
      if (!isPlaying) {
        playAudio();
      }
    } else {
      elements.envelopeHint.textContent = '👆 Tap the red wax seal to open!';
    }
  }

  // --- SURPRISE PAGE & LOVE COUPONS ---
  function renderSurprise() {
    const surprise = appState.surprise || {};
    elements.surpriseTitle.textContent = surprise.revealTitle || 'A Secret From My Heart 💌';
    elements.surpriseMessage.textContent = surprise.hiddenMessage || 'You are my today, my tomorrow, and my forever...';

    elements.couponsContainer.innerHTML = '';
    const coupons = surprise.coupons || [];

    coupons.forEach(coupon => {
      const card = document.createElement('div');
      card.className = `coupon-card ${coupon.redeemed ? 'redeemed' : ''}`;
      
      card.innerHTML = `
        <div>
          <div class="coupon-icon">${coupon.icon || '🎟️'}</div>
          <h5 class="coupon-title">${coupon.title}</h5>
          <p class="coupon-desc">${coupon.desc}</p>
        </div>
        <button class="btn-redeem" data-id="${coupon.id}">
          ${coupon.redeemed ? '✓ Redeemed' : 'Claim With Love ❤️'}
        </button>
        ${coupon.redeemed ? '<div class="coupon-stamp">REDEEMED WITH LOVE ❤️</div>' : ''}
      `;

      const redeemBtn = card.querySelector('.btn-redeem');
      redeemBtn.addEventListener('click', function () {
        if (coupon.redeemed) return;
        coupon.redeemed = true;
        saveAppState();
        renderSurprise();

        // Celebration burst
        const rect = card.getBoundingClientRect();
        spawnHeartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 20);

        if (audioCtx) {
          playMusicBoxPluck(1046.50);
          setTimeout(() => playMusicBoxPluck(1318.51), 150);
        }
      });

      elements.couponsContainer.appendChild(card);
    });
  }

  function initSurprise() {
    renderSurprise();

    elements.unlockSurpriseBtn.addEventListener('click', function () {
      elements.surpriseLocked.style.display = 'none';
      elements.surpriseRevealed.classList.remove('hidden');

      // Massive heart burst celebration
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          spawnHeartBurst(
            window.innerWidth * (0.25 + i * 0.18),
            window.innerHeight * 0.45,
            24
          );
        }, i * 200);
      }
    });

    elements.relockSurpriseBtn.addEventListener('click', function () {
      elements.surpriseRevealed.classList.add('hidden');
      elements.surpriseLocked.style.display = 'block';
    });
  }

  // --- PERSONALIZATION & SETTINGS MODAL ---
  function updateDisplays() {
    const gf = appState.girlfriendName || 'My Dearest';
    const bf = appState.boyfriendName || 'Yours Always';

    // Update names everywhere
    document.querySelectorAll('.girlfriend-display').forEach(el => el.textContent = gf);
    document.querySelectorAll('.boyfriend-display').forEach(el => el.textContent = bf);
    elements.navCoupleNames.textContent = `${gf} & ${bf}`;
    elements.heroSubtitle.textContent = appState.welcomeSubtitle || '"Every day with you is my favourite page in the story of us."';
    elements.heroQuote.textContent = appState.quote || '"In all the world, there is no heart for me like yours."';
    elements.heroQuoteAuthor.textContent = '— ' + (appState.quoteAuthor || 'Always Yours');

    // Update user role badge text
    if (elements.userRoleName) {
      if (activeRole === 'boyfriend') {
        elements.userRoleName.textContent = `${bf} (Editor)`;
      } else if (activeRole === 'girlfriend') {
        elements.userRoleName.textContent = `${gf} (Princess 💕)`;
      }
    }
  }

  function initPersonalization() {
    updateDisplays();

    elements.openCustomizeBtn.addEventListener('click', () => {
      elements.cfgGfName.value = appState.girlfriendName || '';
      elements.cfgBfName.value = appState.boyfriendName || '';
      elements.cfgAnniversary.value = appState.anniversaryDate || '2023-08-15';
      elements.cfgQuote.value = appState.quote || '';
      elements.cfgAudioUrl.value = (appState.music && appState.music.url) || '';
      elements.personalizeDialog.showModal();
    });

    elements.personalizeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      appState.girlfriendName = elements.cfgGfName.value.trim();
      appState.boyfriendName = elements.cfgBfName.value.trim();
      appState.anniversaryDate = elements.cfgAnniversary.value;
      appState.quote = elements.cfgQuote.value.trim();

      const audioUrl = elements.cfgAudioUrl.value.trim();
      const audioFile = elements.cfgAudioFile.files[0];

      if (audioFile) {
        const reader = new FileReader();
        reader.onload = function (event) {
          if (!appState.music) appState.music = {};
          appState.music.url = event.target.result;
          appState.music.title = audioFile.name.replace(/\.[^/.]+$/, "");
          saveAndRefreshSettings();
        };
        reader.readAsDataURL(audioFile);
      } else {
        if (audioUrl) {
          if (!appState.music) appState.music = {};
          appState.music.url = audioUrl;
        }
        saveAndRefreshSettings();
      }
    });

    // Close buttons on all dialogs
    document.querySelectorAll('[data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', function () {
        const dialog = this.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    // Send Kiss Button
    elements.sendKissBtn.addEventListener('click', triggerKissCelebration);

    // Export & Share Button
    elements.footerExportBtn.addEventListener('click', function () {
      const shareUrl = `${window.location.origin}${window.location.pathname}?gf=${encodeURIComponent(appState.girlfriendName || '')}&bf=${encodeURIComponent(appState.boyfriendName || '')}&date=${encodeURIComponent(appState.anniversaryDate || '')}`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('💖 Personalized share link copied to clipboard!\n\nYou can send this link to your girlfriend so she sees everything with her name customized: \n' + shareUrl);
      }).catch(() => {
        prompt('Copy your customized scrapbook link:', shareUrl);
      });
    });

    // Back to top button
    elements.footerTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function saveAndRefreshSettings() {
    saveAppState();
    updateDisplays();
    updateCounter();
    renderLoveLetter();
    if (appState.music && appState.music.url) {
      elements.bgAudio.src = appState.music.url;
      elements.songTitleDisplay.textContent = appState.music.title || 'Our Romantic Melody';
    }
    elements.personalizeDialog.close();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 25);
  }

  // --- COUPLE AUTHENTICATION & SEPARATE PROFILES ENGINE ---
  let activeRole = localStorage.getItem('couple_active_role') || 'boyfriend';

  // Check URL parameters for direct role access (e.g. ?role=girlfriend, ?girlfriend=true, #girlfriend)
  const currentParams = new URLSearchParams(window.location.search);
  const paramRole = currentParams.get('role') || currentParams.get('login') || currentParams.get('mode');
  if (paramRole === 'girlfriend' || currentParams.get('girlfriend') === 'true' || window.location.hash === '#girlfriend') {
    activeRole = 'girlfriend';
    localStorage.setItem('couple_active_role', 'girlfriend');
  } else if (paramRole === 'boyfriend' || currentParams.get('boyfriend') === 'true' || window.location.hash === '#boyfriend') {
    activeRole = 'boyfriend';
    localStorage.setItem('couple_active_role', 'boyfriend');
  }

  function setCoupleRole(role, notify = false) {
    activeRole = role;
    localStorage.setItem('couple_active_role', role);

    const gf = appState.girlfriendName || 'My Dearest';
    const bf = appState.boyfriendName || 'Yours Always';

    // Reset base classes
    document.body.classList.remove('role-boyfriend', 'role-girlfriend', 'role-guest', 'girlfriend-mode');

    if (role === 'boyfriend') {
      document.body.classList.add('role-boyfriend');
      if (!isEditMode) document.body.classList.add('girlfriend-mode');

      if (elements.navUserBadge) elements.navUserBadge.className = 'nav-user-badge badge-bf';
      if (elements.userRoleIcon) elements.userRoleIcon.textContent = '👑';
      if (elements.userRoleName) elements.userRoleName.textContent = `${bf} (Editor)`;
      if (elements.switchUserText) elements.switchUserText.textContent = 'Switch';

      if (elements.openBfEditorBtn) elements.openBfEditorBtn.style.display = 'inline-flex';
      if (elements.toggleEditModeBtn) elements.toggleEditModeBtn.style.display = 'inline-flex';
      if (elements.gfOpenNoteBtn) elements.gfOpenNoteBtn.style.display = 'none';
      if (elements.princessWelcomeBanner) elements.princessWelcomeBanner.style.display = 'none';

      if (elements.floatBfEditorBtn) elements.floatBfEditorBtn.style.display = 'flex';
      if (elements.floatGfNoteBtn) elements.floatGfNoteBtn.style.display = 'none';
      if (elements.floatLoginBtn) elements.floatLoginBtn.style.display = 'none';

    } else if (role === 'girlfriend') {
      document.body.classList.add('role-girlfriend', 'girlfriend-mode');

      if (elements.navUserBadge) elements.navUserBadge.className = 'nav-user-badge badge-gf';
      if (elements.userRoleIcon) elements.userRoleIcon.textContent = '👸';
      if (elements.userRoleName) elements.userRoleName.textContent = `${gf} (Princess 💕)`;
      if (elements.switchUserText) elements.switchUserText.textContent = 'Switch';

      if (elements.openBfEditorBtn) elements.openBfEditorBtn.style.display = 'none';
      if (elements.toggleEditModeBtn) elements.toggleEditModeBtn.style.display = 'none';
      if (elements.gfOpenNoteBtn) elements.gfOpenNoteBtn.style.display = 'inline-flex';
      if (elements.princessWelcomeBanner) elements.princessWelcomeBanner.style.display = 'block';

      if (elements.floatBfEditorBtn) elements.floatBfEditorBtn.style.display = 'none';
      if (elements.floatGfNoteBtn) elements.floatGfNoteBtn.style.display = 'flex';
      if (elements.floatLoginBtn) elements.floatLoginBtn.style.display = 'none';

    } else { // guest
      document.body.classList.add('role-guest', 'girlfriend-mode');

      if (elements.navUserBadge) elements.navUserBadge.className = 'nav-user-badge badge-guest';
      if (elements.userRoleIcon) elements.userRoleIcon.textContent = '🕊️';
      if (elements.userRoleName) elements.userRoleName.textContent = 'Guest Preview';
      if (elements.switchUserText) elements.switchUserText.textContent = 'Login';

      if (elements.openBfEditorBtn) elements.openBfEditorBtn.style.display = 'none';
      if (elements.toggleEditModeBtn) elements.toggleEditModeBtn.style.display = 'none';
      if (elements.gfOpenNoteBtn) elements.gfOpenNoteBtn.style.display = 'none';
      if (elements.princessWelcomeBanner) elements.princessWelcomeBanner.style.display = 'none';

      if (elements.floatBfEditorBtn) elements.floatBfEditorBtn.style.display = 'none';
      if (elements.floatGfNoteBtn) elements.floatGfNoteBtn.style.display = 'none';
      if (elements.floatLoginBtn) elements.floatLoginBtn.style.display = 'flex';
    }

    if (notify) {
      spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 25);
    }
  }

  function openLoginModal(preferredRole) {
    if (!elements.coupleLoginDialog) return;

    // Pick role to select in the modal
    const targetRole = preferredRole || (activeRole === 'girlfriend' ? 'boyfriend' : 'girlfriend');
    selectLoginProfile(targetRole);

    if (elements.loginPinInput) {
      elements.loginPinInput.value = '';
      elements.loginPinInput.type = 'password';
    }
    if (elements.btnTogglePinVisibility) elements.btnTogglePinVisibility.textContent = '👁️';
    if (elements.loginErrorMsg) elements.loginErrorMsg.style.display = 'none';

    elements.coupleLoginDialog.showModal();
    if (elements.loginPinInput) elements.loginPinInput.focus();
  }

  function selectLoginProfile(role) {
    if (elements.loginActiveRole) elements.loginActiveRole.value = role;

    if (elements.profileCardBf) {
      elements.profileCardBf.classList.toggle('active', role === 'boyfriend');
    }
    if (elements.profileCardGf) {
      elements.profileCardGf.classList.toggle('active', role === 'girlfriend');
    }

    const gf = appState.girlfriendName || 'My Dearest';
    const bf = appState.boyfriendName || 'Yours Always';

    if (role === 'boyfriend') {
      if (elements.loginPinLabel) elements.loginPinLabel.innerHTML = `<span id="login-role-icon">👑</span> Enter ${bf}'s PIN:`;
      if (elements.loginHintText) elements.loginHintText.innerHTML = `💡 Default PIN: <strong>${(appState.auth && appState.auth.boyfriendPin) || '1234'}</strong>`;
    } else {
      if (elements.loginPinLabel) elements.loginPinLabel.innerHTML = `<span id="login-role-icon">👸</span> Enter Princess ${gf}'s PIN:`;
      if (elements.loginHintText) elements.loginHintText.innerHTML = `💡 Hint: Our anniversary date (<strong>${(appState.auth && appState.auth.girlfriendPin) || '0820'}</strong>)`;
    }
    if (elements.loginErrorMsg) elements.loginErrorMsg.style.display = 'none';
  }

  function initCoupleAuth() {
    setCoupleRole(activeRole);

    // Profile card selection in login modal
    if (elements.profileCardBf) {
      elements.profileCardBf.addEventListener('click', () => selectLoginProfile('boyfriend'));
    }
    if (elements.profileCardGf) {
      elements.profileCardGf.addEventListener('click', () => selectLoginProfile('girlfriend'));
    }

    // Toggle PIN visibility
    if (elements.btnTogglePinVisibility && elements.loginPinInput) {
      elements.btnTogglePinVisibility.addEventListener('click', function () {
        const isPwd = elements.loginPinInput.type === 'password';
        elements.loginPinInput.type = isPwd ? 'text' : 'password';
        this.textContent = isPwd ? '🔒' : '👁️';
      });
    }

    // Login Form Submit
    if (elements.coupleLoginForm) {
      elements.coupleLoginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const role = elements.loginActiveRole.value || 'boyfriend';
        const enteredPin = elements.loginPinInput.value.trim();
        const auth = appState.auth || { boyfriendPin: '1234', girlfriendPin: '0820' };
        const correctPin = role === 'boyfriend' ? (auth.boyfriendPin || '1234') : (auth.girlfriendPin || '0820');

        if (enteredPin === correctPin) {
          elements.coupleLoginDialog.close();
          setCoupleRole(role, true);
          if (role === 'girlfriend') {
            alert(`🌸 Welcome home, Princess ${appState.girlfriendName || 'My Love'}! ❤️\nEnjoy exploring our memories from August 20 until today.`);
          } else {
            alert(`👑 Welcome back, ${appState.boyfriendName || 'Boyfriend'}!\nBoyfriend Studio and full editing powers are active.`);
          }
        } else {
          if (elements.loginErrorMsg) {
            elements.loginErrorMsg.textContent = `❌ Incorrect PIN! Please check the hint or try again.`;
            elements.loginErrorMsg.style.display = 'block';
          }
          elements.loginPinInput.focus();
          elements.loginPinInput.select();
        }
      });
    }

    // Guest / Preview button
    if (elements.btnLoginGuest) {
      elements.btnLoginGuest.addEventListener('click', function () {
        elements.coupleLoginDialog.close();
        setCoupleRole('guest', false);
      });
    }

    // Switch Account click handlers
    if (elements.coupleSwitchUserBtn) {
      elements.coupleSwitchUserBtn.addEventListener('click', () => openLoginModal());
    }
    if (elements.navUserBadge) {
      elements.navUserBadge.addEventListener('click', () => openLoginModal());
    }
    if (elements.floatLoginBtn) {
      elements.floatLoginBtn.addEventListener('click', () => openLoginModal());
    }

    // Security Form in Boyfriend Studio
    if (elements.bfSecurityForm) {
      elements.bfSecurityForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const bfPin = elements.secBfPin.value.trim();
        const gfPin = elements.secGfPin.value.trim();
        if (!bfPin || !gfPin) {
          alert('Please enter valid passcodes for both profiles.');
          return;
        }
        if (!appState.auth) appState.auth = {};
        appState.auth.boyfriendPin = bfPin;
        appState.auth.girlfriendPin = gfPin;
        saveAppState();
        alert('🔐 Couple PINs successfully updated!\nBoyfriend PIN: ' + bfPin + '\nGirlfriend PIN: ' + gfPin);
        spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
      });
    }

    if (elements.btnResetPins) {
      elements.btnResetPins.addEventListener('click', function () {
        if (!appState.auth) appState.auth = {};
        appState.auth.boyfriendPin = '1234';
        appState.auth.girlfriendPin = '0820';
        if (elements.secBfPin) elements.secBfPin.value = '1234';
        if (elements.secGfPin) elements.secGfPin.value = '0820';
        saveAppState();
        alert('🔄 Passcodes reset to default:\nBoyfriend PIN: 1234\nGirlfriend PIN: 0820 (August 20)');
      });
    }
  }

  // --- GIRLFRIEND LOVE NOTES ENGINE ---
  function initGirlfriendNotes() {
    // Open note modal from buttons
    const openNoteBtns = [elements.gfOpenNoteBtn, elements.floatGfNoteBtn, elements.princessNoteActionBtn];
    openNoteBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (elements.gfNoteMessage) elements.gfNoteMessage.value = '';
          if (elements.gfLoveNoteDialog) elements.gfLoveNoteDialog.showModal();
        });
      }
    });

    // Mood chips selector
    if (elements.noteMoodChips) {
      const chips = elements.noteMoodChips.querySelectorAll('.mood-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', function () {
          chips.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          if (elements.noteSelectedMood) elements.noteSelectedMood.value = this.getAttribute('data-mood');
          if (elements.noteSelectedSticker) elements.noteSelectedSticker.value = this.getAttribute('data-sticker');
        });
      });
    }

    // Submit Love Note
    if (elements.gfLoveNoteForm) {
      elements.gfLoveNoteForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const msg = elements.gfNoteMessage.value.trim();
        if (!msg) return;

        const mood = (elements.noteSelectedMood && elements.noteSelectedMood.value) || '🥰 Feeling In Love';
        const sticker = (elements.noteSelectedSticker && elements.noteSelectedSticker.value) || '💖';

        const now = new Date();
        const newNote = {
          id: 'note-' + Date.now(),
          date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sticker: sticker,
          mood: mood,
          message: msg
        };

        if (!appState.girlfriendNotes) appState.girlfriendNotes = [];
        appState.girlfriendNotes.unshift(newNote);
        saveAppState();

        if (elements.gfLoveNoteDialog) elements.gfLoveNoteDialog.close();
        spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 30);
        alert(`💌 Your love note was delivered straight to ${appState.boyfriendName || 'him'}! ❤️\nHe can read it anytime in his Boyfriend Studio.`);
        updateNotesCountBadge();
      });
    }

    if (elements.btnRefreshNotes) {
      elements.btnRefreshNotes.addEventListener('click', renderStudioGirlfriendNotes);
    }
  }

  function updateNotesCountBadge() {
    const count = (appState.girlfriendNotes || []).length;
    if (elements.studioNotesCount) {
      elements.studioNotesCount.textContent = count;
    }
  }

  function renderStudioGirlfriendNotes() {
    if (!elements.studioGfNotesList) return;
    elements.studioGfNotesList.innerHTML = '';
    const notes = appState.girlfriendNotes || [];
    updateNotesCountBadge();

    if (notes.length === 0) {
      elements.studioGfNotesList.innerHTML = `
        <div class="empty-notes-hint">
          💌 No love notes from your girlfriend yet.<br>
          When she logs into Girlfriend Mode and writes a note, it will appear right here!
        </div>
      `;
      return;
    }

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'studio-note-card';
      card.innerHTML = `
        <div class="studio-note-header">
          <span class="studio-note-mood">${note.sticker || '💖'} ${note.mood || 'Sweet Note'}</span>
          <span class="studio-note-time">${note.date} at ${note.time}</span>
        </div>
        <div class="studio-note-message">${note.message}</div>
        <div class="studio-note-actions">
          <button type="button" class="btn-del-note" data-id="${note.id}" title="Remove note">🗑️ Delete</button>
        </div>
      `;

      card.querySelector('.btn-del-note').addEventListener('click', function () {
        if (confirm('Delete this love note?')) {
          appState.girlfriendNotes = (appState.girlfriendNotes || []).filter(n => n.id !== note.id);
          saveAppState();
          renderStudioGirlfriendNotes();
        }
      });

      elements.studioGfNotesList.appendChild(card);
    });
  }

  // --- BOYFRIEND EDIT STUDIO & MANAGEMENT ENGINE ---
  let isEditMode = localStorage.getItem('bf_edit_mode') !== 'false';

  function setEditMode(active) {
    if (activeRole !== 'boyfriend') {
      active = false;
    }
    isEditMode = active;
    localStorage.setItem('bf_edit_mode', active);
    if (active) {
      document.body.classList.remove('girlfriend-mode');
      if (elements.modeToggleText) elements.modeToggleText.textContent = '✏️ Edit Mode: ON';
    } else {
      document.body.classList.add('girlfriend-mode');
      if (elements.modeToggleText) elements.modeToggleText.textContent = '👁️ Preview Mode';
    }
  }

  function initBoyfriendEditor() {
    setEditMode(isEditMode);

    if (elements.toggleEditModeBtn) {
      elements.toggleEditModeBtn.addEventListener('click', function () {
        setEditMode(!isEditMode);
        spawnHeartBurst(window.innerWidth / 2, 80, 10);
      });
    }

    // Open Boyfriend Studio from navbar button or floating widget
    if (elements.openBfEditorBtn) {
      elements.openBfEditorBtn.addEventListener('click', openBoyfriendStudio);
    }
    if (elements.floatBfEditorBtn) {
      elements.floatBfEditorBtn.addEventListener('click', openBoyfriendStudio);
    }

    // Tab switching in Boyfriend Studio
    const tabBtns = document.querySelectorAll('#studio-tab-bar .studio-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        tabBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const targetTab = this.getAttribute('data-tab');
        document.querySelectorAll('.studio-tab-pane').forEach(pane => {
          pane.classList.remove('active');
          if (pane.id === targetTab) pane.classList.add('active');
        });
      });
    });

    // 1. Couple Details Form submit
    if (elements.bfCoupleForm) {
      elements.bfCoupleForm.addEventListener('submit', function (e) {
        e.preventDefault();
        appState.boyfriendName = elements.bfCfgBfName.value.trim();
        appState.girlfriendName = elements.bfCfgGfName.value.trim();
        appState.anniversaryDate = elements.bfCfgAnniversary.value;
        appState.anniversaryTime = elements.bfCfgTime.value || '00:00:00';
        appState.welcomeSubtitle = elements.bfCfgSubtitle.value.trim();
        appState.quote = elements.bfCfgQuote.value.trim();
        saveAppState();
        updateDisplays();
        updateCounter();
        elements.bfEditorDialog.close();
        spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 25);
      });
    }

    // 2. Timeline Add in Studio
    if (elements.studioAddMemoryBtn) {
      elements.studioAddMemoryBtn.addEventListener('click', () => {
        elements.bfEditorDialog.close();
        elements.memoryDialog.showModal();
      });
    }

    // 3. Polaroids Add in Studio
    if (elements.studioAddPhotoBtn) {
      elements.studioAddPhotoBtn.addEventListener('click', () => {
        elements.bfEditorDialog.close();
        elements.photoDialog.showModal();
      });
    }

    // 4. Letter Form submit in Studio
    if (elements.bfLetterForm) {
      elements.bfLetterForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const rawText = document.getElementById('bf-letter-text').value;
        const paragraphs = rawText.split('\n\n').map(s => s.trim()).filter(Boolean);
        appState.letter = {
          salutation: document.getElementById('bf-letter-salutation').value.trim(),
          paragraphs: paragraphs,
          closing: document.getElementById('bf-letter-closing').value.trim(),
          signature: document.getElementById('bf-letter-signature').value.trim(),
          postscript: document.getElementById('bf-letter-ps').value.trim()
        };
        saveAppState();
        renderLoveLetter();
        elements.bfEditorDialog.close();
        spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
      });
    }

    // 5. Surprise Form submit in Studio
    if (elements.bfSurpriseForm) {
      elements.bfSurpriseForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!appState.surprise) appState.surprise = {};
        appState.surprise.revealTitle = document.getElementById('bf-surprise-title').value.trim();
        appState.surprise.hiddenMessage = document.getElementById('bf-surprise-message').value.trim();
        saveAppState();
        renderSurprise();
        elements.bfEditorDialog.close();
        spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
      });
    }

    // Reset Coupons Button
    if (elements.btnResetCoupons) {
      elements.btnResetCoupons.addEventListener('click', function () {
        if (appState.surprise && appState.surprise.coupons) {
          appState.surprise.coupons.forEach(c => c.redeemed = false);
          saveAppState();
          renderSurprise();
          renderStudioCoupons();
          alert('🎟️ All love coupons are now un-redeemed so your girlfriend can enjoy claiming them again! ❤️');
        }
      });
    }

    // 6. Music Form submit in Studio
    if (elements.bfMusicForm) {
      elements.bfMusicForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const songTitle = document.getElementById('bf-music-title').value.trim();
        const songUrl = document.getElementById('bf-music-url').value.trim();
        const songFile = document.getElementById('bf-music-file').files[0];

        if (!appState.music) appState.music = {};
        if (songTitle) appState.music.title = songTitle;

        if (songFile) {
          const reader = new FileReader();
          reader.onload = function (event) {
            appState.music.url = event.target.result;
            appState.music.title = songTitle || songFile.name.replace(/\.[^/.]+$/, "");
            saveAndRefreshSettings();
            elements.bfEditorDialog.close();
          };
          reader.readAsDataURL(songFile);
        } else {
          if (songUrl) appState.music.url = songUrl;
          saveAndRefreshSettings();
          elements.bfEditorDialog.close();
        }
      });
    }

    // --- Single Memory Edit Modal Form ---
    if (elements.editSingleMemoryForm) {
      elements.editSingleMemoryForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const memId = document.getElementById('edit-mem-id').value;
        const milestone = (appState.milestones || []).find(m => m.id === memId);
        if (!milestone) return;

        milestone.title = document.getElementById('edit-mem-title').value.trim();
        milestone.date = document.getElementById('edit-mem-date').value.trim();
        milestone.category = document.getElementById('edit-mem-category').value;
        milestone.alignment = document.getElementById('edit-mem-alignment').value;
        milestone.badge = document.getElementById('edit-mem-badge').value.trim();
        milestone.description = document.getElementById('edit-mem-desc').value.trim();
        milestone.caption = document.getElementById('edit-mem-caption').value.trim();

        const file = document.getElementById('edit-mem-file').files[0];
        const url = document.getElementById('edit-mem-url').value.trim();

        if (file) {
          const reader = new FileReader();
          reader.onload = function (event) {
            milestone.image = event.target.result;
            finishSavingMemoryEdit();
          };
          reader.readAsDataURL(file);
        } else {
          if (url) milestone.image = url;
          finishSavingMemoryEdit();
        }
      });
    }

    if (elements.btnDeleteMemory) {
      elements.btnDeleteMemory.addEventListener('click', function () {
        const memId = document.getElementById('edit-mem-id').value;
        if (confirm('Are you sure you want to delete this memory from your timeline?')) {
          deleteMemory(memId);
          elements.editSingleMemoryDialog.close();
        }
      });
    }

    // --- Single Photo Edit Modal Form ---
    if (elements.editSinglePhotoForm) {
      elements.editSinglePhotoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const photoId = document.getElementById('edit-photo-id').value;
        const polaroid = (appState.polaroids || []).find(p => p.id === photoId);
        if (!polaroid) return;

        polaroid.title = document.getElementById('edit-photo-title').value.trim();
        polaroid.date = document.getElementById('edit-photo-date').value.trim();
        polaroid.caption = document.getElementById('edit-photo-caption').value.trim();
        polaroid.tapeColor = document.getElementById('edit-photo-tape').value;
        polaroid.rotation = parseFloat(document.getElementById('edit-photo-rotation').value) || 0;

        const file = document.getElementById('edit-photo-file').files[0];
        const url = document.getElementById('edit-photo-url').value.trim();

        if (file) {
          const reader = new FileReader();
          reader.onload = function (event) {
            polaroid.image = event.target.result;
            finishSavingPhotoEdit();
          };
          reader.readAsDataURL(file);
        } else {
          if (url) polaroid.image = url;
          finishSavingPhotoEdit();
        }
      });
    }

    if (elements.btnDeletePhoto) {
      elements.btnDeletePhoto.addEventListener('click', function () {
        const photoId = document.getElementById('edit-photo-id').value;
        if (confirm('Are you sure you want to delete this photo from your polaroid board?')) {
          deletePhoto(photoId);
          elements.editSinglePhotoDialog.close();
        }
      });
    }
  }

  function finishSavingMemoryEdit() {
    saveAppState();
    renderTimeline(currentTimelineFilter);
    if (elements.bfEditorDialog && elements.bfEditorDialog.open) renderStudioTimeline();
    elements.editSingleMemoryDialog.close();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 15);
  }

  function finishSavingPhotoEdit() {
    saveAppState();
    renderPolaroids();
    if (elements.bfEditorDialog && elements.bfEditorDialog.open) renderStudioPolaroids();
    elements.editSinglePhotoDialog.close();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 15);
  }

  function openBoyfriendStudio() {
    // Fill Couple info
    if (elements.bfCfgBfName) elements.bfCfgBfName.value = appState.boyfriendName || '';
    if (elements.bfCfgGfName) elements.bfCfgGfName.value = appState.girlfriendName || '';
    if (elements.bfCfgAnniversary) elements.bfCfgAnniversary.value = appState.anniversaryDate || '2024-08-20';
    if (elements.bfCfgTime) elements.bfCfgTime.value = (appState.anniversaryTime && appState.anniversaryTime.slice(0, 5)) || '00:00';
    if (elements.bfCfgSubtitle) elements.bfCfgSubtitle.value = appState.welcomeSubtitle || '';
    if (elements.bfCfgQuote) elements.bfCfgQuote.value = appState.quote || '';

    // Render Studio Lists
    renderStudioTimeline();
    renderStudioPolaroids();
    renderStudioCoupons();
    renderStudioGirlfriendNotes();

    // Fill Letter form
    const letter = appState.letter || {};
    const sal = document.getElementById('bf-letter-salutation');
    const txt = document.getElementById('bf-letter-text');
    const cls = document.getElementById('bf-letter-closing');
    const sig = document.getElementById('bf-letter-signature');
    const ps = document.getElementById('bf-letter-ps');
    if (sal) sal.value = letter.salutation || '';
    if (txt) txt.value = (letter.paragraphs || []).join('\n\n');
    if (cls) cls.value = letter.closing || '';
    if (sig) sig.value = letter.signature || (appState.boyfriendName + ' ❤️');
    if (ps) ps.value = letter.postscript || '';

    // Fill Surprise form
    const surprise = appState.surprise || {};
    const surTitle = document.getElementById('bf-surprise-title');
    const surMsg = document.getElementById('bf-surprise-message');
    if (surTitle) surTitle.value = surprise.revealTitle || '';
    if (surMsg) surMsg.value = surprise.hiddenMessage || '';

    // Fill Music form
    const mus = appState.music || {};
    const musTitle = document.getElementById('bf-music-title');
    const musUrl = document.getElementById('bf-music-url');
    if (musTitle) musTitle.value = mus.title || '';
    if (musUrl) musUrl.value = mus.url || '';

    // Fill Security Passcodes
    if (elements.secBfPin) elements.secBfPin.value = (appState.auth && appState.auth.boyfriendPin) || '1234';
    if (elements.secGfPin) elements.secGfPin.value = (appState.auth && appState.auth.girlfriendPin) || '0820';

    elements.bfEditorDialog.showModal();
  }

  function renderStudioTimeline() {
    if (!elements.studioTimelineList) return;
    elements.studioTimelineList.innerHTML = '';
    const milestones = appState.milestones || [];
    milestones.forEach(m => {
      const row = document.createElement('div');
      row.className = 'studio-mem-row';
      row.innerHTML = `
        <img src="${m.image}" alt="${m.title}" class="studio-mem-thumb">
        <div class="studio-mem-info">
          <div class="studio-mem-title">${m.title}</div>
          <div class="studio-mem-date">${m.date} • Align: <strong>${m.alignment || 'auto'}</strong></div>
        </div>
        <div class="studio-mem-actions">
          <button type="button" class="btn-mini-edit" data-id="${m.id}">✏️ Edit</button>
          <button type="button" class="btn-mini-del" data-id="${m.id}">🗑️</button>
        </div>
      `;
      row.querySelector('.btn-mini-edit').addEventListener('click', () => openEditMemoryModal(m.id));
      row.querySelector('.btn-mini-del').addEventListener('click', () => deleteMemory(m.id));
      elements.studioTimelineList.appendChild(row);
    });
  }

  function renderStudioPolaroids() {
    if (!elements.studioPolaroidList) return;
    elements.studioPolaroidList.innerHTML = '';
    const polaroids = appState.polaroids || [];
    polaroids.forEach(p => {
      const card = document.createElement('div');
      card.className = 'studio-polaroid-card';
      card.innerHTML = `
        <img src="${p.image}" alt="${p.title}" class="studio-polaroid-thumb">
        <div class="studio-polaroid-caption">${p.caption}</div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;">
          <button type="button" class="btn-mini-edit" data-id="${p.id}">✏️ Edit</button>
          <button type="button" class="btn-mini-del" data-id="${p.id}">🗑️</button>
        </div>
      `;
      card.querySelector('.btn-mini-edit').addEventListener('click', () => openEditPhotoModal(p.id));
      card.querySelector('.btn-mini-del').addEventListener('click', () => deletePhoto(p.id));
      elements.studioPolaroidList.appendChild(card);
    });
  }

  function renderStudioCoupons() {
    if (!elements.studioCouponsList) return;
    elements.studioCouponsList.innerHTML = '';
    const coupons = (appState.surprise && appState.surprise.coupons) || [];
    coupons.forEach(c => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '6px 10px';
      item.style.background = '#fff';
      item.style.border = '1px solid #ffd4e0';
      item.style.borderRadius = '8px';
      item.style.marginBottom = '6px';
      item.innerHTML = `
        <span>${c.icon || '🎟️'} <strong>${c.title}</strong></span>
        <span style="font-size: 0.8rem; font-weight: 700; color: ${c.redeemed ? '#d32f2f' : '#2e7d32'};">
          ${c.redeemed ? '✓ Redeemed' : 'Ready to use'}
        </span>
      `;
      elements.studioCouponsList.appendChild(item);
    });
  }

  function openEditMemoryModal(id) {
    const milestone = (appState.milestones || []).find(m => m.id === id);
    if (!milestone) return;

    document.getElementById('edit-mem-id').value = milestone.id;
    document.getElementById('edit-mem-title').value = milestone.title || '';
    document.getElementById('edit-mem-date').value = milestone.date || '';
    document.getElementById('edit-mem-category').value = milestone.category || 'milestone';
    document.getElementById('edit-mem-alignment').value = milestone.alignment || 'center';
    document.getElementById('edit-mem-badge').value = milestone.badge || '';
    document.getElementById('edit-mem-desc').value = milestone.description || '';
    document.getElementById('edit-mem-caption').value = milestone.caption || '';
    document.getElementById('edit-mem-url').value = milestone.image || '';

    elements.editSingleMemoryDialog.showModal();
  }

  function deleteMemory(id) {
    if (!confirm('Are you sure you want to remove this milestone from the timeline?')) return;
    appState.milestones = (appState.milestones || []).filter(m => m.id !== id);
    saveAppState();
    renderTimeline(currentTimelineFilter);
    if (elements.bfEditorDialog && elements.bfEditorDialog.open) renderStudioTimeline();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 12);
  }

  function openEditPhotoModal(id) {
    const polaroid = (appState.polaroids || []).find(p => p.id === id);
    if (!polaroid) return;

    document.getElementById('edit-photo-id').value = polaroid.id;
    document.getElementById('edit-photo-title').value = polaroid.title || '';
    document.getElementById('edit-photo-date').value = polaroid.date || '';
    document.getElementById('edit-photo-caption').value = polaroid.caption || '';
    document.getElementById('edit-photo-tape').value = polaroid.tapeColor || 'tape-pink';
    document.getElementById('edit-photo-rotation').value = polaroid.rotation || 0;
    document.getElementById('edit-photo-url').value = polaroid.image || '';

    elements.editSinglePhotoDialog.showModal();
  }

  function deletePhoto(id) {
    if (!confirm('Are you sure you want to remove this polaroid from the corkboard?')) return;
    appState.polaroids = (appState.polaroids || []).filter(p => p.id !== id);
    saveAppState();
    renderPolaroids();
    if (elements.bfEditorDialog && elements.bfEditorDialog.open) renderStudioPolaroids();
    spawnHeartBurst(window.innerWidth / 2, window.innerHeight / 2, 12);
  }

  // --- INIT ALL MODULES ---
  function init() {
    initAppState();
    initCanvas();
    initAudio();
    initPersonalization();
    initBoyfriendEditor();
    initCoupleAuth();
    initGirlfriendNotes();
    initTimeline();
    initPolaroidGallery();
    initLoveLetter();
    initSurprise();

    // Start counter loop
    updateCounter();
    setInterval(updateCounter, 1000);
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
