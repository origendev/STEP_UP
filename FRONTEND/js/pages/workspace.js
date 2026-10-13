import { api, getToken } from '../core/api.js';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const CDN = {
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
  docx: 'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
};
const loaded = new Map();
function loadLib(name){
  if(loaded.has(name)) return loaded.get(name);
  const p = new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src=CDN[name]; script.async=true;
    script.onload=()=>resolve(); script.onerror=()=>{loaded.delete(name);reject(new Error(`Could not load ${name} library. Check your internet connection and try again.`));};
    document.head.appendChild(script);
  }); loaded.set(name,p); return p;
}
function alertUser(message, error=false){const el=$('#ws-alert'); if(!el)return;el.textContent=message;el.classList.toggle('error',error);el.hidden=false;}
function clearAlert(){const el=$('#ws-alert');if(el)el.hidden=true;}
function bytesLabel(n){return n<1024?`${n} B`:`${(n/1024).toFixed(1)} KB`;}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function baseName(name){return name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_')||'file';}
function readDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read the selected file.'));r.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This image could not be opened.'));img.src=src;});}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not encode the image. Try PNG or a smaller image.')),type,quality));}
function blobDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});}

let notes=[], selectedId=null, attached=[];
const NOTES_KEY='stepup-workspace-notes-v1';
async function loadNotes(){
  try { const v=JSON.parse(localStorage.getItem(NOTES_KEY)||'[]'); notes=Array.isArray(v)?v:[]; } catch { notes=[]; }
  if(getToken()) {
    try { const r=await api('/student/workspace/notes'); if(Array.isArray(r.data)){ if(r.data.length){notes=r.data;saveNotesLocal();} else if(notes.length){await api('/student/workspace/notes',{method:'PUT',body:JSON.stringify({notes})});} } }
    catch { /* offline/local fallback remains available */ }
  }
  if(!notes.length) notes=[{id:crypto.randomUUID(),title:'Welcome to Workspace',body:'Create notes and attach screenshots. Sign in to sync notes to your STEP_UP account; otherwise they remain in this browser.',images:[],checklist:[],updated:Date.now()}];
  selectedId=notes[0]?.id||null; renderNotes();
}
function saveNotesLocal(){try{localStorage.setItem(NOTES_KEY,JSON.stringify(notes));return true;}catch{return false;}}
async function saveNotesStore(){
  const localOk=saveNotesLocal();
  if(getToken()) { try { await api('/student/workspace/notes',{method:'PUT',body:JSON.stringify({notes})}); return true; } catch(e) { if(!localOk) throw e; throw new Error(`Saved on this device, but account sync failed: ${e.message}`); } }
  return localOk;
}
async function serverConvert(file,to){
  if(!getToken()) throw new Error('Sign in to STEP_UP to use the server conversion engine.');
  const data=await readDataUrl(file);
  const r=await api('/student/workspace/convert',{method:'POST',body:JSON.stringify({filename:file.name,mimeType:file.type,data,to})});
  const raw=atob(r.data), bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return {blob:new Blob([bytes],{type:r.mimeType}),filename:r.filename};
}
function renderNotes(){const list=$('#ws-note-list');if(!list)return;list.innerHTML='';notes.sort((a,b)=>b.updated-a.updated).forEach(n=>{const b=document.createElement('button');b.className='ws-note-item'+(n.id===selectedId?' active':'');const strong=document.createElement('strong');strong.textContent=n.title||'Untitled note';const small=document.createElement('small');small.textContent=new Date(n.updated||Date.now()).toLocaleString();b.append(strong,small);b.addEventListener('click',()=>{readNoteEditor();selectedId=n.id;renderNotes();});list.appendChild(b);});if(!notes.length){list.innerHTML='<p class="ws-small">No notes yet. Create your first note.</p>';}
  const n=notes.find(x=>x.id===selectedId);if(n){n.checklist=n.checklist||[];}$('#ws-note-title').value=n?.title||'';$('#ws-note-body').value=n?.body||'';attached=[...(n?.images||[])];renderAttached();renderChecklist(n);$('#ws-delete-note').disabled=!n;}
