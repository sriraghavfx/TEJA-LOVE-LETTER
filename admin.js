/**
 * Boyfriend Admin Panel Engine
 * Manages Photos, Wordings, Timeline Stories, Love Letter & Security
 * Syncs seamlessly with romantic_scrapbook_state_v2
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'romantic_scrapbook_state_v2';
  let adminState = {};

  // --- Load State ---
  function loadAdminState() {
    const defaultData = window.ROMANTIC_CONFIG || {};
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        adminState = { ...defaultData, ...JSON.parse(saved) };
      } catch (e) {
        adminState = JSON.parse(JSON.stringify(defaultData));
      }
    } else {
      adminState = JSON.parse(JSON.stringify(defaultData));
    }

    if (!adminState.auth) {
      adminState.auth = defaultData.auth || { boyfriendPin: '1234', girlfriendPin: '0820' };
    }
    if (!adminState.girlfriendNotes) {
      adminState.girlfriendNotes = defaultData.girlfriendNotes || [];
    }
    let needsAdminSave = false;
    if (!adminState.milestones || adminState.milestones.length < (defaultData.milestones || []).length || (adminState.milestones[0].image && adminState.milestones[0].image.includes('unsplash.com'))) {
      adminState.milestones = defaultData.milestones;
      needsAdminSave = true;
    }
    if (!adminState.polaroids || adminState.polaroids.length < (defaultData.polaroids || []).length || (adminState.polaroids[0].image && adminState.polaroids[0].image.includes('unsplash.com'))) {
      adminState.polaroids = defaultData.polaroids;
      needsAdminSave = true;
    }
    if (needsAdminSave) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(adminState)); } catch(e) {}
    }
  }

  // --- Real-time synchronization channel with Main Scrapbook ---
  let syncChannel = null;
  try {
    syncChannel = new BroadcastChannel('romantic_scrapbook_sync');
    syncChannel.onmessage = function (event) {
      if (event.data && event.data.type === 'SYNC_STATE' && event.data.source === 'main') {
        loadAdminState();
        updateStats();
      }
    };
  } catch (e) {
    console.log('BroadcastChannel fallback');
  }

  function broadcastAdminState() {
    if (syncChannel) {
      try {
        syncChannel.postMessage({ type: 'SYNC_STATE', source: 'admin', state: adminState, timestamp: Date.now() });
      } catch (e) {}
    }
  }

  function saveAdminState(showToast = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(adminState));
      broadcastAdminState();
      reloadLivePreview();
      if (showToast) {
        showAdminSuccessToast('💾 Changes saved! Main scrapbook updated immediately.');
      }
    } catch (e) {
      alert('Error saving data: ' + e.message);
    }
  }

  function reloadLivePreview(forceReload = false) {
    const iframe = document.getElementById('scrapbook-live-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'SYNC_STATE', source: 'admin', state: adminState }, '*');
        if (forceReload) {
          iframe.contentWindow.location.reload();
        }
      } catch (e) {
        if (forceReload) {
          try { iframe.src = iframe.src; } catch (err) {}
        }
      }
    }
  }

  function showAdminSuccessToast(msg) {
    let toast = document.getElementById('admin-success-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-success-toast';
      toast.style.cssText = 'position:fixed; bottom:24px; right:28px; background:linear-gradient(135deg, #2b8a3e, #40c057); color:#fff; padding:12px 24px; border-radius:30px; font-weight:800; font-size:0.92rem; box-shadow:0 6px 20px rgba(43,138,62,0.35); z-index:99999; display:flex; align-items:center; gap:8px; transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform:translateY(80px); opacity:0;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.transform = 'translateY(80px)';
      toast.style.opacity = '0';
    }, 2800);
  }

  // --- Navigation Tabs ---
  function initTabs() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', function () {
        const tabId = this.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    window.switchTab = function (tabId) {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });
      document.querySelectorAll('.admin-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabId);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  // --- Populate Overview Stats ---
  function updateStats() {
    const bf = adminState.boyfriendName || 'Boyfriend';
    document.getElementById('sidebar-bf-name').textContent = `${bf} (Editor)`;

    const photosCount = (adminState.polaroids || []).length;
    const memCount = (adminState.milestones || []).length;
    const notesCount = (adminState.girlfriendNotes || []).length;

    document.getElementById('count-photos').textContent = photosCount;
    document.getElementById('count-milestones').textContent = memCount;
    document.getElementById('count-notes').textContent = notesCount;

    document.getElementById('stat-photos').textContent = photosCount;
    document.getElementById('stat-memories').textContent = memCount;
    document.getElementById('stat-notes').textContent = notesCount;

    document.getElementById('photos-total-badge').textContent = photosCount;
    document.getElementById('milestones-total-badge').textContent = memCount;

    // Days counter from August 20, 2024
    const startStr = `${adminState.anniversaryDate || '2024-08-20'}T${adminState.anniversaryTime || '00:00:00'}`;
    const startDate = new Date(startStr);
    const now = new Date();
    const diff = Math.max(0, now - startDate);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById('stat-days').textContent = days;
  }

  // --- Tab 2: Wordings & Identity ---
  function initWordingsTab() {
    const form = document.getElementById('form-wordings');
    const bfInput = document.getElementById('admin-bf-name');
    const gfInput = document.getElementById('admin-gf-name');
    const annInput = document.getElementById('admin-anniversary');
    const timeInput = document.getElementById('admin-anniversary-time');
    const subInput = document.getElementById('admin-subtitle');
    const quoteInput = document.getElementById('admin-quote');
    const authorInput = document.getElementById('admin-quote-author');

    bfInput.value = adminState.boyfriendName || '';
    gfInput.value = adminState.girlfriendName || '';
    annInput.value = adminState.anniversaryDate || '2024-08-20';
    timeInput.value = (adminState.anniversaryTime && adminState.anniversaryTime.slice(0, 5)) || '00:00';
    subInput.value = adminState.welcomeSubtitle || '';
    quoteInput.value = adminState.quote || '';
    authorInput.value = adminState.quoteAuthor || '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      adminState.boyfriendName = bfInput.value.trim();
      adminState.girlfriendName = gfInput.value.trim();
      adminState.anniversaryDate = annInput.value;
      adminState.anniversaryTime = timeInput.value ? timeInput.value + ':00' : '00:00:00';
      adminState.welcomeSubtitle = subInput.value.trim();
      adminState.quote = quoteInput.value.trim();
      adminState.quoteAuthor = authorInput.value.trim();

      saveAdminState();
      updateStats();
    });
  }

  // --- Tab 3: Photos Gallery Manager ---
  function renderPhotosGrid() {
    const grid = document.getElementById('admin-photos-grid');
    grid.innerHTML = '';
    const photos = adminState.polaroids || [];

    photos.forEach(photo => {
      const card = document.createElement('div');
      card.className = 'admin-photo-card';
      card.innerHTML = `
        <div class="admin-photo-thumb-wrap">
          <img src="${photo.image}" alt="${photo.title}" class="admin-photo-thumb">
          <span class="admin-photo-tape-badge">${photo.tapeColor ? photo.tapeColor.replace('tape-', '') : 'pink'}</span>
        </div>
        <div class="admin-photo-details">
          <div class="admin-photo-caption">"${photo.caption}"</div>
          <div class="admin-photo-meta"><strong>${photo.title}</strong> • ${photo.date || 'Romantic Date'} • Tilt: ${photo.rotation || 0}°</div>
        </div>
        <div class="admin-photo-actions">
          <button type="button" class="btn-card-action btn-card-edit" data-id="${photo.id}">✏️ Edit Details</button>
          <button type="button" class="btn-card-action btn-card-delete" data-id="${photo.id}">🗑️ Delete</button>
        </div>
      `;

      card.querySelector('.btn-card-edit').addEventListener('click', () => openPhotoModal(photo.id));
      card.querySelector('.btn-card-delete').addEventListener('click', () => deletePhoto(photo.id));

      grid.appendChild(card);
    });
  }

  function openPhotoModal(id) {
    const modal = document.getElementById('modal-edit-photo');
    const photo = (adminState.polaroids || []).find(p => p.id === id);
    if (!photo) return;

    document.getElementById('modal-photo-id').value = photo.id;
    document.getElementById('modal-photo-preview').src = photo.image;
    document.getElementById('modal-photo-title').value = photo.title || '';
    document.getElementById('modal-photo-date').value = photo.date || '';
    document.getElementById('modal-photo-caption').value = photo.caption || '';
    document.getElementById('modal-photo-tape').value = photo.tapeColor || 'tape-pink';
    document.getElementById('modal-photo-rotation').value = photo.rotation || 0;
    document.getElementById('modal-photo-url').value = photo.image || '';
    document.getElementById('modal-photo-file').value = '';

    modal.showModal();
  }

  function deletePhoto(id) {
    if (!confirm('Are you sure you want to delete this photo from the polaroid gallery?')) return;
    adminState.polaroids = (adminState.polaroids || []).filter(p => p.id !== id);
    saveAdminState(false);
    renderPhotosGrid();
    updateStats();
  }

  function initPhotosManager() {
    renderPhotosGrid();

    // Modal submit
    const form = document.getElementById('form-modal-photo');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const id = document.getElementById('modal-photo-id').value;
      const photo = (adminState.polaroids || []).find(p => p.id === id);
      if (!photo) return;

      photo.title = document.getElementById('modal-photo-title').value.trim();
      photo.date = document.getElementById('modal-photo-date').value.trim();
      photo.caption = document.getElementById('modal-photo-caption').value.trim();
      photo.tapeColor = document.getElementById('modal-photo-tape').value;
      photo.rotation = parseFloat(document.getElementById('modal-photo-rotation').value) || 0;

      const file = document.getElementById('modal-photo-file').files[0];
      const url = document.getElementById('modal-photo-url').value.trim();

      if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          photo.image = ev.target.result;
          document.getElementById('modal-edit-photo').close();
          saveAdminState(false);
          renderPhotosGrid();
          updateStats();
        };
        reader.readAsDataURL(file);
      } else {
        if (url) photo.image = url;
        document.getElementById('modal-edit-photo').close();
        saveAdminState(false);
        renderPhotosGrid();
        updateStats();
      }
    });

    // Add New Photo Button
    document.getElementById('btn-admin-add-photo').addEventListener('click', function () {
      const newId = 'p-' + Date.now();
      const newPhoto = {
        id: newId,
        title: 'New Romantic Moment',
        date: 'Today',
        caption: 'You and me forever 💕',
        tapeColor: 'tape-pink',
        rotation: (Math.random() * 4 - 2).toFixed(1),
        image: 'images/photo_selfie_outdoor.jpg',
        likes: 0
      };
      adminState.polaroids = adminState.polaroids || [];
      adminState.polaroids.unshift(newPhoto);
      saveAdminState(false);
      renderPhotosGrid();
      updateStats();
      openPhotoModal(newId);
    });

    // Delete in modal
    document.getElementById('btn-modal-delete-photo').addEventListener('click', function () {
      const id = document.getElementById('modal-photo-id').value;
      deletePhoto(id);
      document.getElementById('modal-edit-photo').close();
    });
  }

  // --- TAB 4: TIMELINE STORIES MANAGER ---
  function renderMilestonesList() {
    const list = document.getElementById('admin-milestones-list');
    list.innerHTML = '';
    const milestones = adminState.milestones || [];

    milestones.forEach(m => {
      const card = document.createElement('div');
      card.className = 'admin-milestone-card';
      card.innerHTML = `
        <img src="${m.image}" alt="${m.title}" class="admin-milestone-thumb">
        <div class="admin-milestone-info">
          <div class="admin-milestone-title">
            ${m.title}
            <span class="admin-align-badge">Align: ${m.alignment ? m.alignment.toUpperCase() : 'AUTO'}</span>
          </div>
          <div class="admin-milestone-sub">${m.date} • Category: ${m.category || 'milestone'} • Badge: "${m.badge || ''}"</div>
          <div class="admin-milestone-desc">${m.description}</div>
        </div>
        <div class="admin-milestone-actions">
          <button type="button" class="btn-card-action btn-card-edit" data-id="${m.id}">✏️ Edit Story</button>
          <button type="button" class="btn-card-action btn-card-delete" data-id="${m.id}">🗑️ Delete</button>
        </div>
      `;

      card.querySelector('.btn-card-edit').addEventListener('click', () => openMilestoneModal(m.id));
      card.querySelector('.btn-card-delete').addEventListener('click', () => deleteMilestone(m.id));

      list.appendChild(card);
    });
  }

  function openMilestoneModal(id) {
    const modal = document.getElementById('modal-edit-milestone');
    const milestone = (adminState.milestones || []).find(m => m.id === id);
    if (!milestone) return;

    document.getElementById('modal-milestone-id').value = milestone.id;
    document.getElementById('modal-milestone-preview').src = milestone.image;
    document.getElementById('modal-milestone-title').value = milestone.title || '';
    document.getElementById('modal-milestone-date').value = milestone.date || '';
    document.getElementById('modal-milestone-category').value = milestone.category || 'milestone';
    document.getElementById('modal-milestone-align').value = milestone.alignment || 'left';
    document.getElementById('modal-milestone-badge').value = milestone.badge || '';
    document.getElementById('modal-milestone-desc').value = milestone.description || '';
    document.getElementById('modal-milestone-caption').value = milestone.caption || '';
    document.getElementById('modal-milestone-url').value = milestone.image || '';
    document.getElementById('modal-milestone-file').value = '';

    modal.showModal();
  }

  function deleteMilestone(id) {
    if (!confirm('Are you sure you want to remove this milestone story from the timeline?')) return;
    adminState.milestones = (adminState.milestones || []).filter(m => m.id !== id);
    saveAdminState(false);
    renderMilestonesList();
    updateStats();
  }

  function initTimelineManager() {
    renderMilestonesList();

    // Modal submit
    const form = document.getElementById('form-modal-milestone');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const id = document.getElementById('modal-milestone-id').value;
      const milestone = (adminState.milestones || []).find(m => m.id === id);
      if (!milestone) return;

      milestone.title = document.getElementById('modal-milestone-title').value.trim();
      milestone.date = document.getElementById('modal-milestone-date').value.trim();
      milestone.category = document.getElementById('modal-milestone-category').value;
      milestone.alignment = document.getElementById('modal-milestone-align').value;
      milestone.badge = document.getElementById('modal-milestone-badge').value.trim();
      milestone.description = document.getElementById('modal-milestone-desc').value.trim();
      milestone.caption = document.getElementById('modal-milestone-caption').value.trim();

      const file = document.getElementById('modal-milestone-file').files[0];
      const url = document.getElementById('modal-milestone-url').value.trim();

      if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          milestone.image = ev.target.result;
          document.getElementById('modal-edit-milestone').close();
          saveAdminState(false);
          renderMilestonesList();
          updateStats();
        };
        reader.readAsDataURL(file);
      } else {
        if (url) milestone.image = url;
        document.getElementById('modal-edit-milestone').close();
        saveAdminState(false);
        renderMilestonesList();
        updateStats();
      }
    });

    // Add New Milestone Button
    document.getElementById('btn-admin-add-milestone').addEventListener('click', function () {
      const newId = 'm-' + Date.now();
      const newMilestone = {
        id: newId,
        date: 'A Beautiful Day',
        category: 'milestone',
        title: 'New Story Milestone ✨',
        badge: 'Special Memory',
        alignment: 'center',
        description: 'Describe this magical moment here...',
        image: 'images/photo_selfie_outdoor.jpg',
        caption: 'Forever in my heart 💕'
      };
      adminState.milestones = adminState.milestones || [];
      adminState.milestones.push(newMilestone);
      saveAdminState(false);
      renderMilestonesList();
      updateStats();
      openMilestoneModal(newId);
    });

    // Delete in modal
    document.getElementById('btn-modal-delete-milestone').addEventListener('click', function () {
      const id = document.getElementById('modal-milestone-id').value;
      deleteMilestone(id);
      document.getElementById('modal-edit-milestone').close();
    });
  }

  // --- TAB 5: LOVE LETTER ---
  function initLetterTab() {
    const form = document.getElementById('form-letter');
    const salInput = document.getElementById('admin-letter-salutation');
    const paraInput = document.getElementById('admin-letter-paragraphs');
    const closeInput = document.getElementById('admin-letter-closing');
    const sigInput = document.getElementById('admin-letter-signature');
    const psInput = document.getElementById('admin-letter-ps');

    const letter = adminState.letter || {};
    salInput.value = letter.salutation || '';
    paraInput.value = (letter.paragraphs || []).join('\n\n');
    closeInput.value = letter.closing || '';
    sigInput.value = letter.signature || '';
    psInput.value = letter.postscript || '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const paras = paraInput.value.split('\n\n').map(s => s.trim()).filter(Boolean);
      adminState.letter = {
        salutation: salInput.value.trim(),
        paragraphs: paras,
        closing: closeInput.value.trim(),
        signature: sigInput.value.trim(),
        postscript: psInput.value.trim()
      };
      saveAdminState();
    });
  }

  // --- TAB 6: SURPRISE & COUPONS ---
  function initSurpriseTab() {
    const form = document.getElementById('form-surprise');
    const titleInput = document.getElementById('admin-surprise-title');
    const msgInput = document.getElementById('admin-surprise-message');

    const surprise = adminState.surprise || {};
    titleInput.value = surprise.revealTitle || '';
    msgInput.value = surprise.hiddenMessage || '';

    renderCouponsTable();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!adminState.surprise) adminState.surprise = {};
      adminState.surprise.revealTitle = titleInput.value.trim();
      adminState.surprise.hiddenMessage = msgInput.value.trim();
      saveAdminState();
    });

    document.getElementById('btn-admin-reset-coupons').addEventListener('click', function () {
      if (adminState.surprise && adminState.surprise.coupons) {
        adminState.surprise.coupons.forEach(c => c.redeemed = false);
        saveAdminState(false);
        renderCouponsTable();
        alert('🎟️ All love coupons are now reset and ready for your girlfriend to claim again!');
      }
    });
  }

  function renderCouponsTable() {
    const container = document.getElementById('admin-coupons-list');
    container.innerHTML = '';
    const coupons = (adminState.surprise && adminState.surprise.coupons) || [];

    coupons.forEach(coupon => {
      const row = document.createElement('div');
      row.className = 'admin-coupon-row';
      row.innerHTML = `
        <div>
          <strong>${coupon.icon || '🎟️'} ${coupon.title}</strong>
          <div style="font-size: 0.8rem; color: #6e5d61;">${coupon.desc}</div>
        </div>
        <span class="coupon-status-pill ${coupon.redeemed ? 'claimed' : 'ready'}">
          ${coupon.redeemed ? '✓ Redeemed by Her' : 'Ready to Claim'}
        </span>
      `;
      container.appendChild(row);
    });
  }

  // --- TAB 7: MUSIC ---
  function initMusicTab() {
    const form = document.getElementById('form-music');
    const titleInput = document.getElementById('admin-music-title');
    const urlInput = document.getElementById('admin-music-url');
    const fileInput = document.getElementById('admin-music-file');

    const mus = adminState.music || {};
    titleInput.value = mus.title || '';
    urlInput.value = mus.url || '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!adminState.music) adminState.music = {};
      adminState.music.title = titleInput.value.trim() || 'Our Romantic Melody 🎶';

      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          adminState.music.url = ev.target.result;
          saveAdminState();
        };
        reader.readAsDataURL(file);
      } else {
        if (urlInput.value.trim()) {
          adminState.music.url = urlInput.value.trim();
        }
        saveAdminState();
      }
    });
  }

  // --- TAB 8: HER LOVE NOTES ---
  function renderNotesTab() {
    const container = document.getElementById('admin-notes-container');
    container.innerHTML = '';
    const notes = adminState.girlfriendNotes || [];

    if (notes.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #6e5d61; font-style: italic;">
          💌 No love notes from your girlfriend yet.<br>
          When she logs into Girlfriend Mode and writes a note, it will appear right here!
        </div>
      `;
      return;
    }

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'admin-note-card';
      card.innerHTML = `
        <div class="admin-note-header">
          <span class="admin-note-mood">${note.sticker || '💖'} ${note.mood || 'Sweet Love Note'}</span>
          <span class="admin-note-time">Sent on ${note.date} at ${note.time}</span>
        </div>
        <div class="admin-note-body">"${note.message}"</div>
        <div style="display:flex; justify-content:flex-end; margin-top: 10px;">
          <button type="button" class="btn-card-action btn-card-delete" style="max-width: 100px;" data-id="${note.id}">🗑️ Delete</button>
        </div>
      `;

      card.querySelector('.btn-card-delete').addEventListener('click', function () {
        if (confirm('Delete this love note?')) {
          adminState.girlfriendNotes = (adminState.girlfriendNotes || []).filter(n => n.id !== note.id);
          saveAdminState(false);
          renderNotesTab();
          updateStats();
        }
      });

      container.appendChild(card);
    });
  }

  function initNotesTab() {
    renderNotesTab();
    document.getElementById('btn-refresh-admin-notes').addEventListener('click', () => {
      loadAdminState();
      renderNotesTab();
      updateStats();
    });
  }

  // --- TAB 9: SECURITY & PINS ---
  function initSecurityTab() {
    const form = document.getElementById('form-security');
    const bfPinInput = document.getElementById('admin-sec-bf');
    const gfPinInput = document.getElementById('admin-sec-gf');

    const auth = adminState.auth || { boyfriendPin: '1234', girlfriendPin: '0820' };
    bfPinInput.value = auth.boyfriendPin || '1234';
    gfPinInput.value = auth.girlfriendPin || '0820';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const bfPin = bfPinInput.value.trim();
      const gfPin = gfPinInput.value.trim();
      if (!bfPin || !gfPin) {
        alert('Please provide valid PINs for both profiles.');
        return;
      }
      if (!adminState.auth) adminState.auth = {};
      adminState.auth.boyfriendPin = bfPin;
      adminState.auth.girlfriendPin = gfPin;
      saveAdminState();
    });

    document.getElementById('btn-admin-reset-pins').addEventListener('click', function () {
      bfPinInput.value = '1234';
      gfPinInput.value = '0820';
      if (!adminState.auth) adminState.auth = {};
      adminState.auth.boyfriendPin = '1234';
      adminState.auth.girlfriendPin = '0820';
      saveAdminState(false);
      alert('🔄 Passcodes reset to defaults:\nBoyfriend PIN: 1234\nGirlfriend PIN: 0820 (August 20 Anniversary)');
    });
  }

  // --- Global Actions ---
  function initGlobalActions() {
    document.getElementById('btn-save-all').addEventListener('click', function () {
      saveAdminState(true);
    });

    const copyGfBtn = document.getElementById('btn-copy-gf-link');
    if (copyGfBtn) {
      copyGfBtn.addEventListener('click', function () {
        const gfUrl = `${window.location.origin}/girlfriend.html`;
        navigator.clipboard.writeText(gfUrl).then(() => {
          alert(`💌 Girlfriend Portal link copied to clipboard!\n\n${gfUrl}\n\nSend this link to your girlfriend—when she opens it, she is immediately logged in as Princess! 💕`);
        }).catch(() => {
          prompt('Copy girlfriend link to send to her:', gfUrl);
        });
      });
    }

    document.getElementById('btn-export-json').addEventListener('click', function () {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(adminState, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `romantic_scrapbook_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  // --- Live Preview Device Controls ---
  function initLivePreviewControls() {
    const btnDesktop = document.getElementById('btn-device-desktop');
    const btnMobile = document.getElementById('btn-device-mobile');
    const btnReload = document.getElementById('btn-reload-preview');
    const wrapper = document.getElementById('live-preview-wrapper');

    if (btnDesktop && wrapper) {
      btnDesktop.addEventListener('click', function () {
        wrapper.classList.remove('mobile-mode');
        btnDesktop.classList.add('active');
        if (btnMobile) btnMobile.classList.remove('active');
      });
    }

    if (btnMobile && wrapper) {
      btnMobile.addEventListener('click', function () {
        wrapper.classList.add('mobile-mode');
        btnMobile.classList.add('active');
        if (btnDesktop) btnDesktop.classList.remove('active');
      });
    }

    if (btnReload) {
      btnReload.addEventListener('click', function () {
        reloadLivePreview(true);
        showAdminSuccessToast('🔄 Live preview reloaded!');
      });
    }
  }

  // --- Initialize All Modules ---
  function init() {
    loadAdminState();
    initTabs();
    updateStats();
    initWordingsTab();
    initPhotosManager();
    initTimelineManager();
    initLetterTab();
    initSurpriseTab();
    initMusicTab();
    initNotesTab();
    initSecurityTab();
    initLivePreviewControls();
    initGlobalActions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
