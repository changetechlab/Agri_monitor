/* ---- THEME ---- */
const themeBtn = document.getElementById('btn-toggle-theme');
const saved = localStorage.getItem('agriTheme')||'dark';
document.documentElement.setAttribute('data-theme', saved);
themeBtn.textContent = saved==='dark'?'☀️':'🌙';
themeBtn.addEventListener('click',()=>{
  const c=document.documentElement.getAttribute('data-theme');
  const n=c==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',n);
  localStorage.setItem('agriTheme',n);
  themeBtn.textContent=n==='dark'?'☀️':'🌙';
});

/* ---- TABS ---- */
document.querySelectorAll('.act-tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.act-tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.act-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.act).classList.add('active');
  });
});

/* ---- STORE ---- */
const STORE = 'mrv_records_v2';
const load = ()=>{ try{ return JSON.parse(localStorage.getItem(STORE))||[]; }catch(e){ return []; }};
const save = r=>localStorage.setItem(STORE,JSON.stringify(r));

/* ---- TOAST ---- */
function toast(msg,type='success'){
  const tc=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML=(type==='success'?'✅ ':'❌ ')+msg;
  tc.appendChild(t);
  setTimeout(()=>t.remove(),3800);
}

/* ---- GPS ---- */
function captureGPS(fieldId){
  if(!navigator.geolocation){ toast('Geolocation उपलब्ध नहीं','error'); return; }
  toast('📍 GPS ढूंढा जा रहा है...');
  navigator.geolocation.getCurrentPosition(p=>{
    document.getElementById(fieldId).value=`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`;
    toast(`📍 ${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)} — GPS captured`);
  },()=>toast('GPS access नहीं हो सकी।','error'));
}

/* ---- AWD IRRIGATION LOG ---- */
function addLogRow(){
  const cont=document.getElementById('irrigation-log-rows');
  const row=document.createElement('div');
  row.className='awd-period-row';
  row.innerHTML=`<input type="date" class="log-date form-input"><input type="number" class="log-depth form-input" placeholder="-5 to +10" step="0.5"><select class="log-status form-select"><option value="flooded">Flooded</option><option value="awd_moist">AWD Moist</option><option value="awd_dry">AWD Dry</option></select><input type="text" class="log-note form-input" placeholder="टिप्पणी"><button type="button" class="btn-remove-period" onclick="removeLogRow(this)">✕</button>`;
  cont.appendChild(row);
}
function removeLogRow(btn){
  if(document.querySelectorAll('.awd-period-row').length>1) btn.closest('.awd-period-row').remove();
}

/* ---- AWD ESTIMATE ---- */
function calcAWDEstimate(){
  const area=parseFloat(document.getElementById('awd-area-ha').value)||0;
  const seaDays=parseFloat(document.getElementById('awd-season-days').value)||0;
  const awdDays=parseFloat(document.getElementById('awd-awd-days').value)||0;
  const floodDays=parseFloat(document.getElementById('awd-flooded-days').value)||0;
  const efBase=parseFloat(document.getElementById('awd-ef-baseline').value)||1.30;

  if(area>0 && seaDays>0){
    // EF for AWD phase estimated at 50–65% of baseline (literature range)
    const efAWD = efBase * 0.60;
    const baseEmission   = efBase  * area * seaDays;
    const actualEmission = (efBase * area * floodDays) + (efAWD * area * awdDays);
    const reduction      = baseEmission - actualEmission;
    const co2eq          = reduction * 25; // GWP of CH4 = 25

    set('awd-est-baseline', baseEmission.toFixed(1), 'kg CH₄');
    set('awd-est-actual',   actualEmission.toFixed(1), 'kg CH₄');
    set('awd-est-reduction',reduction>0?reduction.toFixed(1):'0.0', 'kg CH₄');
    set('awd-est-co2eq',    co2eq>0?co2eq.toFixed(0):'0', 'kg CO₂e');
  } else {
    ['awd-est-baseline','awd-est-actual','awd-est-reduction','awd-est-co2eq'].forEach(id=>setDash(id));
  }
}
['awd-area-ha','awd-season-days','awd-flooded-days','awd-awd-days','awd-ef-baseline'].forEach(id=>{
  document.getElementById(id).addEventListener('input', calcAWDEstimate);
});

