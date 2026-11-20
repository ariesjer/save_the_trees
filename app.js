(() => {
  const STORAGE_KEY = 'tree_appeal_draft_v1';

  const SAMPLE_DATA = {
    licenseNumber: '1008726',
    appealDate: '26.10.26',
    siteAddress: 'הגיא 1',
    siteBlock: '30149',
    siteParcel: '110–111',
    trees: [
      { species: 'ברוש מצוי', count: 8, action: 'כריתה' },
      { species: 'תות לבן', count: 2, action: 'כריתה' },
      { species: 'שקד מצוי', count: 2, action: 'כריתה' },
      { species: 'איקליפטוס המקור', count: 2, action: 'כריתה' },
      { species: 'אורן קנרי', count: 2, action: 'כריתה' },
      { species: 'צפצפה מכסיפה', count: 1, action: 'כריתה' },
      { species: 'זית אירופי', count: 1, action: 'העתקה' },
    ],
    reasons: ['צורכי בנייה/פיתוח בשטח שעליו צומחים האילנות'],
    reasonOtherText: '',
    rejectionReasons: '',
    appealArguments:
      'המקום הוא אתר היסטורי. המלון הוקם לפני 80 שנה והוא האחרון ששרד מ-20 בתי המלון שהיו בעבר בשכונת בית הכרם. העצים הם חלק בלתי נפרד ממנו, והם ממגוון מינים ויוצרים את הנוף המיוחד. בתכנית מוצהר שישמרו על העצים הבוגרים המשמעותיים, אך הדבר אינו נעשה. לא ייתכן לכרות עצים גדולי ממדים ומרשימים כמו ברושים, שמונה במספר, הניצבים בשורה סמוך למבנה, איקליפטוס המקור, עץ גדול ומרשים, ואורן קנרי. בסקר העצים המצורף גם מופיע איקליפטוס אחד לכריתה, וכאן שניים, וכך גם לגבי שקד: רק אחד מיועד לכריתה, וכאן שניים.',
  };

  // DOM Elements
  const form = document.getElementById('appealForm');
  const mainContainer = document.querySelector('.main-container');
  const previewSection = document.getElementById('previewSection');
  const officialDocument = document.getElementById('officialDocument');
  const submitSuccessBanner = document.getElementById('submitSuccessBanner');

  const additionalListEl = document.getElementById('additionalAppellantsList');
  const additionalCountEl = document.getElementById('additionalCount');
  const treesTableBody = document.getElementById('treesTableBody');
  const treesSummaryEl = document.getElementById('treesSummary');

  const reasonOtherCheck = document.getElementById('reasonOtherCheck');
  const reasonOtherWrap = document.getElementById('reasonOtherWrap');
  const reasonOtherText = document.getElementById('reasonOtherText');

  const attachmentsInput = document.getElementById('attachmentsInput');
  const fileDropzone = document.getElementById('fileDropzone');
  const attachmentsListEl = document.getElementById('attachmentsList');

  const mainFirstName = document.getElementById('mainFirstName');
  const mainLastName = document.getElementById('mainLastName');
  const signatureName = document.getElementById('signatureName');
  const draftStatus = document.getElementById('draftStatus');

  const sigCanvas = document.getElementById('signatureCanvas');
  const sigPlaceholder = document.getElementById('sigPlaceholder');
  const sigCtx = sigCanvas.getContext('2d');

  // State
  let additionalAppellants = [];
  let trees = [];
  let attachedFiles = [];
  let hasSignature = false;
  let signatureNameEditedManually = false;

  // ---------- Utilities ----------
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  function getTodayFormatted() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  }

  // ---------- Additional Appellants ----------
  function renderAdditionalAppellants() {
    additionalListEl.innerHTML = '';
    additionalCountEl.textContent = additionalAppellants.length;

    additionalAppellants.forEach((person, idx) => {
      const card = document.createElement('div');
      card.className = 'appellant-item';
      card.innerHTML = `
        <div class="appellant-item-header">
          <span class="appellant-badge">מערער נוסף #${idx + 1}</span>
          <button type="button" class="btn-danger-sm" data-remove-appellant="${idx}">הסר מערער</button>
        </div>
        <div class="grid-4">
          <div class="field">
            <label>שם פרטי <span class="req">*</span></label>
            <input type="text" data-app-idx="${idx}" data-app-field="firstName" value="${escapeHtml(person.firstName)}" placeholder="שם פרטי" required />
            <span class="error-msg" data-app-err="${idx}-firstName"></span>
          </div>
          <div class="field">
            <label>שם משפחה <span class="req">*</span></label>
            <input type="text" data-app-idx="${idx}" data-app-field="lastName" value="${escapeHtml(person.lastName)}" placeholder="שם משפחה" required />
            <span class="error-msg" data-app-err="${idx}-lastName"></span>
          </div>
          <div class="field">
            <label>כתובת <span class="req">*</span></label>
            <input type="text" data-app-idx="${idx}" data-app-field="address" value="${escapeHtml(person.address)}" placeholder="רחוב, מספר, עיר" required />
            <span class="error-msg" data-app-err="${idx}-address"></span>
          </div>
          <div class="field">
            <label>כתובת מייל <span class="req">*</span></label>
            <input type="email" data-app-idx="${idx}" data-app-field="email" value="${escapeHtml(person.email)}" placeholder="name@example.com" required />
            <span class="error-msg" data-app-err="${idx}-email"></span>
          </div>
        </div>
      `;
      additionalListEl.appendChild(card);
    });
  }

  document.getElementById('btnAddAppellant').addEventListener('click', () => {
    additionalAppellants.push({
      firstName: '',
      lastName: '',
      address: '',
      email: '',
    });
    renderAdditionalAppellants();
    saveDraft();
    const lastInput = additionalListEl.querySelector(
      `input[data-app-idx="${additionalAppellants.length - 1}"][data-app-field="firstName"]`
    );
    if (lastInput) lastInput.focus();
  });

  additionalListEl.addEventListener('input', (e) => {
    const idx = e.target.getAttribute('data-app-idx');
    const field = e.target.getAttribute('data-app-field');
    if (idx !== null && field) {
      additionalAppellants[Number(idx)][field] = e.target.value;
      e.target.classList.remove('invalid');
      const errEl = additionalListEl.querySelector(`[data-app-err="${idx}-${field}"]`);
      if (errEl) errEl.textContent = '';
      saveDraft();
    }
  });

  additionalListEl.addEventListener('click', (e) => {
    const removeIdx = e.target.getAttribute('data-remove-appellant');
    if (removeIdx !== null) {
      additionalAppellants.splice(Number(removeIdx), 1);
      renderAdditionalAppellants();
      saveDraft();
    }
  });

  // ---------- Trees Table ----------
  function updateTreesSummary() {
    let total = 0;
    let cut = 0;
    let transplant = 0;
    trees.forEach((t) => {
      const n = Math.max(0, parseInt(t.count, 10) || 0);
      total += n;
      if (t.action === 'העתקה') transplant += n;
      else cut += n;
    });
    treesSummaryEl.textContent = `סה"כ ${total} אילנות (${cut} לכריתה, ${transplant} להעתקה)`;
  }

  function renderTrees() {
    treesTableBody.innerHTML = '';
    trees.forEach((tree, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="שם המין">
          <input type="text" data-tree-idx="${idx}" data-tree-field="species" value="${escapeHtml(tree.species)}" placeholder="שם מין העץ" />
        </td>
        <td data-label="מספר אילנות">
          <input type="number" min="1" data-tree-idx="${idx}" data-tree-field="count" value="${escapeHtml(tree.count)}" />
        </td>
        <td data-label="כריתה או העתקה">
          <select data-tree-idx="${idx}" data-tree-field="action">
            <option value="כריתה" ${tree.action === 'כריתה' ? 'selected' : ''}>כריתה</option>
            <option value="העתקה" ${tree.action === 'העתקה' ? 'selected' : ''}>העתקה</option>
          </select>
        </td>
        <td data-label="פעולה" class="tree-action-cell">
          <button type="button" class="btn-danger-sm" data-remove-tree="${idx}" title="הסר שורה">✕ <span class="mobile-only-label">הסר שורה</span></button>
        </td>
      `;
      treesTableBody.appendChild(tr);
    });
    updateTreesSummary();
  }

  document.getElementById('btnAddTree').addEventListener('click', () => {
    trees.push({ species: '', count: 1, action: 'כריתה' });
    renderTrees();
    saveDraft();
  });

  treesTableBody.addEventListener('input', (e) => {
    const idx = e.target.getAttribute('data-tree-idx');
    const field = e.target.getAttribute('data-tree-field');
    if (idx !== null && field) {
      trees[Number(idx)][field] = field === 'count' ? Number(e.target.value) : e.target.value;
      updateTreesSummary();
      saveDraft();
    }
  });

  treesTableBody.addEventListener('change', (e) => {
    const idx = e.target.getAttribute('data-tree-idx');
    const field = e.target.getAttribute('data-tree-field');
    if (idx !== null && field) {
      trees[Number(idx)][field] = e.target.value;
      updateTreesSummary();
      saveDraft();
    }
  });

  treesTableBody.addEventListener('click', (e) => {
    const removeIdx = e.target.getAttribute('data-remove-tree');
    if (removeIdx !== null) {
      trees.splice(Number(removeIdx), 1);
      renderTrees();
      saveDraft();
    }
  });

  // ---------- Reasons ----------
  reasonOtherCheck.addEventListener('change', () => {
    reasonOtherWrap.classList.toggle('hidden', !reasonOtherCheck.checked);
    saveDraft();
  });

  // ---------- Attachments ----------
  function renderAttachments() {
    attachmentsListEl.innerHTML = '';
    attachedFiles.forEach((f, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>📎 ${escapeHtml(f.name)} <small style="color:#64748b">(${formatBytes(f.size)})</small></span>
        <button type="button" class="btn-danger-sm" data-remove-file="${idx}">הסר</button>
      `;
      attachmentsListEl.appendChild(li);
    });
  }

  function addFiles(fileList) {
    for (const file of fileList) {
      attachedFiles.push({ name: file.name, size: file.size });
    }
    renderAttachments();
  }

  attachmentsInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    attachmentsInput.value = '';
  });

  fileDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropzone.classList.add('dragover');
  });

  fileDropzone.addEventListener('dragleave', () => {
    fileDropzone.classList.remove('dragover');
  });

  fileDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  });

  attachmentsListEl.addEventListener('click', (e) => {
    const idx = e.target.getAttribute('data-remove-file');
    if (idx !== null) {
      attachedFiles.splice(Number(idx), 1);
      renderAttachments();
    }
  });

  // ---------- Signature Pad ----------
  let drawing = false;

  function setupCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = sigCanvas.getBoundingClientRect();
    const w = rect.width || 420;
    const h = rect.height || 130;
    sigCanvas.width = w * ratio;
    sigCanvas.height = h * ratio;
    sigCtx.scale(ratio, ratio);
    sigCtx.lineWidth = 2.2;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    sigCtx.strokeStyle = '#0f172a';
  }

  function getPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDraw(e) {
    if (e.touches && e.cancelable) e.preventDefault();
    drawing = true;
    hasSignature = true;
    sigPlaceholder.classList.add('hidden');
    sigCanvas.parentElement.classList.remove('invalid');
    const errEl = document.querySelector('[data-for="signatureCanvas"]');
    if (errEl) errEl.textContent = '';
    const pos = getPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
  }

  function stopDraw() {
    drawing = false;
  }

  sigCanvas.addEventListener('mousedown', startDraw);
  sigCanvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDraw);

  sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
  sigCanvas.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stopDraw);

  document.getElementById('btnClearSig').addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    hasSignature = false;
    sigPlaceholder.classList.remove('hidden');
  });

  // Sync main appellant name -> signature name
  function syncSignatureName() {
    if (signatureNameEditedManually) return;
    const full = `${mainFirstName.value.trim()} ${mainLastName.value.trim()}`.trim();
    signatureName.value = full;
  }

  mainFirstName.addEventListener('input', syncSignatureName);
  mainLastName.addEventListener('input', syncSignatureName);
  signatureName.addEventListener('input', () => {
    signatureNameEditedManually = signatureName.value.trim().length > 0;
  });

  // ---------- Form State & Drafts ----------
  function collectFormData() {
    const checkedReasons = Array.from(
      document.querySelectorAll('input[name="reasons"]:checked')
    ).map((el) => el.value);

    return {
      licenseNumber: document.getElementById('licenseNumber').value.trim(),
      appealDate: document.getElementById('appealDate').value.trim(),
      mainFirstName: mainFirstName.value.trim(),
      mainLastName: mainLastName.value.trim(),
      mainId: document.getElementById('mainId').value.trim(),
      mainAddress: document.getElementById('mainAddress').value.trim(),
      mainPhone: document.getElementById('mainPhone').value.trim(),
      mainEmail: document.getElementById('mainEmail').value.trim(),
      additionalAppellants: additionalAppellants.map((p) => ({
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        address: p.address.trim(),
        email: p.email.trim(),
      })),
      siteAddress: document.getElementById('siteAddress').value.trim(),
      siteBlock: document.getElementById('siteBlock').value.trim(),
      siteParcel: document.getElementById('siteParcel').value.trim(),
      trees: trees.map((t) => ({
        species: String(t.species).trim(),
        count: Number(t.count) || 0,
        action: t.action,
      })),
      reasons: checkedReasons,
      reasonOtherText: reasonOtherText.value.trim(),
      rejectionReasons: document.getElementById('rejectionReasons').value.trim(),
      appealArguments: document.getElementById('appealArguments').value.trim(),
      declarationCheck: document.getElementById('declarationCheck').checked,
      signatureName: signatureName.value.trim(),
    };
  }

  function applyData(data) {
    document.getElementById('licenseNumber').value = data.licenseNumber || '';
    document.getElementById('appealDate').value = data.appealDate || getTodayFormatted();
    mainFirstName.value = data.mainFirstName || '';
    mainLastName.value = data.mainLastName || '';
    document.getElementById('mainId').value = data.mainId || '';
    document.getElementById('mainAddress').value = data.mainAddress || '';
    document.getElementById('mainPhone').value = data.mainPhone || '';
    document.getElementById('mainEmail').value = data.mainEmail || '';

    additionalAppellants = Array.isArray(data.additionalAppellants)
      ? data.additionalAppellants.map((p) => ({ ...p }))
      : [];
    renderAdditionalAppellants();

    document.getElementById('siteAddress').value = data.siteAddress || '';
    document.getElementById('siteBlock').value = data.siteBlock || '';
    document.getElementById('siteParcel').value = data.siteParcel || '';

    trees = Array.isArray(data.trees) && data.trees.length
      ? data.trees.map((t) => ({ ...t }))
      : [{ species: '', count: 1, action: 'כריתה' }];
    renderTrees();

    const reasonSet = new Set(data.reasons || []);
    document.querySelectorAll('input[name="reasons"]').forEach((cb) => {
      cb.checked = reasonSet.has(cb.value);
    });
    reasonOtherText.value = data.reasonOtherText || '';
    reasonOtherWrap.classList.toggle('hidden', !reasonOtherCheck.checked);

    document.getElementById('rejectionReasons').value = data.rejectionReasons || '';
    document.getElementById('appealArguments').value = data.appealArguments || '';
    document.getElementById('declarationCheck').checked = Boolean(data.declarationCheck);
    signatureName.value = data.signatureName || '';
  }

  function saveDraft() {
    try {
      const data = collectFormData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      draftStatus.textContent = 'טיוטה נשמרה אוטומטית';
    } catch {
      // Ignore storage errors
    }
  }

  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (id) {
      e.target.classList.remove('invalid');
      const errEl = document.querySelector(`[data-for="${id}"]`);
      if (errEl) errEl.textContent = '';
    }
    saveDraft();
  });

  form.addEventListener('change', () => {
    saveDraft();
  });

  document.getElementById('btnLoadSample').addEventListener('click', () => {
    applyData({
      ...collectFormData(),
      ...SAMPLE_DATA,
    });
    saveDraft();
    showToast('נתוני הדוגמה מהטופס נטענו בהצלחה');
  });

  document.getElementById('btnClearForm').addEventListener('click', () => {
    applyData({
      appealDate: getTodayFormatted(),
      trees: [{ species: '', count: 1, action: 'כריתה' }],
      reasons: [],
      additionalAppellants: [],
    });
    attachedFiles = [];
    renderAttachments();
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    hasSignature = false;
    signatureNameEditedManually = false;
    sigPlaceholder.classList.remove('hidden');
    localStorage.removeItem(STORAGE_KEY);
    draftStatus.textContent = '';
    showToast('הטופס נוקה');
  });

  // ---------- Validation ----------
  function setFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.classList.add('invalid');
    const errEl = document.querySelector(`[data-for="${id}"]`);
    if (errEl) errEl.textContent = msg;
  }

  function validateForm() {
    let valid = true;
    document.querySelectorAll('.error-msg').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

    const requiredTextIds = [
      ['licenseNumber', 'יש להזין מספר רישיון'],
      ['appealDate', 'יש להזין תאריך פנייה'],
      ['mainFirstName', 'יש להזין שם פרטי'],
      ['mainLastName', 'יש להזין שם משפחה'],
      ['mainId', 'יש להזין מספר תעודת זהות'],
      ['mainAddress', 'יש להזין כתובת'],
      ['mainPhone', 'יש להזין מספר טלפון'],
      ['siteAddress', 'יש להזין כתובת השטח'],
      ['siteBlock', 'יש להזין גוש'],
      ['siteParcel', 'יש להזין חלקה'],
      ['appealArguments', 'יש לפרט את הנימוקים להשגה'],
      ['signatureName', 'יש להזין את שם החותם'],
    ];

    for (const [id, msg] of requiredTextIds) {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        setFieldError(id, msg);
        valid = false;
      }
    }

    const emailEl = document.getElementById('mainEmail');
    if (!emailEl.value.trim() || !isValidEmail(emailEl.value)) {
      setFieldError('mainEmail', 'יש להזין כתובת דואר אלקטרוני תקינה');
      valid = false;
    }

    additionalAppellants.forEach((person, idx) => {
      const checks = [
        ['firstName', person.firstName.trim(), 'יש להזין שם פרטי'],
        ['lastName', person.lastName.trim(), 'יש להזין שם משפחה'],
        ['address', person.address.trim(), 'יש להזין כתובת'],
      ];
      checks.forEach(([field, val, msg]) => {
        if (!val) {
          const inp = additionalListEl.querySelector(
            `input[data-app-idx="${idx}"][data-app-field="${field}"]`
          );
          if (inp) inp.classList.add('invalid');
          const err = additionalListEl.querySelector(`[data-app-err="${idx}-${field}"]`);
          if (err) err.textContent = msg;
          valid = false;
        }
      });

      if (!person.email.trim() || !isValidEmail(person.email)) {
        const inp = additionalListEl.querySelector(
          `input[data-app-idx="${idx}"][data-app-field="email"]`
        );
        if (inp) inp.classList.add('invalid');
        const err = additionalListEl.querySelector(`[data-app-err="${idx}-email"]`);
        if (err) err.textContent = 'יש להזין כתובת מייל תקינה';
        valid = false;
      }
    });

    if (!document.getElementById('declarationCheck').checked) {
      document.querySelector('[data-for="declarationCheck"]').textContent =
        'יש לאשר את ההצהרה לפני הגשת ההשגה';
      valid = false;
    }

    if (!hasSignature) {
      sigCanvas.parentElement.classList.add('invalid');
      document.querySelector('[data-for="signatureCanvas"]').textContent =
        'יש לחתום בתיבת החתימה';
      valid = false;
    }

    if (!valid) {
      const firstInvalid = document.querySelector('.invalid, .error-msg:not(:empty)');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast('נא להשלים את כל שדות החובה המסומנים');
    }

    return valid;
  }

  // ---------- Render Official Document & Plain Text ----------
  function buildPlainText(data) {
    const lines = [
      'טופס השגה על החלטת פקיד היערות האזורי בבקשה למתן רישיון לכריתת/העתקת עץ/ים בוגר/ים',
      'אל: פקיד היערות | דוא"ל: trees@moag.gov.il | פקס: 03-9485264',
      `מספר רישיון נשוא ההשגה: ${data.licenseNumber}`,
      `תאריך הפנייה: ${data.appealDate}`,
      '',
      '--- פרטי מגיש ההשגה הראשי ---',
      `שם: ${data.mainFirstName} ${data.mainLastName}`,
      `ת.ז: ${data.mainId}`,
      `כתובת: ${data.mainAddress}`,
      `מס' טלפון: ${data.mainPhone}`,
      `דואר אלקטרוני: ${data.mainEmail}`,
    ];

    if (data.additionalAppellants.length > 0) {
      lines.push('', '--- מערערים נוספים ---');
      data.additionalAppellants.forEach((p, idx) => {
        lines.push(`${idx + 1}. ${p.firstName} ${p.lastName} | כתובת: ${p.address} | מייל: ${p.email}`);
      });
    }

    lines.push(
      '',
      '--- השטח לגביו הוגשה בקשת הכריתה/העתקה ---',
      `כתובת: ${data.siteAddress} | גוש: ${data.siteBlock} | חלקה: ${data.siteParcel}`,
      '',
      '--- האילנות המוגנים ---'
    );

    data.trees
      .filter((t) => t.species)
      .forEach((t) => {
        lines.push(`• ${t.species} — ${t.count} אילנות (${t.action})`);
      });

    const reasonsList = data.reasons.map((r) =>
      r === 'אחר' && data.reasonOtherText ? `אחר: ${data.reasonOtherText}` : r
    );
    lines.push('', `הסיבה שבשלה הוגשה הבקשה: ${reasonsList.join(', ') || 'לא צוין'}`);

    if (data.rejectionReasons) {
      lines.push('', 'נימוקי פקיד היערות האזורי לדחיית הבקשה:', data.rejectionReasons);
    }

    lines.push(
      '',
      'הנימוקים להשגה המוגשת לפקיד היערות הממשלתי במשרד החקלאות וביטחון המזון:',
      data.appealArguments,
      '',
      '* ידוע לי כי כל פרטי ההשגה, לרבות פרטי המשיג ופרטי ההתקשרות, מועברים לבעל הרישיון.',
      `שם החותם: ${data.signatureName}`
    );

    if (attachedFiles.length > 0) {
      lines.push('', `מסמכים מצורפים (יש לצרף למייל): ${attachedFiles.map((f) => f.name).join(', ')}`);
    }

    return lines.join('\n');
  }

  function renderOfficialDocument(data) {
    const allReasons = [
      'סכנה בטיחותית',
      'אילנות חולים או מנוונים',
      'סכנה בריאותית',
      'צורכי בנייה/פיתוח בשטח שעליו צומחים האילנות',
      'הכשרה חקלאית',
      'אחר',
    ];
    const selectedSet = new Set(data.reasons);
    const sigDataUrl = hasSignature ? sigCanvas.toDataURL('image/png') : '';

    const additionalRowsHtml = data.additionalAppellants.length
      ? `
      <table class="doc-table">
        <thead>
          <tr class="doc-section-row"><th colspan="4">מערערים נוספים (${data.additionalAppellants.length})</th></tr>
          <tr>
            <th style="width: 45px;">#</th>
            <th>שם פרטי ומשפחה</th>
            <th>כתובת</th>
            <th>כתובת מייל</th>
          </tr>
        </thead>
        <tbody>
          ${data.additionalAppellants
            .map(
              (p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</td>
              <td>${escapeHtml(p.address)}</td>
              <td>${escapeHtml(p.email)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
      : '';

    const treesRowsHtml = data.trees
      .filter((t) => t.species || t.count)
      .map(
        (t) => `
        <tr>
          <td>${escapeHtml(t.species)}</td>
          <td>${escapeHtml(t.count)}</td>
          <td>${escapeHtml(t.action)}</td>
        </tr>
      `
      )
      .join('');

    const reasonsRowsHtml = allReasons
      .map((r) => {
        const label =
          r === 'אחר'
            ? `אחר, פרט${data.reasonOtherText ? `: ${escapeHtml(data.reasonOtherText)}` : ''}`
            : r;
        const mark = selectedSet.has(r) ? '<strong>X</strong>' : '';
        return `
        <tr>
          <td>${label}</td>
          <td style="width: 80px; text-align: center;">${mark}</td>
        </tr>
      `;
      })
      .join('');

    officialDocument.innerHTML = `
      <h2 class="doc-title">טופס השגה על החלטת פקיד היערות האזורי בבקשה למתן רישיון לכריתת/העתקת עץ/ים בוגר/ים</h2>

      <table class="doc-table">
        <tbody>
          <tr>
            <td colspan="2">
              <strong>אל:</strong> פקיד היערות &nbsp;|&nbsp;
              <strong>דוא"ל:</strong> trees@moag.gov.il &nbsp;|&nbsp;
              <strong>פקס:</strong> <span dir="ltr">03-9485264</span><br />
              <strong>הנדון:</strong> השגה על החלטת פקיד היערות האזורי בבקשה למתן רישיון לכריתת/העתקת עץ/ים בוגר/ים
            </td>
          </tr>
          <tr>
            <td><strong>מספר רישיון נשוא ההשגה:</strong> ${escapeHtml(data.licenseNumber)}</td>
            <td><strong>תאריך הפנייה:</strong> ${escapeHtml(data.appealDate)}</td>
          </tr>
        </tbody>
      </table>

      <table class="doc-table">
        <thead>
          <tr class="doc-section-row"><th colspan="2">פרטי מגיש ההשגה</th></tr>
        </thead>
        <tbody>
          <tr><th style="width: 190px;">שם פרטי ומשפחה</th><td>${escapeHtml(data.mainFirstName)} ${escapeHtml(data.mainLastName)}</td></tr>
          <tr><th>ת.ז</th><td>${escapeHtml(data.mainId)}</td></tr>
          <tr><th>כתובת</th><td>${escapeHtml(data.mainAddress)}</td></tr>
          <tr><th>מס' טלפון</th><td>${escapeHtml(data.mainPhone)}</td></tr>
          <tr><th>דואר אלקטרוני</th><td>${escapeHtml(data.mainEmail)}</td></tr>
        </tbody>
      </table>

      ${additionalRowsHtml}

      <table class="doc-table">
        <thead>
          <tr class="doc-section-row"><th colspan="2">השטח לגביו הוגשה בקשת הכריתה/העתקה</th></tr>
        </thead>
        <tbody>
          <tr><th style="width: 190px;">כתובת</th><td>${escapeHtml(data.siteAddress)}</td></tr>
          <tr><th>גוש</th><td>${escapeHtml(data.siteBlock)}</td></tr>
          <tr><th>חלקה</th><td>${escapeHtml(data.siteParcel)}</td></tr>
        </tbody>
      </table>

      <table class="doc-table">
        <thead>
          <tr class="doc-section-row"><th colspan="3">האילנות המוגנים שאושרו או לא אושרו לכריתה/העתקה</th></tr>
          <tr>
            <th>שם</th>
            <th style="width: 130px;">מספר אילנות</th>
            <th style="width: 140px;">כריתה או העתקה</th>
          </tr>
        </thead>
        <tbody>
          ${treesRowsHtml}
        </tbody>
      </table>

      <table class="doc-table">
        <thead>
          <tr class="doc-section-row"><th colspan="2">הסיבה שבשלה הוגשה הבקשה, שנדחתה, להוצאת רישיון כריתה/העתקה</th></tr>
        </thead>
        <tbody>
          ${reasonsRowsHtml}
        </tbody>
      </table>

      <table class="doc-table">
        <tbody>
          ${
            data.rejectionReasons
              ? `<tr><td><strong>נימוקי פקיד היערות האזורי לדחיית הבקשה:</strong><div class="doc-arguments-box">${escapeHtml(data.rejectionReasons)}</div></td></tr>`
              : ''
          }
          <tr>
            <td>
              <strong>הנימוקים להשגה המוגשת לפקיד היערות הממשלתי במשרד החקלאות וביטחון המזון:</strong>
              <div class="doc-arguments-box" style="margin-top: 6px;">${escapeHtml(data.appealArguments)}</div>
            </td>
          </tr>
          ${
            attachedFiles.length
              ? `<tr><td><strong>מסמכים מצורפים:</strong> ${attachedFiles.map((f) => escapeHtml(f.name)).join(', ')}</td></tr>`
              : ''
          }
        </tbody>
      </table>

      <p style="font-size: 0.9rem; margin: 12px 0;">
        * ידוע לי כי כל פרטי ההשגה, לרבות פרטי המשיג ופרטי ההתקשרות, מועברים לבעל הרישיון
      </p>

      <table class="doc-table">
        <tbody>
          <tr>
            <th style="width: 140px;">שם</th>
            <td>${escapeHtml(data.signatureName)}</td>
            <th style="width: 120px;">חתימה</th>
            <td style="width: 220px;">
              ${sigDataUrl ? `<img class="doc-sig-img" src="${sigDataUrl}" alt="חתימה" />` : '<em>לא נחתם</em>'}
            </td>
          </tr>
        </tbody>
      </table>
    `;

    // Update email link
    const subject = encodeURIComponent(
      `השגה על החלטת פקיד היערות האזורי - רישיון מס' ${data.licenseNumber}`
    );
    const body = encodeURIComponent(buildPlainText(data));
    document.getElementById('btnSendEmail').href = `mailto:trees@moag.gov.il?subject=${subject}&body=${body}`;
  }

  function openPreview(isSubmitted) {
    const data = collectFormData();
    renderOfficialDocument(data);
    submitSuccessBanner.classList.toggle('hidden', !isSubmitted);
    mainContainer.classList.add('hidden');
    previewSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Submit & Preview Actions ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    openPreview(true);
  });

  document.getElementById('btnPreviewOnly').addEventListener('click', () => {
    openPreview(false);
  });

  document.getElementById('btnBackToEdit').addEventListener('click', () => {
    previewSection.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btnPrintPdf').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btnCopyText').addEventListener('click', async () => {
    const text = buildPlainText(collectFormData());
    try {
      await navigator.clipboard.writeText(text);
      showToast('נוסח ההשגה הועתק ללוח');
    } catch {
      showToast('לא ניתן להעתיק אוטומטית בדפדפן זה');
    }
  });

  // ---------- Google Sheets (CSV) & Drive (.json) Share ----------
  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeCsvCell(val) {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  document.getElementById('btnDownloadSheetsCsv').addEventListener('click', () => {
    const headers = ['שם פרטי', 'שם משפחה', 'כתובת', 'כתובת מייל'];
    const rows = additionalAppellants.length
      ? additionalAppellants.map((p) => [p.firstName, p.lastName, p.address, p.email])
      : [['', '', '', '']];
    const csvLines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
    const bom = '\uFEFF';
    const license = document.getElementById('licenseNumber').value.trim() || 'appeal';
    downloadBlob(
      bom + csvLines.join('\r\n'),
      `מערערים-נוספים-${license}.csv`,
      'text/csv;charset=utf-8;'
    );
    showToast('קובץ תבנית Sheets (CSV) ירד למחשב — ניתן להעלות ל-Google Drive ולפתוח ב-Sheets');
  });

  const importModal = document.getElementById('importSheetsModal');
  const sheetsPasteInput = document.getElementById('sheetsPasteInput');
  const sheetsCsvFileInput = document.getElementById('sheetsCsvFileInput');

  function closeImportModal() {
    importModal.classList.add('hidden');
    sheetsPasteInput.value = '';
    sheetsCsvFileInput.value = '';
  }

  document.getElementById('btnOpenImportModal').addEventListener('click', () => {
    importModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseImportModal').addEventListener('click', closeImportModal);
  document.getElementById('btnCancelImportModal').addEventListener('click', closeImportModal);

  function parseCsvLine(line, delimiter) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function parseAppellantsText(rawText) {
    const clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean) return [];
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsed = [];
    lines.forEach((line, idx) => {
      const delimiter = line.includes('\t') ? '\t' : ',';
      const cols = parseCsvLine(line, delimiter);
      if (cols.length < 2) return;
      const first = (cols[0] || '').trim();
      const last = (cols[1] || '').trim();
      const address = (cols[2] || '').trim();
      const email = (cols[3] || '').trim();
      // Skip header row if present
      if (idx === 0 && (first.includes('שם פרטי') || email.includes('מייל'))) {
        return;
      }
      if (first || last || address || email) {
        parsed.push({ firstName: first, lastName: last, address, email });
      }
    });
    return parsed;
  }

  sheetsCsvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sheetsPasteInput.value = String(reader.result || '');
    };
    reader.readAsText(file, 'UTF-8');
  });

  document.getElementById('btnConfirmImportSheets').addEventListener('click', () => {
    const imported = parseAppellantsText(sheetsPasteInput.value);
    if (!imported.length) {
      showToast('לא נמצאו שורות תקינות לייבוא');
      return;
    }
    additionalAppellants.push(...imported);
    renderAdditionalAppellants();
    saveDraft();
    closeImportModal();
    showToast(`יובאו ${imported.length} מערערים נוספים לטופס`);
  });

  document.getElementById('btnExportJson').addEventListener('click', () => {
    const data = collectFormData();
    const license = data.licenseNumber || 'appeal';
    downloadBlob(
      JSON.stringify(data, null, 2),
      `טופס-השגה-${license}.json`,
      'application/json;charset=utf-8;'
    );
    showToast('קובץ הטופס נשמר — ניתן להעלות אותו ל-Google Drive ולשתף עם מערערים');
  });

  document.getElementById('importJsonInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        applyData(data);
        saveDraft();
        showToast('קובץ הטופס נטען בהצלחה');
      } catch {
        showToast('קובץ ה-JSON אינו תקין');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  });

  function parseJsonParam(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getUrlParamsData() {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return null;

    const data = {};
    const payload = parseJsonParam(params.get('data'));
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      Object.assign(data, payload);
    }

    const stringMappings = [
      ['licenseNumber', ['licenseNumber', 'license']],
      ['appealDate', ['appealDate']],
      ['siteAddress', ['siteAddress', 'address']],
      ['siteBlock', ['siteBlock', 'block']],
      ['siteParcel', ['siteParcel', 'parcel']],
      ['reasonOtherText', ['reasonOtherText']],
      ['rejectionReasons', ['rejectionReasons']],
      ['appealArguments', ['appealArguments', 'arguments']],
      ['mainFirstName', ['mainFirstName']],
      ['mainLastName', ['mainLastName']],
      ['mainId', ['mainId']],
      ['mainAddress', ['mainAddress']],
      ['mainPhone', ['mainPhone']],
      ['mainEmail', ['mainEmail']],
    ];

    for (const [targetKey, paramKeys] of stringMappings) {
      for (const key of paramKeys) {
        const val = params.get(key);
        if (val !== null && val !== '') {
          data[targetKey] = val;
          break;
        }
      }
    }

    const treesParam = params.get('trees');
    if (treesParam) {
      const parsedTrees = parseJsonParam(treesParam);
      if (Array.isArray(parsedTrees)) {
        data.trees = parsedTrees
          .filter((t) => t && typeof t === 'object')
          .map((t) => ({
            species: String(t.species || ''),
            count: Math.max(1, Number(t.count) || 1),
            action: t.action === 'העתקה' ? 'העתקה' : 'כריתה',
          }));
      }
    }

    const reasonsParam = params.get('reasons');
    if (reasonsParam) {
      const parsedReasons = parseJsonParam(reasonsParam);
      if (Array.isArray(parsedReasons)) {
        data.reasons = parsedReasons.map(String);
      } else {
        data.reasons = reasonsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    return Object.keys(data).length ? data : null;
  }

  // ---------- Init ----------
  setupCanvas();
  window.addEventListener('resize', () => {
    if (!hasSignature) setupCanvas();
  });

  let savedDraft = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      savedDraft = JSON.parse(saved);
    }
  } catch {
    // Fallback to sample data
  }

  const urlData = getUrlParamsData();
  let initialData = savedDraft || SAMPLE_DATA;
  if (urlData) {
    initialData = {
      ...(savedDraft || {}),
      ...urlData,
      appealDate: urlData.appealDate || getTodayFormatted(),
    };
  }

  applyData(initialData);
  if (urlData) {
    saveDraft();
    showToast('פרטי הרישיון נטענו אוטומטית מהקישור');
  }
})();
