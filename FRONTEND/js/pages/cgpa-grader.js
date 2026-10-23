const GRADE_POINTS = { O:10, 'A+':9, A:8, 'B+':7, B:6, C:5, P:4, F:0 };
let courseId = 0;

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function addCourse(credits = '', grade = ''){
  const list = document.getElementById('cgpa-course-list');
  if(!list) return;
  const id = ++courseId;
  const row = document.createElement('div');
  row.className = 'cgpa-course-row';
  row.dataset.courseId = String(id);
  row.innerHTML = `
    <div class="cgpa-course-index"><span class="cgpa-mobile-label">Course</span><strong>Course ${id}</strong></div>
    <label class="cgpa-field cgpa-credit-field"><span class="cgpa-mobile-label">Credits</span><input type="number" class="cgpa-course-credits" placeholder="4" min="0.5" max="30" step="0.5" value="${escapeHtml(credits)}" aria-label="Credits for course ${id}"></label>
    <label class="cgpa-field cgpa-grade-field"><span class="cgpa-mobile-label">Grade secured</span><select class="cgpa-course-grade" aria-label="Grade secured for course ${id}"><option value="">Select grade</option>${Object.keys(GRADE_POINTS).map(g => `<option value="${g}" ${g===grade?'selected':''}>${g}</option>`).join('')}</select></label>
    <button type="button" class="cgpa-remove-course" aria-label="Remove course ${id}" title="Remove course">×</button>`;
  list.appendChild(row);
  updateCourseCount();
  row.querySelector('.cgpa-remove-course').addEventListener('click',()=>{
    if(list.children.length === 1){
      row.querySelector('.cgpa-course-credits').value='';
      row.querySelector('.cgpa-course-grade').value='';
    }else row.remove();
    renumberCourses();
    updateCourseCount();
    clearResult();
  });
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',clearResult));
}
function renumberCourses(){
  [...document.querySelectorAll('#cgpa-course-list .cgpa-course-row')].forEach((row,index)=>{
    const number=index+1;
    const label=row.querySelector('.cgpa-course-index strong');
    if(label) label.textContent=`Course ${number}`;
    row.dataset.courseId=String(number);
    row.querySelector('.cgpa-course-credits')?.setAttribute('aria-label',`Credits for course ${number}`);
    row.querySelector('.cgpa-course-grade')?.setAttribute('aria-label',`Grade secured for course ${number}`);
    row.querySelector('.cgpa-remove-course')?.setAttribute('aria-label',`Remove course ${number}`);
  });
  courseId=document.querySelectorAll('#cgpa-course-list .cgpa-course-row').length;
}

function updateCourseCount(){
  const count = document.querySelectorAll('#cgpa-course-list .cgpa-course-row').length;
  const el = document.getElementById('cgpa-course-count');
  if(el) el.textContent = `${count} course${count===1?'':'s'} added`;
}
function clearResult(){
  const result=document.getElementById('cgpa-result');
  if(!result)return;
  result.innerHTML='—<small>/ 10</small>';
  document.getElementById('cgpa-result-bar').style.width='0%';
  document.getElementById('cgpa-result-caption').textContent='Calculate again to update your result.';
  document.getElementById('cgpa-total-credits').textContent='—';
  document.getElementById('cgpa-total-courses').textContent='—';
  document.getElementById('cgpa-message').textContent='';
}
function calculate(){
  const rows=[...document.querySelectorAll('#cgpa-course-list .cgpa-course-row')];
  let weighted=0,totalCredits=0,count=0;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    const creditText=row.querySelector('.cgpa-course-credits').value;
    const grade=row.querySelector('.cgpa-course-grade').value;
    const credits=Number(creditText);
    const touched=!!(creditText||grade);
    if(!touched) continue;
    if(!creditText||!Number.isFinite(credits)||credits<=0||credits>30||!grade){
      document.getElementById('cgpa-message').textContent=`Please enter valid credits and select a grade for Course ${i+1}.`;
      row.querySelector(!creditText||!Number.isFinite(credits)||credits<=0||credits>30?'.cgpa-course-credits':'.cgpa-course-grade').focus();
      return;
    }
    weighted += credits*GRADE_POINTS[grade]; totalCredits += credits; count++;
  }
  if(!count){document.getElementById('cgpa-message').textContent='Add at least one course before calculating your CGPA.';return;}
  const cgpa=weighted/totalCredits;
  document.getElementById('cgpa-result').innerHTML=`${cgpa.toFixed(2)}<small>/ 10</small>`;
  document.getElementById('cgpa-result-bar').style.width=`${cgpa*10}%`;
  document.getElementById('cgpa-result-caption').textContent=cgpa>=9?'Outstanding work — keep it up!':cgpa>=8?'Great progress. Keep building on it!':cgpa>=7?'Good progress — you are moving forward.':cgpa>=5?'A solid base to build on. Keep improving!':'Keep going — every semester is a fresh opportunity.';
  document.getElementById('cgpa-total-credits').textContent=Number(totalCredits.toFixed(2)).toString();
  document.getElementById('cgpa-total-courses').textContent=String(count);
  document.getElementById('cgpa-message').textContent=`CGPA calculated from ${count} course${count===1?'':'s'}.`;
}