document.getElementById('awd-reset-btn').addEventListener('click',()=>{
  setTimeout(()=>{ calcAWDEstimate(); },10);
});

document.getElementById('form-awd').addEventListener('submit',e=>{
  e.preventDefault();
  const area=parseFloat(document.getElementById('awd-area-ha').value)||0;
  const seaDays=parseFloat(document.getElementById('awd-season-days').value)||0;
  const awdDays=parseFloat(document.getElementById('awd-awd-days').value)||0;
  const floodDays=parseFloat(document.getElementById('awd-flooded-days').value)||0;
  const efBase=parseFloat(document.getElementById('awd-ef-baseline').value)||1.30;
  const efAWD=efBase*0.60;
  const baseEmission=(efBase*area*seaDays);
  const actualEmission=(efBase*area*floodDays)+(efAWD*area*awdDays);
  const reduction=Math.max(0,baseEmission-actualEmission);
  const co2eq=reduction*25;
  const date=document.getElementById('awd-transplant-date').value||today();
  const rec={
    activity:'awd',id:document.getElementById('awd-field-id').value,
    farmer:document.getElementById('awd-farmer').value,
    main_value:`Area: ${area}ha | Season: ${seaDays}d | AWD: ${awdDays}d`,
    estimate:`↓${reduction.toFixed(1)} kg CH₄ (${co2eq.toFixed(0)} kg CO₂e)`,
    formula:'(EF_base−EF_awd) × Area × Days',
    est_methane:reduction,est_co2eq:co2eq,date,saved_at:new Date().toISOString()
  };
  const recs=load(); recs.push(rec); save(recs);
  updateKPIs(); renderTable('all');
  toast('AWD MRV Record सहेजा गया!');
  e.target.reset();
});

/* ---- SOC ESTIMATE ---- */
function calcSOCEstimate(){
  const concEls=[...document.querySelectorAll('.soc-conc')];
  const bdEls  =[...document.querySelectorAll('.soc-bd')];
  const baseEls=[...document.querySelectorAll('.soc-base')];
  const depths=[0.10,0.10,0.10];
  let currentStock=0, baselineStock=0;
  let anyData=false;
  concEls.forEach((el,i)=>{
    const c=parseFloat(el.value);
    const bd=parseFloat(bdEls[i].value)||1.25;
    const b=parseFloat(baseEls[i].value);
    if(!isNaN(c)){
      currentStock+=c*bd*depths[i]*100;
      anyData=true;
    }
    if(!isNaN(b)){ baselineStock+=b*bd*depths[i]*100; }
  });
  if(anyData){
    const delta=currentStock-baselineStock;
    const status=delta>0.5?'✅ SOC बढ़ा (Sequestration)':delta<-0.5?'⚠️ SOC घटा (Loss)':'➡️ स्थिर';
    set('soc-est-current', currentStock.toFixed(2), 't C/ha');
    set('soc-est-baseline', baselineStock>0?baselineStock.toFixed(2):'—', 't C/ha');
    document.getElementById('soc-est-delta').innerHTML=
      `<span style="color:${delta>0?'var(--green)':delta<0?'var(--red)':'var(--text-muted)'}">${delta>=0?'+':''}${delta.toFixed(2)}</span><span class="unit"> t C/ha</span>`;
    document.getElementById('soc-est-status').textContent=status;
  } else {
    ['soc-est-current','soc-est-baseline','soc-est-delta','soc-est-status'].forEach(id=>setDash(id));
  }
}

