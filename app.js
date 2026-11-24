const MAX_SIZE = 2 * 1024 * 1024 * 1024;
const createInput = document.querySelector('#createInput');
const extractInput = document.querySelector('#extractInput');
const createButton = document.querySelector('#createButton');
const extractButton = document.querySelector('#extractButton');
const createList = document.querySelector('#createList');
const extractList = document.querySelector('#extractList');
const status = document.querySelector('#status');
let filesToZip = [];
let zipFile = null;

const formatSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : bytes < 1073741824 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1073741824).toFixed(2)} GB`;

function setStatus(message) { status.textContent = message; }

function renderFiles(target, files) {
  target.replaceChildren(...files.map(file => {
    const row = document.createElement('div');
    row.className = 'file-row';
    const name = document.createElement('span');
    name.textContent = file.name;
    const size = document.createElement('span');
    size.textContent = formatSize(file.size);
    row.append(name, size);
    return row;
  }));
}

function validateSize(files) {
  const total = [...files].reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_SIZE) {
    setStatus('The 2 GB size limit was exceeded.');
    return false;
  }
  return true;
}

createInput.addEventListener('change', () => {
  filesToZip = [...createInput.files];
  if (!validateSize(filesToZip)) { filesToZip = []; }
  renderFiles(createList, filesToZip);
  createButton.disabled = filesToZip.length === 0;
});

extractInput.addEventListener('change', () => {
  zipFile = extractInput.files[0] || null;
  if (zipFile && zipFile.size > MAX_SIZE) {
    setStatus('The 2 GB size limit was exceeded.');
    zipFile = null;
  }
  renderFiles(extractList, zipFile ? [zipFile] : []);
  extractButton.disabled = !zipFile;
});

function uniqueName(name) {
  return name.replace(/^([\\/]+)|\\\.\.[\\/]/g, '').replace(/[/\\]+/g, '/');
}

createButton.addEventListener('click', async () => {
  if (!filesToZip.length) return;
  createButton.disabled = true;
  setStatus('Creating ZIP…');
  try {
    const zip = new JSZip();
    for (const file of filesToZip) zip.file(file.webkitRelativePath || file.name, file);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, streamFiles: true }, metadata => {
      setStatus(`Creating ZIP… ${Math.round(metadata.percent)}%`);
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'archive.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus('ZIP downloaded.');
  } catch (error) {
    setStatus(`Could not create ZIP: ${error.message}`);
  } finally {
    createButton.disabled = false;
  }
});

extractButton.addEventListener('click', async () => {
  if (!zipFile) return;
  extractButton.disabled = true;
  setStatus('Reading ZIP…');
  try {
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files).filter(entry => !entry.dir);
    if (!entries.length) throw new Error('The archive is empty');

    for (const entry of entries) {
      const safeName = uniqueName(entry.name);
      if (!safeName) continue;
      const blob = await entry.async('blob');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = safeName.split('/').pop();
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setStatus(`Extracted ${entries.length} file(s).`);
  } catch (error) {
    setStatus(`Could not extract ZIP: ${error.message}`);
  } finally {
    extractButton.disabled = false;
  }
});

for (const [panel, tab] of [['create', 'create'], ['extract', 'extract']]) {
  document.querySelector(`[data-tab="${tab}"]`).addEventListener('click', event => {
    document.querySelectorAll('.tab').forEach(button => button.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelector('#createPanel').classList.toggle('hidden', panel !== 'create');
    document.querySelector('#extractPanel').classList.toggle('hidden', panel !== 'extract');
    setStatus('');
  });
}

for (const id of ['createDropzone', 'extractDropzone']) {
  const zone = document.querySelector(`#${id}`);
  for (const eventName of ['dragenter', 'dragover']) zone.addEventListener(eventName, event => { event.preventEvent; event.preventDefault(); zone.classList.add('drag'); });
  for (const eventName of ['dragleave', 'drop']) zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.remove('drag'); });
  zone.addEventListener('drop', event => {
    const input = zone.querySelector('input');
    const dt = new DataTransfer();
    [...event.dataTransfer.files].forEach(file => dt.items.add(file));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
}

document.querySelector('#themeButton').addEventListener('click', () => document.body.classList.toggle('dark'));
