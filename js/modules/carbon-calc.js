// Conversion constants (base: Nali)
// 1 Nali = 200 sq.m
// 1 Bigha = 5 Nali
// 1 Acre = 10 Nali (Uttarakhand traditional)
// 1 Hectare = 24.7105 Nali
// 1 Muthi = 1/20 Nali
const TO_NALI = { nali:1, bigha:5, acre:10, hac:24.7105, muthi:0.05 };
const TO_HAC  = 1/24.7105; // 1 nali in hectares

let currentHa = 0;

function convertArea(from){
  const val = parseFloat(document.getElementById('a_'+from).value);
  if(isNaN(val)||val<0){ clearArea(from); return; }
  const nali = val * TO_NALI[from];
  const ha   = nali * TO_HAC;
  currentHa  = ha;

  // Fill other fields (rounded nicely)
  const ids = ['nali','bigha','acre','hac','muthi'];
  ids.forEach(u=>{
    if(u===from) return;
    const converted = nali / TO_NALI[u];
    document.getElementById('a_'+u).value = +converted.toFixed(3);
  });

  // Summary
  const naliVal  = nali.toFixed(2);
  const bighaVal = (nali/5).toFixed(2);
  const acreVal  = (nali/10).toFixed(3);
  const hacVal   = ha.toFixed(4);
  const summary  = document.getElementById('area_summary');
  summary.style.display='block';
  summary.innerHTML = `✅ रकबा: <b>${naliVal} नाली</b> = <b>${bighaVal} बीघा</b> = <b>${acreVal} Acre</b> = <b>${hacVal} Hectare</b>`;
}

function clearArea(except){
  ['nali','bigha','acre','hac','muthi'].forEach(u=>{
    if(u!==except) document.getElementById('a_'+u).value='';
  });
  document.getElementById('area_summary').style.display='none';
  currentHa=0;
}