document.getElementById('form-soc').addEventListener('submit',e=>{
  e.preventDefault();
  const conc1=parseFloat(document.getElementById('soc-conc-1').value)||0;
  const bd1  =parseFloat(document.getElementById('soc-bd-1').value)||1.25;
  const stockApprox=(conc1*bd1*0.10*100).toFixed(2);
  const date=document.getElementById('soc-sample-date').value||today();
  const rec={
    activity:'soc',id:document.getElementById('soc-sample-id').value,
    farmer:document.getElementById('soc-farmer').value,
    main_value:`SOC: ${conc1}% @ 0–10cm | BD: ${bd1} g/cm³`,
    estimate:`Stock ≈ ${stockApprox} t C/ha (0–10cm layer)`,
    formula:'SOC × BD × depth × 100',
    date,saved_at:new Date().toISOString()
  };
  const recs=load(); recs.push(rec); save(recs);
  updateKPIs(); renderTable('all');
  toast('SOC MRV Record सहेजा गया!');
  e.target.reset();
  calcSOCEstimate();
});

/* ---- BIOCHAR FRACTION MODE ---- */
let fractionMode='default';
function setFractionMode(mode){
  fractionMode=mode;
  document.getElementById('frac-default-btn').classList.toggle('active',mode==='default');
  document.getElementById('frac-lab-btn').classList.toggle('active',mode==='lab');
  document.getElementById('frac-default-section').style.display=mode==='default'?'block':'none';
  document.getElementById('frac-lab-section').style.display=mode==='lab'?'block':'none';
  calcBiocharEstimate();
}

function getBiocharFraction(){
  if(fractionMode==='lab'){
    const v=parseFloat(document.getElementById('bc-lab-c-content').value);
    return !isNaN(v)?v/100:null;
  }
  return 0.50;
}

function calcBiocharEstimate(){
  const applied=parseFloat(document.getElementById('bc-application-weight').value)||0;
  const output =parseFloat(document.getElementById('bc-output-weight').value)||0;
  const input  =parseFloat(document.getElementById('bc-biomass-weight').value)||0;
  const frac   =getBiocharFraction();

  document.getElementById('bc-est-fraction').textContent=frac!==null?frac.toFixed(2):'—';
  document.getElementById('bc-formula-badge').textContent=`C = applied × ${frac!==null?frac.toFixed(2):'fraction'}`;

  if(applied>0 && frac!==null){
    const cStored=applied*frac;
    const co2eq  =cStored*3.67;
    const yield_ =input>0&&output>0?(output/input*100):null;
    set('bc-est-carbon', cStored.toFixed(1), 'kg C');
    set('bc-est-co2eq',  co2eq.toFixed(1),   'kg CO₂e');
    set('bc-est-yield',  yield_!==null?yield_.toFixed(1):'—', '%');
  } else {
    resetBiocharEstimate();
  }
}
function resetBiocharEstimate(){
  ['bc-est-carbon','bc-est-co2eq','bc-est-yield'].forEach(id=>setDash(id));
}
['bc-application-weight','bc-output-weight','bc-biomass-weight','bc-lab-c-content'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input', calcBiocharEstimate);
});

document.getElementById('form-biochar').addEventListener('submit',e=>{
  e.preventDefault();
  const applied=parseFloat(document.getElementById('bc-application-weight').value)||0;
  const frac=getBiocharFraction()||0.50;
  const cStored=applied*frac;
  const co2eq=cStored*3.67;
  const date=document.getElementById('bc-date').value||today();
  const feedEl=document.getElementById('bc-feedstock');
  const rec={
    activity:'biochar',id:document.getElementById('bc-record-id').value,
    farmer:document.getElementById('bc-farmer').value,
    main_value:`${applied}kg Biochar | ${feedEl.options[feedEl.selectedIndex]?.text||'—'} | C_frac: ${frac.toFixed(2)}`,
    estimate:`${cStored.toFixed(1)} kg C (${co2eq.toFixed(1)} kg CO₂e)`,
    formula:`C = ${applied} × ${frac.toFixed(2)}`,
    est_carbon:cStored,est_co2eq:co2eq,gps:document.getElementById('bc-gps').value,
    date,saved_at:new Date().toISOString()
  };
  const recs=load(); recs.push(rec); save(recs);
  updateKPIs(); renderTable('all');
  toast('Biochar MRV Record सहेजा गया!');
  e.target.reset(); setFractionMode('default'); resetBiocharEstimate();
});