function readNoteEditor(){const n=notes.find(x=>x.id===selectedId);if(!n)return;n.title=$('#ws-note-title').value;n.body=$('#ws-note-body').value;n.images=[...attached];n.updated=Date.now();}
function ensurePreview(){let modal=$('#ws-preview-modal');if(modal)return modal;modal=document.createElement('div');modal.id='ws-preview-modal';modal.className='ws-preview-modal';modal.hidden=true;modal.innerHTML='<div class="ws-preview-dialog" role="dialog" aria-modal="true" aria-label="File preview"><div class="ws-preview-toolbar"><strong id="ws-preview-name">Preview</strong><div><a id="ws-preview-open" target="_blank" rel="noopener">Open original</a><a id="ws-preview-download" download>Download</a><button type="button" id="ws-preview-close" aria-label="Close preview">✕</button></div></div><div id="ws-preview-content" class="ws-preview-content"></div></div>';document.body.appendChild(modal);const close=()=>{modal.hidden=true;$('#ws-preview-content').replaceChildren();};$('#ws-preview-close',modal).addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();});return modal;}
function openFilePreview(src,name,mime=''){const modal=ensurePreview(),content=$('#ws-preview-content'),open=$('#ws-preview-open'),download=$('#ws-preview-download');$('#ws-preview-name').textContent=name||'File preview';content.replaceChildren();open.href=src;download.href=src;download.download=name||'download';if(mime.startsWith('image/')||/^data:image\//i.test(src)){const img=document.createElement('img');img.src=src;img.alt=name||'Attached image';content.appendChild(img);}else if(mime==='application/pdf'||/\.pdf($|[?#])/i.test(name)){const frame=document.createElement('iframe');frame.src=src;frame.title=name||'PDF preview';content.appendChild(frame);}else{const message=document.createElement('p');message.textContent='This file type cannot be previewed directly in the browser. Open the original file or download it to view it.';content.appendChild(message);}modal.hidden=false;}
function renderAttached(){const host=$('#ws-note-images');if(!host)return;host.innerHTML='';attached.forEach((src,i)=>{const f=document.createElement('figure'),img=document.createElement('img'),btn=document.createElement('button');img.src=src;img.alt=`Attached screenshot ${i+1}`;img.title='Click to view full size';img.tabIndex=0;img.style.cursor='zoom-in';img.addEventListener('click',()=>openFilePreview(src,`Attached screenshot ${i+1}`,'image/*'));img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openFilePreview(src,`Attached screenshot ${i+1}`,'image/*');}});btn.type='button';btn.textContent='×';btn.title='Remove image';btn.addEventListener('click',()=>{attached.splice(i,1);renderAttached();});f.append(img,btn);host.appendChild(f);});}
async function addNoteImages(files){for(const f of files){if(!f.type.startsWith('image/'))continue;if(f.size>8*1024*1024){alertUser(`${f.name} is larger than 8 MB; it was skipped.`,true);continue;}attached.push(await readDataUrl(f));}renderAttached();}
async function pdfText(file){await loadLib('pdfjs');const lib=window.pdfjsLib;if(!lib)throw new Error('PDF text engine did not initialize.');lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';const doc=await lib.getDocument({data:await file.arrayBuffer()}).promise;let all='';for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();all+=content.items.map(x=>x.str).join(' ')+'\n\n';}return all.trim();}
async function ocrPdf(file){
  await loadLib('pdfjs'); await loadLib('tesseract');
  const pdfjs=window.pdfjsLib, Tesseract=window.Tesseract;
  if(!pdfjs||!Tesseract) throw new Error('OCR libraries could not initialize. Check your internet connection.');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
  if(doc.numPages>40) throw new Error('For browser stability, OCR is limited to 40 pages per run. Split this PDF and retry.');
  const worker=await Tesseract.createWorker('eng'); let output='';
  try {
    for(let i=1;i<=doc.numPages;i++){
      alertUser(`OCR processing page ${i} of ${doc.numPages}…`);
      const page=await doc.getPage(i), viewport=page.getViewport({scale:1.6});
      const canvas=document.createElement('canvas'); canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      await page.render({canvasContext:ctx,viewport}).promise;
      const result=await worker.recognize(canvas); output+=`\n--- Page ${i} ---\n${result.data.text.trim()}\n`;
      canvas.width=canvas.height=1;
    }
  } finally { await worker.terminate(); }
  return output.trim();
}
async function imageFilesToPdf(files,filename){if(!files.length)throw new Error('Choose at least one image first.');await loadLib('jspdf');const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'p',unit:'pt',format:'a4'});for(let i=0;i<files.length;i++){const data=await readDataUrl(files[i]);const img=await loadImage(data);if(i)pdf.addPage();const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight(),pad=24,scale=Math.min((w-pad*2)/img.width,(h-pad*2)/img.height);const iw=img.width*scale,ih=img.height*scale;pdf.addImage(data,files[i].type==='image/png'?'PNG':'JPEG',(w-iw)/2,(h-ih)/2,iw,ih,undefined,'FAST');}pdf.save(filename);}


