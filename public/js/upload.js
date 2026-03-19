/**
 * upload.js
 * Initialises upload handlers for two independent forms:
 *   1. Homepage upload  (#homeUploadZone …)
 *   2. Upload-page form (#uploadPageZone …)
 */

const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES  = 10 * 1024 * 1024; // 10 MB

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
function initUploadForm({ zone, fileInput, browseBtn, uploadBtn, preview, status }) {
  const elZone      = document.getElementById(zone);
  const elInput     = document.getElementById(fileInput);
  const elBrowse    = document.getElementById(browseBtn);
  const elBtn       = document.getElementById(uploadBtn);
  const elPreview   = document.getElementById(preview);
  const elStatus    = document.getElementById(status);

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

  // Upload
  elBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    elBtn.disabled = true;
    setStatus('Đang tải lên…');

    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append('images', f));

    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Tải lên thất bại.', 'error');
        elBtn.disabled = false;
        return;
      }

      setStatus(`Đã tải lên ${data.files.length} ảnh!`, 'success');
      selectedFiles       = [];
      elInput.value       = '';
      elPreview.innerHTML = '';
      elBtn.disabled      = true;

      if (typeof window.refreshGallery === 'function') window.refreshGallery();
    } catch (err) {
      console.error('[Upload]', err.message);
      setStatus('Lỗi kết nối. Vui lòng thử lại.', 'error');
      elBtn.disabled = false;
    }
  });
}

// ── Init both forms ────────────────────────────────────────
initUploadForm({
  zone:       'homeUploadZone',
  fileInput:  'homeFileInput',
  browseBtn:  'homeBrowseBtn',
  uploadBtn:  'homeUploadBtn',
  preview:    'homeUploadPreview',
  status:     'homeUploadStatus',
});

initUploadForm({
  zone:       'uploadPageZone',
  fileInput:  'uploadPageFileInput',
  browseBtn:  'uploadPageBrowseBtn',
  uploadBtn:  'uploadPageBtn',
  preview:    'uploadPagePreview',
  status:     'uploadPageStatus',
});