/* ---- AGROFORESTRY ALLOMETRIC ---- */
const ALLO_COEFFS={
  walnut:{a:0.099,b:2.56,label:'Juglans regia'},
  apple:{a:0.076,b:2.42,label:'Malus domestica'},
  apricot:{a:0.082,b:2.38,label:'Prunus armeniaca'},
  plum:{a:0.079,b:2.35,label:'Prunus domestica'},
  amla:{a:0.065,b:2.30,label:'Phyllanthus emblica'},
  mango:{a:0.110,b:2.60,label:'Mangifera indica'},
  mulberry:{a:0.071,b:2.25,label:'Morus alba'},
  bamboo:{a:0.13, b:2.00,label:'Bambusa spp. (clump)'},
  poplar:{a:0.125,b:2.65,label:'Populus deltoides'},
  neem:{a:0.095,b:2.45,label:'Azadirachta indica'},
  tej_patta:{a:0.060,b:2.20,label:'Cinnamomum tamala'},
  other:{a:0.080,b:2.40,label:'Generic (mixed species)'},
};

function updateAlloCoeffs(){
  const sp=document.getElementById('agro-species').value;
  const co=ALLO_COEFFS[sp];
  const box=document.getElementById('allo-info');
  if(co&&sp){
    box.style.display='block';
    document.getElementById('allo-species-label').textContent=co.label;
    document.getElementById('allo-coeff-a').textContent=co.a;
    document.getElementById('allo-coeff-b').textContent=co.b;
  } else {
    box.style.display='none';
  }
  calcAgroEstimate();
}

function calcAgroEstimate(){
  const planted  =parseInt(document.getElementById('agro-planted').value)||0;
  const surviving=parseInt(document.getElementById('agro-surviving').value)||planted;
  const dbh      =parseFloat(document.getElementById('agro-avg-dbh').value)||0;
  const sp       =document.getElementById('agro-species').value;
  const co       =ALLO_COEFFS[sp];

  if(planted>0){
    const rate=Math.round(surviving/planted*100);
    const dead=planted-surviving;
    let agbPerTree=20; // kg default (young tree)
    let methodLabel='count-based (default 20kg/tree)';
    if(dbh>0 && co){
      agbPerTree=co.a*Math.pow(dbh,co.b);
      methodLabel=`a(${co.a})×DBH(${dbh})^b(${co.b})`;
    }
    const totalCarbon=agbPerTree*0.47*surviving;
    set('agro-est-survival',rate,'%');
    set('agro-est-dead',dead,'पेड़');
    set('agro-est-agb',agbPerTree.toFixed(1),'kg');
    set('agro-est-carbon',totalCarbon.toFixed(0),'kg CO₂/yr');
    document.getElementById('agro-est-method-label').textContent=methodLabel;
  } else {
    ['agro-est-survival','agro-est-dead','agro-est-agb','agro-est-carbon'].forEach(id=>setDash(id));
  }
}
function resetAgroEstimate(){
  setTimeout(()=>calcAgroEstimate(),10);
}
['agro-planted','agro-surviving','agro-avg-dbh'].forEach(id=>{
  document.getElementById(id).addEventListener('input',calcAgroEstimate);
});

