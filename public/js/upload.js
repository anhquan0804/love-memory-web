/**
 * upload.js
 * Initialises upload handlers for two independent forms:
 *   1. Homepage upload  (#homeUploadZone …)
 *   2. Upload-page form (#uploadPageZone …)
 */

const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES  = 25 * 1024 * 1024; // 25 MB (matches server limit)

// ── Validation ─────────────────────────────────────────────
function validateFiles(files) {
  const errors = [];
  files.forEach((file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`"${file.name}" không đúng định dạng.`);
    } else if (file.size > MAX_SIZE_BYTES) {
      errors.push(`"${file.name}" quá lớn (tối đa 10MB).`);
    }
  });
  return errors;
}

// ── Upload handler factory ─────────────────────────────────
/**
 * Attaches upload logic to a set of DOM elements identified by their IDs.
 * @param {{ zone, fileInput, browseBtn, uploadBtn, preview, status }} ids
 */
function initUploadForm({ zone, fileInput, browseBtn, uploadBtn, preview, status, progressBar, progressEl }) {
  const elZone      = document.getElementById(zone);
  const elInput     = document.getElementById(fileInput);
  const elBrowse    = document.getElementById(browseBtn);
  const elBtn       = document.getElementById(uploadBtn);
  const elPreview   = document.getElementById(preview);
  const elStatus    = document.getElementById(status);
  const elProgress  = document.getElementById(progressEl);
  const elBar       = document.getElementById(progressBar);

  if (!elZone || !elInput) return; // guard: element not in DOM

  let selectedFiles = [];

  function setStatus(msg, type = '') {
    elStatus.textContent = msg;
    elStatus.className   = `upload-status${type ? ' ' + type : ''}`;
  }

  function renderPreviews(files) {
    elPreview.innerHTML = '';
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img    = document.createElement('img');
        img.src      = e.target.result;
        img.className = 'preview-thumb';
        img.alt      = file.name;
        elPreview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleFilesSelected(rawFiles) {
    setStatus('');
    const files  = Array.from(rawFiles);
    const errors = validateFiles(files);

    if (errors.length > 0) {
      setStatus(errors.join(' '), 'error');
      selectedFiles    = [];
      elPreview.innerHTML = '';
      elBtn.disabled   = true;
      return;
    }

    selectedFiles   = files;
    elBtn.disabled  = files.length === 0;
    renderPreviews(files);
  }

  // Click to browse
  elBrowse.addEventListener('click', () => elInput.click());
  elZone.addEventListener('click', (e) => { if (e.target !== elBrowse) elInput.click(); });
  elInput.addEventListener('change', () => handleFilesSelected(elInput.files));

  // Drag and drop
  elZone.addEventListener('dragover',  (e) => { e.preventDefault(); elZone.classList.add('drag-over'); });
  elZone.addEventListener('dragleave', () => elZone.classList.remove('drag-over'));
  elZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elZone.classList.remove('drag-over');
    handleFilesSelected(e.dataTransfer.files);
  });

  function setProgress(pct) {
    if (!elProgress || !elBar) return;
    if (pct === null) {
      elProgress.classList.remove('visible');
      elBar.style.width = '0%';
    } else {
      elProgress.classList.add('visible');
      elBar.style.width = pct + '%';
    }
  }

  // Upload using XHR for progress tracking
  elBtn.addEventListener('click', () => {
    if (selectedFiles.length === 0) return;

    elBtn.disabled = true;
    setStatus('Đang tải lên…');
    setProgress(0);

    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append('images', f));

    const xhr = new XMLHttpRequest();

    // Track upload progress (bytes sent to server)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
        if (pct < 100) setStatus(`Đang tải lên… ${pct}%`);
        else setStatus('Đang xử lý ảnh…');
      }
    });

    xhr.addEventListener('load', () => {
      setProgress(null);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setStatus(`Đã tải lên ${data.files.length} ảnh!`, 'success');
          selectedFiles       = [];
          elInput.value       = '';
          elPreview.innerHTML = '';
          elBtn.disabled      = true;
          if (typeof window.refreshGallery === 'function') window.refreshGallery();
        } else {
          setStatus(data.error || 'Tải lên thất bại.', 'error');
          elBtn.disabled = false;
        }
      } catch {
        setStatus('Phản hồi không hợp lệ từ server.', 'error');
        elBtn.disabled = false;
      }
    });

    xhr.addEventListener('error', () => {
      setProgress(null);
      setStatus('Lỗi kết nối. Vui lòng thử lại.', 'error');
      elBtn.disabled = false;
    });

    xhr.addEventListener('timeout', () => {
      setProgress(null);
      setStatus('Quá thời gian. Ảnh có thể đã được lưu — hãy tải lại trang để kiểm tra.', 'error');
      elBtn.disabled = false;
    });

    xhr.open('POST', '/api/upload');
    xhr.timeout = 300000; // 5 minutes
    xhr.send(formData);
  });
}

// ── Init both forms ────────────────────────────────────────
initUploadForm({
  zone:        'homeUploadZone',
  fileInput:   'homeFileInput',
  browseBtn:   'homeBrowseBtn',
  uploadBtn:   'homeUploadBtn',
  preview:     'homeUploadPreview',
  status:      'homeUploadStatus',
  progressEl:  'homeUploadProgress',
  progressBar: 'homeUploadProgressBar',
});

initUploadForm({
  zone:        'uploadPageZone',
  fileInput:   'uploadPageFileInput',
  browseBtn:   'uploadPageBrowseBtn',
  uploadBtn:   'uploadPageBtn',
  preview:     'uploadPagePreview',
  status:      'uploadPageStatus',
  progressEl:  'uploadPageProgress',
  progressBar: 'uploadPageProgressBar',
});