function calculate(){
  const name    = document.getElementById('f_name').value.trim()||'Farmer';
  const village = document.getElementById('f_village').value.trim();
  const block   = document.getElementById('f_block').value.trim();
  const district= document.getElementById('f_district').value.trim();
  const trees   = parseInt(document.getElementById('f_trees').value)||0;
  const crop    = document.getElementById('f_crop').value;
  const irr     = document.getElementById('f_irr').value;
  const organic = document.querySelector('input[name="organic"]:checked').value;
  const price   = parseFloat(document.getElementById('f_price').value)||1200;

  // Get area from whichever unit was filled
  if(!currentHa||currentHa<=0){
    alert('कृपया खेत का रकबा भरें (नाली, बीघा, Acre या Hectare में से कोई एक)');
    return;
  }
  const area = currentHa;

  // Display area string
  const nali  = area/TO_HAC;
  const bigha = nali/5;
  const areaStr = `${nali.toFixed(1)} नाली / ${bigha.toFixed(1)} बीघा / ${area.toFixed(3)} Ha`;

  const cropMult = {wheat:1.5,millet:1.6,vegetable:1.3,fruit:1.8,agroforestry:2.2};
  const cropNames= {wheat:'Wheat/गेहूं',millet:'Millet/मंडुवा',vegetable:'Vegetable/सब्जी',fruit:'Fruit/माल्टा',agroforestry:'Agroforestry'};
  const irrNames = {drip:'Drip Irrigation',rainfed:'Rainfed/वर्षा',flood:'Flood Irrigation'};

  const soilCarbon   = area * cropMult[crop];
  const treeCarbon   = trees * 0.025;
  const organicBonus = organic==='yes' ? 0.5 : 0;
  const irrBonus     = irr==='drip' ? 0.2 : 0;
  const totalCarbon  = soilCarbon + treeCarbon + organicBonus + irrBonus;
  const income       = totalCarbon * price;

  document.getElementById('r_name').textContent      = name;
  document.getElementById('ri_name').textContent     = name;
  document.getElementById('ri_crop').textContent     = cropNames[crop];
  document.getElementById('ri_area_detail').textContent = areaStr;
  const loc = [village,block,district].filter(Boolean).join(', ')||'Uttarakhand';
  document.getElementById('ri_loc').textContent      = loc;
  document.getElementById('ri_org_wrap').innerHTML   = organic==='yes'
    ? '<span class="badge-org badge-good">✓ Organic</span>'
    : '<span class="badge-org">Non-Organic</span>';

  document.getElementById('r_carbon').textContent   = totalCarbon.toFixed(2);
  document.getElementById('r_credits').textContent  = totalCarbon.toFixed(2);
  document.getElementById('r_income').textContent   = '₹'+Math.round(income).toLocaleString('en-IN');
  document.getElementById('r_price_note').textContent = price.toLocaleString('en-IN');
  document.getElementById('r_date').textContent     = new Date().toLocaleDateString('hi-IN');

  // Bars
  const comps = [
    {label:'Soil Carbon',           val:soilCarbon},
    {label:'Tree Carbon',           val:treeCarbon},
    {label:'Organic Bonus',         val:organicBonus},
    {label:'Drip Irrigation Bonus', val:irrBonus},
  ].filter(c=>c.val>0);
  document.getElementById('bars').innerHTML = comps.map(c=>{
    const pct = Math.round((c.val/totalCarbon)*100);
    return `<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#2d5a3d;margin-bottom:3px">
        <span>${c.label}</span><span>${c.val.toFixed(3)} tCO₂e</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"><span>${pct}%</span></div></div>
    </div>`;
  }).join('');

  // Table
  const rows=[
    ['Soil Carbon',`${area.toFixed(4)} ha × ${cropMult[crop]} (${cropNames[crop]})`,soilCarbon.toFixed(3)],
    ['Tree Carbon',`${trees} पेड़ × 0.025`,treeCarbon.toFixed(3)],
  ];
  if(organicBonus) rows.push(['Organic Farming Bonus','Fixed bonus','0.500']);
  if(irrBonus)     rows.push(['Drip Irrigation Bonus','Fixed bonus','0.200']);
  rows.push([`<b>TOTAL</b>`,`<b>₹${price.toLocaleString('en-IN')}/tCO₂e × ${totalCarbon.toFixed(2)}</b>`,`<b>${totalCarbon.toFixed(2)}</b>`]);
  document.getElementById('r_table').innerHTML = rows.map(r=>
    `<tr><td>${r[0]}</td><td>${r[1]}</td><td style="text-align:right">${r[2]}</td></tr>`
  ).join('');

  // ---- CREDIT STANDARDS COMPARISON ----
  // Each standard applies a methodology-specific discount/adjustment factor
  // VCS VM0042: ~80% of gross stock eligible (permanence buffer + leakage deductions)
  const vcsCredits   = totalCarbon * 0.80;
  const vcsMinIncome = vcsCredits * 500;   // ₹500/tCO₂e (~$6)
  const vcsMaxIncome = vcsCredits * 1250;  // ₹1250/tCO₂e (~$15)

  // India CCTS: BEE regulated, ~90% eligible (domestic market, less buffer requirement)
  const cctsCredits   = totalCarbon * 0.90;
  const cctsMinIncome = cctsCredits * 800;
  const cctsMaxIncome = cctsCredits * 2000;

  // Gold Standard GS4GG: premium but stricter — ~70% of gross (SDG audit + co-benefit verification)
  // co-benefit multiplier: organic farming +10%, agroforestry +15%
  const gsCoBenefit   = (organic==='yes' ? 0.10 : 0) + (crop==='agroforestry' ? 0.15 : 0);
  const gsCredits     = totalCarbon * (0.70 + gsCoBenefit);
  const gsMinIncome   = gsCredits * 1250;  // ₹1250/tCO₂e (~$15)
  const gsMaxIncome   = gsCredits * 2500;  // ₹2500/tCO₂e (~$30)

  const fmt = n => Math.round(n).toLocaleString('en-IN');

  document.getElementById('std-vcs-credits').textContent  = vcsCredits.toFixed(2);
  document.getElementById('std-vcs-income').textContent   = `₹${fmt(vcsMinIncome)} – ₹${fmt(vcsMaxIncome)}`;

  document.getElementById('std-ccts-credits').textContent = cctsCredits.toFixed(2);
  document.getElementById('std-ccts-income').textContent  = `₹${fmt(cctsMinIncome)} – ₹${fmt(cctsMaxIncome)}`;

  document.getElementById('std-gs-credits').textContent   = gsCredits.toFixed(2);
  document.getElementById('std-gs-income').textContent    = `₹${fmt(gsMinIncome)} – ₹${fmt(gsMaxIncome)}`;

  document.getElementById('resultSection').classList.add('show');
  document.getElementById('resultSection').scrollIntoView({behavior:'smooth'});
}

function resetForm(){
  document.getElementById('resultSection').classList.remove('show');
  document.getElementById('f_name').value='';
  ['nali','bigha','acre','hac','muthi'].forEach(u=>document.getElementById('a_'+u).value='');
  document.getElementById('area_summary').style.display='none';
  document.getElementById('f_trees').value='0';
  currentHa=0;
  window.scrollTo({top:0,behavior:'smooth'});
}