document.getElementById('form-agro').addEventListener('submit',e=>{
  e.preventDefault();
  const planted  =parseInt(document.getElementById('agro-planted').value)||0;
  const surviving=parseInt(document.getElementById('agro-surviving').value)||planted;
  const dbh      =parseFloat(document.getElementById('agro-avg-dbh').value)||0;
  const sp       =document.getElementById('agro-species').value;
  const co       =ALLO_COEFFS[sp];
  let agbPerTree=20;
  if(dbh>0&&co) agbPerTree=co.a*Math.pow(dbh,co.b);
  const totalCarbon=(agbPerTree*0.47*surviving).toFixed(0);
  const rate=planted>0?Math.round(surviving/planted*100):0;
  const spEl=document.getElementById('agro-species');
  const date=document.getElementById('agro-planting-date').value||today();
  const rec={
    activity:'agro',id:document.getElementById('agro-record-id').value,
    farmer:document.getElementById('agro-farmer').value,
    main_value:`${planted} trees | ${spEl.options[spEl.selectedIndex]?.text||'—'} | DBH: ${dbh||'—'}cm`,
    estimate:`Survival: ${rate}% | ~${totalCarbon} kg CO₂/yr`,
    formula:dbh>0&&co?`AGB=${co.a}×DBH^${co.b}×0.47`:'count-based × 0.47',
    planted,surviving,date,saved_at:new Date().toISOString()
  };
  const recs=load(); recs.push(rec); save(recs);
  updateKPIs(); renderTable('all');
  toast('Agroforestry MRV Record सहेजा गया!');
  e.target.reset(); resetAgroEstimate();
});

/* ---- KPI UPDATER ---- */
function updateKPIs(){
  const recs=load();
  document.getElementById('kpi-total-records').textContent=recs.length;
  document.getElementById('records-total-count').textContent=recs.length+' records';
  ['awd','soc','biochar','agro'].forEach(a=>{
    document.getElementById('count-'+a).textContent=recs.filter(r=>r.activity===a).length;
  });
  const totalC=recs.filter(r=>r.est_carbon).reduce((s,r)=>s+parseFloat(r.est_carbon||0),0);
  document.getElementById('kpi-carbon').innerHTML=(totalC/1000).toFixed(2)+'<span style="font-size:14px;font-weight:400"> t</span>';
  if(totalC>0) document.getElementById('kpi-trend-carbon').textContent='↑ '+totalC.toFixed(0)+' kg C';
  const totalM=recs.filter(r=>r.est_methane).reduce((s,r)=>s+parseFloat(r.est_methane||0),0);
  document.getElementById('kpi-methane').innerHTML=totalM.toFixed(1)+'<span style="font-size:14px;font-weight:400"> kg</span>';
  if(totalM>0) document.getElementById('kpi-trend-methane').textContent='↓ Reduced';
  const agroR=recs.filter(r=>r.activity==='agro'&&r.planted&&r.surviving);
  if(agroR.length){
    const tp=agroR.reduce((s,r)=>s+parseInt(r.planted||0),0);
    const ts=agroR.reduce((s,r)=>s+parseInt(r.surviving||0),0);
    const rate=tp>0?Math.round(ts/tp*100):0;
    document.getElementById('kpi-tree-survival').innerHTML=rate+'<span style="font-size:14px;font-weight:400">%</span>';
    document.getElementById('kpi-trend-trees').textContent=ts+'/'+tp;
  }
  if(recs.length>0) document.getElementById('kpi-trend-records').textContent='+'+recs.length;
}

