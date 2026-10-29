export const MAX_UPLOAD_BYTES = 10 * 1024;

function readAsDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Could not open this image. Choose a JPG, PNG, or WebP image.'))};
    image.src=url;
  });
}

function canvasBlob(canvas,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(blob)resolve(blob);
      else reject(new Error('Could not compress this image.'));
    },'image/jpeg',quality);
  });
}

async function compressCanvas(canvas){
  if(!canvas.getContext('2d'))throw new Error('Image compression is not available in this browser.');
  const original=canvas;
  for(let scale=1;scale>=0.18;scale*=0.75){
    const width=Math.max(1,Math.round(original.width*scale));
    const height=Math.max(1,Math.round(original.height*scale));
    const output=document.createElement('canvas');
    output.width=width;
    output.height=height;
    const outputContext=output.getContext('2d');
    outputContext.fillStyle='#fff';
    outputContext.fillRect(0,0,width,height);
    outputContext.drawImage(original,0,0,width,height);
    for(const quality of [0.72,0.55,0.4,0.28,0.16,0.08]){
      const blob=await canvasBlob(output,quality);
      if(blob.size<MAX_UPLOAD_BYTES)return readAsDataUrl(blob);
    }
  }
  throw new Error('This image cannot be made smaller than 10 KB while preserving a readable preview. Choose a simpler image.');
}

export async function compressImageFile(file){
  if(!file?.type?.startsWith('image/'))throw new Error('Choose an image file.');
  const image=await loadImage(file);
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight,1));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Image compression is not available in this browser.');
  context.fillStyle='#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return compressCanvas(canvas);
}

export function compressCanvasImage(canvas){
  return compressCanvas(canvas);
}

export async function prepareUploadFile(file){
  if(!file) return '';
  if(file.type.startsWith('image/'))return compressImageFile(file);
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    if(file.size>=MAX_UPLOAD_BYTES)throw new Error('PDFs must be smaller than 10 KB. Compress the PDF before uploading.');
    return readAsDataUrl(file);
  }
  throw new Error('Upload an image or a PDF smaller than 10 KB.');
}
