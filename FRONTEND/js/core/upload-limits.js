export const MAX_UPLOAD_BYTES = 1024 * 1024;
const PRESERVED_IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp']);

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

function canvasBlob(canvas,type,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(blob)resolve(blob);
      else reject(new Error('Could not compress this image.'));
    },type,quality);
  });
}

async function bestCanvasBlob(canvas,type){
  const maximumQuality=0.94;
  const minimumQuality=0.55;
  let best=await canvasBlob(canvas,type,maximumQuality);
  if(best.type!==type)return null;
  if(best.size<=MAX_UPLOAD_BYTES)return {blob:best,quality:maximumQuality};

  best=await canvasBlob(canvas,type,minimumQuality);
  if(best.type!==type||best.size>MAX_UPLOAD_BYTES)return null;
  let low=minimumQuality,high=maximumQuality;
  for(let attempt=0;attempt<6;attempt++){
    const quality=(low+high)/2;
    const candidate=await canvasBlob(canvas,type,quality);
    if(candidate.size<=MAX_UPLOAD_BYTES){
      best=candidate;
      low=quality;
    }else{
      high=quality;
    }
  }
  return {blob:best,quality:low};
}

async function compressCanvas(canvas){
  if(!canvas.getContext('2d'))throw new Error('Image compression is not available in this browser.');
  const scales=[1,0.85,0.72,0.61,0.52,0.44,0.37,0.31,0.26,0.22,0.18,0.15,0.12,0.1];
  const minimumDimension=Math.min(1200,Math.max(canvas.width,canvas.height));
  for(const scale of scales){
    const width=Math.max(1,Math.round(canvas.width*scale));
    const height=Math.max(1,Math.round(canvas.height*scale));
    if(Math.max(width,height)<minimumDimension)break;
    const output=document.createElement('canvas');
    output.width=width;
    output.height=height;
    const outputContext=output.getContext('2d');
    if(!outputContext)throw new Error('Image compression is not available in this browser.');
    outputContext.fillStyle='#fff';
    outputContext.fillRect(0,0,width,height);
    outputContext.drawImage(canvas,0,0,width,height);
    const candidates=await Promise.all(
      ['image/webp','image/jpeg'].map(type=>bestCanvasBlob(output,type))
    );
    const best=candidates.filter(Boolean).sort((a,b)=>b.quality-a.quality||b.blob.size-a.blob.size)[0];
    if(best)return readAsDataUrl(best.blob);
  }
  throw new Error('This image cannot be compressed below 1 MB while keeping readable quality. Choose a smaller image file.');
}

export async function compressImageFile(file){
  if(!file?.type?.startsWith('image/'))throw new Error('Choose an image file.');
  if(file.size<=MAX_UPLOAD_BYTES&&PRESERVED_IMAGE_TYPES.has(file.type))return readAsDataUrl(file);
  const image=await loadImage(file);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,image.naturalWidth);
  canvas.height=Math.max(1,image.naturalHeight);
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
    if(file.size>MAX_UPLOAD_BYTES)throw new Error('PDFs must be no larger than 1 MB.');
    return readAsDataUrl(file);
  }
  throw new Error('Upload an image or a PDF no larger than 1 MB.');
}