/* ---- RECORDS TABLE ---- */
function renderTable(filterAct){
  const recs=load().filter(r=>filterAct==='all'||r.activity===filterAct);
  const tbody=document.getElementById('records-tbody');
  const empty=document.getElementById('records-empty');
  tbody.innerHTML='';
  if(!recs.length){ empty.style.display='block'; return; }
  empty.style.display='none';
  const lbl={awd:'AWD',soc:'SOC',biochar:'Biochar',agro:'Agroforestry'};
  const ico={awd:'💧',soc:'🌾',biochar:'🔥',agro:'🌳'};
  recs.slice().reverse().forEach((r,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="td-primary">${recs.length-i}</td>
      <td><span class="activity-pill ${r.activity}">${ico[r.activity]} ${lbl[r.activity]}</span></td>
      <td class="td-primary">${r.farmer||'—'}</td>
      <td>${r.id||'—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;">${r.main_value||'—'}</td>
      <td style="color:var(--teal);font-family:var(--font-en);font-size:11px;">${r.estimate||'—'}</td>
      <td class="td-formula">${r.formula||'—'}</td>
      <td>${r.date||'—'}</td>
      <td><span class="status-pill pending">⏳ Pending</span></td>`;
    tbody.appendChild(tr);
  });
}
document.getElementById('records-filter-activity').addEventListener('change',e=>renderTable(e.target.value));

/* ---- EXPORT CSV ---- */
document.getElementById('btn-export').addEventListener('click',()=>{
  const recs=load();
  if(!recs.length){ toast('Export के लिए कोई record नहीं।','error'); return; }
  const headers=['#','Activity','Farmer','Record ID','Key Evidence','MRV Estimate','Formula','Date','Saved At'];
  const rows=recs.map((r,i)=>[i+1,r.activity,r.farmer||'',r.id||'',(r.main_value||'').replace(/,/g,' '),(r.estimate||'').replace(/,/g,' '),r.formula||'',r.date||'',r.saved_at||'']);
  const csv=[headers,...rows].map(r=>r.join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`mrv-records-${today()}.csv`; a.click();
  URL.revokeObjectURL(url); toast('CSV export हो रहा है...');
});

/* ---- HELPERS ---- */
function set(id,val,unit){
  const el=document.getElementById(id);
  if(!el)return;
  el.innerHTML=`${val}<span class="unit"> ${unit}</span>`;
}
function setDash(id){ const el=document.getElementById(id); if(el) el.innerHTML='—'; }
function today(){ return new Date().toISOString().slice(0,10); }

/* ---- DEMO DATA ---- */
const DEMO_RECORDS = [
  // AWD — 3 farmers
  {
    activity:'awd', id:'AWD-UKM-001', farmer:'रामप्रसाद नेगी',
    main_value:'Area: 0.40ha | Season: 115d | AWD: 55d',
    estimate:'↓91.8 kg CH₄ (2294 kg CO₂e)',
    formula:'(EF_base−EF_awd) × Area × Days',
    est_methane:91.8, est_co2eq:2294,
    date:'2025-06-15', saved_at:'2025-06-15T08:30:00Z'
  },
  {
    activity:'awd', id:'AWD-UKM-002', farmer:'सुनीता देवी',
    main_value:'Area: 0.27ha | Season: 110d | AWD: 50d',
    estimate:'↓62.0 kg CH₄ (1549 kg CO₂e)',
    formula:'(EF_base−EF_awd) × Area × Days',
    est_methane:62.0, est_co2eq:1549,
    date:'2025-06-18', saved_at:'2025-06-18T09:15:00Z'
  },
  {
    activity:'awd', id:'AWD-JKL-001', farmer:'हरिदत्त बिष्ट',
    main_value:'Area: 0.53ha | Season: 120d | AWD: 65d',
    estimate:'↓122.4 kg CH₄ (3060 kg CO₂e)',
    formula:'(EF_base−EF_awd) × Area × Days',
    est_methane:122.4, est_co2eq:3060,
    date:'2025-06-20', saved_at:'2025-06-20T07:45:00Z'
  },
  // SOC — 3 farmers
  {
    activity:'soc', id:'SOC-UKM-001', farmer:'गंगा देवी',
    main_value:'SOC: 1.20% @ 0–10cm | BD: 1.20 g/cm³',
    estimate:'Stock ≈ 14.40 t C/ha (0–10cm layer)',
    formula:'SOC × BD × depth × 100',
    date:'2025-05-10', saved_at:'2025-05-10T10:00:00Z'
  },
  {
    activity:'soc', id:'SOC-UKM-002', farmer:'दीपक रावत',
    main_value:'SOC: 0.95% @ 0–10cm | BD: 1.25 g/cm³',
    estimate:'Stock ≈ 11.88 t C/ha (0–10cm layer)',
    formula:'SOC × BD × depth × 100',
    date:'2025-05-14', saved_at:'2025-05-14T11:00:00Z'
  },
  {
    activity:'soc', id:'SOC-AGM-001', farmer:'पार्वती जोशी',
    main_value:'SOC: 1.45% @ 0–10cm | BD: 1.15 g/cm³',
    estimate:'Stock ≈ 16.68 t C/ha (0–10cm layer)',
    formula:'SOC × BD × depth × 100',
    date:'2025-05-20', saved_at:'2025-05-20T09:30:00Z'
  },
  // Biochar — 3 farmers
  {
    activity:'biochar', id:'BC-UKM-001', farmer:'मोहन सिंह',
    main_value:'250kg Biochar | पराली (Rice Straw) | C_frac: 0.50',
    estimate:'125.0 kg C (458.8 kg CO₂e)',
    formula:'C = 250 × 0.50',
    est_carbon:125.0, est_co2eq:458.8,
    gps:'30.4827, 79.0183',
    date:'2025-04-05', saved_at:'2025-04-05T08:00:00Z'
  },
  {
    activity:'biochar', id:'BC-UKM-002', farmer:'लक्ष्मी नेगी',
    main_value:'180kg Biochar | गेहूं भूसा | C_frac: 0.50',
    estimate:'90.0 kg C (330.3 kg CO₂e)',
    formula:'C = 180 × 0.50',
    est_carbon:90.0, est_co2eq:330.3,
    gps:'30.4912, 79.0251',
    date:'2025-04-12', saved_at:'2025-04-12T09:20:00Z'
  },
  {
    activity:'biochar', id:'BC-JKL-001', farmer:'विजयपाल',
    main_value:'320kg Biochar | लकड़ी/टहनियाँ | C_frac: 0.62 (lab)',
    estimate:'198.4 kg C (728.1 kg CO₂e)',
    formula:'C = 320 × 0.62 (lab-tested)',
    est_carbon:198.4, est_co2eq:728.1,
    gps:'30.5104, 79.0087',
    date:'2025-04-18', saved_at:'2025-04-18T10:45:00Z'
  },
  // Agroforestry — 3 farmers
  {
    activity:'agro', id:'AGR-UKM-001', farmer:'भगवती प्रसाद',
    main_value:'45 trees | अखरोट (Walnut) | DBH: 4.5cm',
    estimate:'Survival: 93% | ~1240 kg CO₂/yr',
    formula:'AGB=0.099×DBH^2.56×0.47',
    planted:45, surviving:42,
    date:'2024-07-10', saved_at:'2024-07-10T08:00:00Z'
  },
  {
    activity:'agro', id:'AGR-UKM-002', farmer:'कमला देवी',
    main_value:'60 trees | आंवला | DBH: 3.2cm',
    estimate:'Survival: 88% | ~680 kg CO₂/yr',
    formula:'AGB=0.065×DBH^2.30×0.47',
    planted:60, surviving:53,
    date:'2024-07-15', saved_at:'2024-07-15T09:10:00Z'
  },
  {
    activity:'agro', id:'AGR-AGM-001', farmer:'नरेन्द्र सिंह',
    main_value:'30 trees | सेब (Apple) | DBH: 5.8cm',
    estimate:'Survival: 100% | ~940 kg CO₂/yr',
    formula:'AGB=0.076×DBH^2.42×0.47',
    planted:30, surviving:30,
    date:'2024-08-01', saved_at:'2024-08-01T07:30:00Z'
  }
];

function seedDemoData(){
  const existing = load();
  if(existing.length === 0){
    save(DEMO_RECORDS);
    updateKPIs();
    renderTable('all');
  }
}

function clearDemoData(){
  if(confirm('सभी records हटाएं और fresh start करें?')){
    localStorage.removeItem(STORE);
    updateKPIs(); renderTable('all');
    toast('सभी records साफ हो गए — fresh start!');
  }
}

function reloadDemo(){
  save(DEMO_RECORDS);
  updateKPIs(); renderTable('all');
  toast('Demo data reload हो गया — 12 example records!');
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded',()=>{
  seedDemoData();
  updateKPIs(); renderTable('all');
  const t=today();
  ['awd-transplant-date','awd-harvest-date','soc-sample-date','bc-date','bc-application-date','agro-planting-date'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&!el.value) el.value=t;
  });
});