function installDropzones(){
  $$('input[type="file"]').forEach(input=>{
    const label=input.closest('.ws-file-button'); if(!label || label.dataset.dropReady) return;
    label.dataset.dropReady='1'; label.classList.add('ws-dropzone');
    const hint=document.createElement('span'); hint.className='ws-drop-hint'; hint.textContent=' · click or drag files here'; label.appendChild(hint);
    let preview=label.parentElement.querySelector(`[data-file-preview="${input.id}"]`);
    if(!preview){preview=document.createElement('div');preview.className='ws-file-preview';preview.dataset.filePreview=input.id;label.insertAdjacentElement('afterend',preview);}
    const showFiles=()=>{preview.replaceChildren();[...(input.files||[])].forEach((f,index)=>{const row=document.createElement('div');row.className='ws-file-preview-row';const info=document.createElement('button');info.type='button';info.className='ws-file-preview-info';info.setAttribute('aria-label',`Preview ${f.name}`);const name=document.createElement('strong');name.textContent=f.name;const meta=document.createElement('span');meta.textContent=`${f.type||'Unknown file type'} · ${bytesLabel(f.size)} · Click to preview`;info.append(name,meta);info.addEventListener('click',()=>{const url=URL.createObjectURL(f);openFilePreview(url,f.name,f.type);});const remove=document.createElement('button');remove.type='button';remove.className='ws-file-remove';remove.textContent='×';remove.title=`Remove ${f.name}`;remove.setAttribute('aria-label',`Remove ${f.name}`);remove.addEventListener('click',()=>{try{const dt=new DataTransfer();[...(input.files||[])].forEach((file,i)=>{if(i!==index)dt.items.add(file);});input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}catch{alertUser('This browser could not remove that file. Please reselect the files.',true);}});row.append(info,remove);preview.appendChild(row);});preview.classList.toggle('has-files',!!input.files?.length);};
    input.addEventListener('change',showFiles); showFiles();
    ['dragenter','dragover'].forEach(type=>label.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();label.classList.add('drag-over');}));
    ['dragleave','drop'].forEach(type=>label.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();label.classList.remove('drag-over');}));
    label.addEventListener('drop',e=>{
      const dropped=[...(e.dataTransfer?.files||[])]; if(!dropped.length)return;
      const accepted=dropped.filter(file=>{const accept=(input.accept||'').toLowerCase();if(!accept)return true;return accept.split(',').some(rule=>{rule=rule.trim();return rule.startsWith('.')?file.name.toLowerCase().endsWith(rule):rule.endsWith('/*')?file.type.startsWith(rule.slice(0,-1)):file.type.toLowerCase()===rule;});});
      if(!accepted.length){alertUser('These file types are not supported by this tool.',true);return;}
      try{const dt=new DataTransfer();if(input.multiple)[...(input.files||[]),...accepted].forEach(f=>dt.items.add(f));else dt.items.add(accepted[0]);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));showFiles();alertUser(`${accepted.length} file(s) added. Check the file list before processing.`);}catch(err){alertUser('Your browser blocked drag-and-drop file assignment. Click the file area and select the files instead.',true);}
    });
  });
}
function currentNote(){return notes.find(n=>n.id===selectedId);}
function renderChecklist(note){
  const host=$('#ws-checklist-items'); if(!host)return; host.innerHTML='';
  (note?.checklist||[]).forEach((item,index)=>{
    const li=document.createElement('li'); li.className='ws-check-item';
    const label=document.createElement('label'), cb=document.createElement('input'), text=document.createElement('span'), del=document.createElement('button');
    cb.type='checkbox'; cb.checked=!!item.done; cb.addEventListener('change',async()=>{item.done=cb.checked;note.updated=Date.now();await persistCurrentNote();renderChecklist(note);});
    text.textContent=item.text; if(item.done)text.classList.add('done');
    del.type='button';del.className='ws-icon-button';del.textContent='×';del.title='Remove checklist item';
    del.addEventListener('click',async()=>{note.checklist.splice(index,1);note.updated=Date.now();await persistCurrentNote();renderChecklist(note);});
    label.append(cb,text);li.append(label,del);host.append(li);
  });
}
async function persistCurrentNote(){
  const n=currentNote();if(!n)return;
  readNoteEditor();n.updated=Date.now();
  try{await saveNotesStore();}catch(e){alertUser(e.message||'Could not save note.',true);}
}
export function mount(){
  clearAlert();
  $$('[data-ws-tab]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-ws-tab]').forEach(b=>b.classList.toggle('active',b===btn));$$('[data-ws-panel]').forEach(p=>{const active=p.dataset.wsPanel===btn.dataset.wsTab;p.hidden=!active;p.classList.toggle('active',active);});clearAlert();}));
  $('#ws-make-pdf').addEventListener('click',async()=>{try{const files=[...$('#ws-images-pdf').files];await imageFilesToPdf(files,'stepup-images.pdf');alertUser(`Created a PDF from ${files.length} image(s).`);}catch(e){alertUser(e.message||'PDF creation failed.',true);}});
  $('#ws-word-pdf').addEventListener('click',async()=>{const f=$('#ws-word-pdf-file').files[0];if(!f){alertUser('Choose a Word .docx file first.',true);return;}try{const converted=await serverConvert(f,'pdf');downloadBlob(converted.blob,converted.filename);alertUser('Converted with the server office engine. Review page breaks, fonts, and images before using the PDF.');}catch(serverError){try{await loadLib('mammoth');await loadLib('jspdf');const result=await window.mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});const text=result.value.trim();if(!text)throw new Error('No readable text was found in this document.');const {jsPDF}=window.jspdf;const pdf=new jsPDF();const lines=pdf.splitTextToSize(text,170);let y=18;for(const line of lines){if(y>278){pdf.addPage();y=18;}pdf.text(line,20,y);y+=6;}pdf.save(`${baseName(f.name)}.pdf`);alertUser('Converted using text-only fallback. Review the result: layout, images and tables may not be preserved.',false);}catch(e){alertUser(e.message||serverError.message||'Word to PDF conversion failed.',true);}}});
  $('#ws-pdf-word').addEventListener('click',async()=>{const f=$('#ws-pdf-word-file').files[0];if(!f){alertUser('Choose a PDF file first.',true);return;}try{const converted=await serverConvert(f,'docx');downloadBlob(converted.blob,converted.filename);alertUser('Converted PDF to Word. PDF-to-Word conversion can alter layout; review the document carefully.');}catch(serverError){try{const text=await pdfText(f);if(!text)throw new Error('No selectable text was found. Try OCR on the Extract Text tab.');await loadLib('docx');const {Document,Packer,Paragraph,TextRun}=window.docx;const paras=text.split(/\n\s*\n/).map(t=>new Paragraph({children:[new TextRun(t)]}));const blob=await Packer.toBlob(new Document({sections:[{children:paras}]}));downloadBlob(blob,`${baseName(f.name)}.docx`);alertUser('Converted using text-only fallback. Review the result: layout and images are not preserved.',false);}catch(e){alertUser(e.message||serverError.message||'PDF to Word conversion failed.',true);}}});
  $('#ws-quality').addEventListener('input',e=>$('#ws-quality-value').textContent=`${e.target.value}%`);
  $('#ws-compress').addEventListener('click',async()=>{const f=$('#ws-compress-file').files[0];if(!f){alertUser('Choose an image first.',true);return;}try{const img=await loadImage(await readDataUrl(f));const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);const target=Number($('#ws-target-kb').value);let q=Number($('#ws-quality').value)/100;let blob=await canvasBlob(canvas,'image/jpeg',q);if(target>0){for(let i=0;i<10&&blob.size>target*1024&&q>0.12;i++){q=Math.max(.12,q*.78);blob=await canvasBlob(canvas,'image/jpeg',q);}if(blob.size>target*1024){let factor=Math.min(.9,Math.sqrt((target*1024)/blob.size)*.9);for(let i=0;i<5&&blob.size>target*1024;i++){canvas.width=Math.max(1,Math.floor(img.naturalWidth*factor));canvas.height=Math.max(1,Math.floor(img.naturalHeight*factor));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);blob=await canvasBlob(canvas,'image/jpeg',q);factor*=.85;}}}downloadBlob(blob,`${baseName(f.name)}-compressed.jpg`);const msg=`Actual output: ${bytesLabel(blob.size)}${target>0?` (target ${target} KB${blob.size>target*1024?' not reached':' reached'})`:''}. Dimensions: ${canvas.width} × ${canvas.height}.`;$('#ws-compress-result').textContent=msg;alertUser(msg,target>0&&blob.size>target*1024);}catch(e){alertUser(e.message||'Image compression failed.',true);}});
  $('#ws-format-convert').addEventListener('click',async()=>{const f=$('#ws-format-file').files[0];if(!f){alertUser('Choose an image first.',true);return;}try{const img=await loadImage(await readDataUrl(f));const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');if($('#ws-format').value==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(img,0,0);const type=$('#ws-format').value,blob=await canvasBlob(canvas,type,.92);downloadBlob(blob,`${baseName(f.name)}.${type==='image/png'?'png':'jpg'}`);alertUser(`Converted image. Actual output size: ${bytesLabel(blob.size)}.`);}catch(e){alertUser(e.message||'Image conversion failed.',true);}});
  $('#ws-extract').addEventListener('click',async()=>{const f=$('#ws-extract-file').files[0];if(!f){alertUser('Choose a PDF first.',true);return;}try{const text=await pdfText(f);$('#ws-extracted-text').value=text;if(!text)alertUser('No selectable text found. Try “OCR scanned PDF”.',true);else alertUser(`Extracted text from ${f.name}.`);}catch(e){alertUser(e.message||'Could not extract PDF text.',true);}});
  $('#ws-ocr').addEventListener('click',async()=>{const f=$('#ws-extract-file').files[0];if(!f){alertUser('Choose a PDF first.',true);return;}try{const text=await ocrPdf(f);$('#ws-extracted-text').value=text;if(!text)alertUser('OCR completed but found no readable text. Try a clearer scan.',true);else alertUser('OCR finished. Review the text for recognition errors.');}catch(e){alertUser(e.message||'OCR failed.',true);}});
  $('#ws-copy-text').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#ws-extracted-text').value);alertUser('Extracted text copied.');}catch{alertUser('Clipboard access was blocked. Select the text and copy it manually.',true);}});
  $('#ws-download-text').addEventListener('click',()=>{const text=$('#ws-extracted-text').value;if(!text){alertUser('Extract text from a PDF first.',true);return;}downloadBlob(new Blob([text],{type:'text/plain;charset=utf-8'}),'extracted-text.txt');});
  $('#ws-new-note').addEventListener('click',()=>{readNoteEditor();const n={id:crypto.randomUUID(),title:'',body:'',images:[],checklist:[],updated:Date.now()};notes.unshift(n);selectedId=n.id;attached=[];renderNotes();$('#ws-note-title').focus();});
  $('#ws-save-note').addEventListener('click',async()=>{readNoteEditor();try{const ok=await saveNotesStore();renderNotes();alertUser(ok?(getToken()?'Note saved and synced to your STEP_UP account.':'Note saved in this browser. Sign in to sync across devices.'):'Could not save note.',!ok);}catch(e){renderNotes();alertUser(e.message||'Could not save note.',true);}});
  $('#ws-delete-note').addEventListener('click',async()=>{if(!selectedId)return;const deleted=selectedId;notes=notes.filter(n=>n.id!==deleted);selectedId=notes[0]?.id||null;attached=[];saveNotesLocal();renderNotes();if(getToken()){try{await api(`/student/workspace/notes/${encodeURIComponent(deleted)}`,{method:'DELETE'});}catch(e){alertUser(`Deleted locally, but account sync failed: ${e.message}`,true);return;}}alertUser('Note deleted.');});
  const noteDrop=$('.ws-note-editor');if(noteDrop){['dragenter','dragover'].forEach(type=>noteDrop.addEventListener(type,e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();noteDrop.classList.add('ws-note-dragover');}}));['dragleave','drop'].forEach(type=>noteDrop.addEventListener(type,e=>{noteDrop.classList.remove('ws-note-dragover');if(type==='drop'&&e.dataTransfer?.files?.length){e.preventDefault();addNoteImages([...e.dataTransfer.files]).then(()=>alertUser('Dropped images attached to this note. Click Save note to keep them.')).catch(err=>alertUser(err.message,true));}}));}
  $('#ws-note-image-file').addEventListener('change',async e=>{try{await addNoteImages([...e.target.files]);if(e.target.files.length)alertUser('Images attached. Click Save note to keep them.');}catch(err){alertUser(err.message,true);}e.target.value='';});
  $('#ws-note-body').addEventListener('paste',async e=>{const files=[...(e.clipboardData?.items||[])].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();try{await addNoteImages(files);alertUser('Pasted image attached to this note. Save the note to keep it.');}catch(err){alertUser(err.message,true);}}});
  $('#ws-capture-screen').addEventListener('click',async()=>{if(!navigator.mediaDevices?.getDisplayMedia){alertUser('Screen capture is not supported by this browser.',true);return;}let stream;try{stream=await navigator.mediaDevices.getDisplayMedia({video:true});const video=document.createElement('video');video.srcObject=stream;await video.play();await new Promise(r=>setTimeout(r,250));const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);const blob=await canvasBlob(canvas,'image/jpeg',.82);await addNoteImages([new File([blob],'screenshot.jpg',{type:'image/jpeg'})]);alertUser('Screenshot attached. Save the note to keep it.');}catch(e){alertUser(e.name==='NotAllowedError'?'Screen capture was cancelled or permission was denied.':(e.message||'Could not capture the screen.'),true);}finally{stream?.getTracks().forEach(t=>t.stop());}});
  $('#ws-checklist-add')?.addEventListener('click',async()=>{const n=currentNote();const input=$('#ws-checklist-input');const text=input.value.trim();if(!n){alertUser('Create or select a note first.',true);return;}if(!text){alertUser('Enter a checklist item first.',true);return;}n.checklist=n.checklist||[];n.checklist.push({id:crypto.randomUUID(),text,done:false});input.value='';n.updated=Date.now();await persistCurrentNote();renderChecklist(n);});
  $('#ws-checklist-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#ws-checklist-add').click();}});
  
  installDropzones();
  loadNotes();
}