const PREDICTOR_GRADES = [
  { grade:'F', min:0 }, { grade:'P', min:50 }, { grade:'C', min:55 },
  { grade:'B', min:65 }, { grade:'B+', min:75 }, { grade:'A', min:85 },
  { grade:'A+', min:90 }, { grade:'O', min:91 }
];
const formatMarks = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
function predictGrade(){
  const input=document.getElementById('cgpa-internal-marks');
  const message=document.getElementById('cgpa-predict-message');
  const result=document.getElementById('cgpa-prediction-result');
  const internal=Number(input?.value);
  const targetIndex=Number(document.getElementById('cgpa-target-grade')?.value||0);
  const target=PREDICTOR_GRADES[targetIndex] || PREDICTOR_GRADES[0];
  if(input?.value==='' || !Number.isFinite(internal) || internal<0 || internal>60){
    message.textContent='Enter internal marks from 0 to 60.';
    input?.focus();
    return;
  }
  message.textContent='';
  result.classList.add('is-calculated');
  const requiredContribution=Math.max(0,target.min-internal);
  const requiredExam=Math.ceil((requiredContribution*75/40)*10)/10;
  document.getElementById('cgpa-target-total').textContent=String(target.min);
  if(requiredContribution===0){
    document.getElementById('cgpa-required-exam').innerHTML=`0<small>/ 75 external marks</small>`;
    document.getElementById('cgpa-exam-contribution').textContent='0 / 40';
    document.getElementById('cgpa-prediction-caption').textContent=`Your internal marks already meet the minimum overall marks for grade ${target.grade}. Aim higher in the exam to improve your final result.`;
  }else if(requiredExam>75){
    document.getElementById('cgpa-required-exam').innerHTML=`Not possible<small> this exam</small>`;
    document.getElementById('cgpa-exam-contribution').textContent=`${requiredContribution} / 40 needed`;
    document.getElementById('cgpa-prediction-caption').textContent=`Even 75/75 in the external exam adds the full 40 marks. With ${internal} internal marks, grade ${target.grade} needs ${target.min} overall marks.`;
  }else{
    document.getElementById('cgpa-required-exam').innerHTML=`${formatMarks(requiredExam)}<small>/ 75 external marks</small>`;
    document.getElementById('cgpa-exam-contribution').textContent=`${formatMarks(requiredExam*40/75)} / 40`;
    document.getElementById('cgpa-prediction-caption').textContent=`Aim for at least ${formatMarks(requiredExam)}/75 in the external exam. Your score out of 75 is converted to 40 marks and added to your internal score.`;
  }
}

export function mount(){
  const list=document.getElementById('cgpa-course-list');
  if(!list || list.dataset.mounted==='true') return;
  list.dataset.mounted='true';
  courseId=0;
  addCourse();
  document.getElementById('cgpa-add-course')?.addEventListener('click',()=>addCourse());
  document.getElementById('cgpa-calculate')?.addEventListener('click',calculate);
  const modal=document.getElementById('cgpa-reference-modal');
  const open=()=>{modal.hidden=false;document.getElementById('cgpa-close-reference')?.focus();};
  const close=()=>{modal.hidden=true;document.getElementById('cgpa-grade-reference')?.focus();};
  document.getElementById('cgpa-grade-reference')?.addEventListener('click',open);
  document.getElementById('cgpa-close-reference')?.addEventListener('click',close);
  modal?.addEventListener('click',e=>{if(e.target===modal)close();});
  document.addEventListener('keydown',function closeOnEscape(e){if(e.key==='Escape'&&modal&&!modal.hidden)close();});
  const calcTab=document.getElementById('cgpa-tab-calculator');
  const predictorTab=document.getElementById('cgpa-tab-predictor');
  const calcView=document.getElementById('cgpa-calculator-view');
  const predictorView=document.getElementById('cgpa-predictor-view');
  const switchTab=(predictor)=>{
    calcView.hidden=predictor;
    predictorView.hidden=!predictor;
    calcTab.classList.toggle('active',!predictor);
    predictorTab.classList.toggle('active',predictor);
    calcTab.setAttribute('aria-selected',String(!predictor));
    predictorTab.setAttribute('aria-selected',String(predictor));
  };
  calcTab?.addEventListener('click',()=>switchTab(false));
  predictorTab?.addEventListener('click',()=>switchTab(true));
  const targetSlider=document.getElementById('cgpa-target-grade');
  targetSlider?.addEventListener('input',()=>{
    const g=PREDICTOR_GRADES[Number(targetSlider.value)]?.grade||'F';
    document.getElementById('cgpa-target-grade-label').textContent=g;
    document.getElementById('cgpa-predict-message').textContent='';
  });
  document.getElementById('cgpa-predict-grade')?.addEventListener('click',predictGrade);
}
