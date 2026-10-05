/* Original vector scenery. Each view is fixed across all three readings. */
globalThis.JourneyArt = function (kind = 'entrance') {
  const outside = kind === 'entrance' || kind === 'rain';
  const rain = Array.from({length:45}, (_, i) => {
    const x = (i * 137 + 21) % 800, y = (i * 73 + 13) % 660;
    return `<path d="M${x} ${y}l-7 32" opacity="${.10+(i%4)*.035}"/>`;
  }).join('');
  const seats = Array.from({length:4}, (_, row) => Array.from({length:9}, (_, col) => {
    const x = 74 + col * 76 - row * 17, y=430+row*70;
    return `<path d="M${x} ${y+55}v-29q0-25 23-25h12q23 0 23 25v29" fill="${row%2?'#23333a':'#293b41'}" stroke="#36474b"/>`;
  }).join('')).join('');
  const base = `<defs>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#253d48"/><stop offset="1" stop-color="#101e26"/></linearGradient>
    <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#ddbd81"/><stop offset="1" stop-color="#685740"/></linearGradient>
    <linearGradient id="beam" x2="0" y2="1"><stop stop-color="#e9dec1" stop-opacity=".16"/><stop offset="1" stop-color="#e9dec1" stop-opacity="0"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#bca16d" stop-opacity=".22"/><stop offset="1" stop-color="#bca16d" stop-opacity="0"/></radialGradient>
    <pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".5" fill="#e8e4ce" opacity=".07"/></pattern>
  </defs><rect width="800" height="680" fill="url(#sky)"/>`;
  let scenery;
  if (outside) scenery = `
    <circle cx="422" cy="320" r="300" fill="url(#glow)"/>
    <path d="M0 190h84v-66h86v80h40v380H0zM625 165h83v-55h92v489H615z" fill="#12232c"/>
    <g stroke="#45606a" stroke-width="1" opacity=".3"><path d="M0 265h154M645 232h155M689 110v441M717 310h82M10 375h126"/></g>
    <path d="M157 258L532 170l115 58v339H157z" fill="#263d46"/>
    <path d="M157 258L532 170v397H157z" fill="#354a4e"/>
    <path d="M532 170l115 58v339H532z" fill="#1e333d"/>
    <path d="M145 249l389-92 127 67-14 20-115-54-375 90z" fill="#63706a"/>
    <path d="M180 287l326-75v137l-326 43z" fill="#24343a" stroke="#73807a"/>
    <path d="M207 296l272-57v90l-272 37z" fill="#bdac87" opacity=".88"/>
    <text x="343" y="311" text-anchor="middle" fill="#384443" font-family="serif" font-size="40" letter-spacing="12" transform="rotate(-10 343 311)">灯標館</text>
    <path d="M172 393l348-45 41 24-10 26-376 42z" fill="#7c7b63"/>
    <path d="M175 418l376-40v21l-376 43z" fill="#cbb684"/>
    <path d="M211 440l92-9v137h-92zM322 429l92-9v148h-92zM434 417l58-6v157h-58z" fill="url(#glass)"/>
    <path d="M225 451l64-7v99h-64zM336 443l64-8v109h-64z" fill="#314342" opacity=".72"/>
    <path d="M244 570l193 0 83 110H178z" fill="#baa477" opacity=".12"/>
    <path d="M185 583h390M150 598h438M70 653h196M462 629h237" stroke="#718280" opacity=".45"/>
    <rect x="559" y="302" width="40" height="121" fill="#aa9a75"/>
    <text x="579" y="329" text-anchor="middle" fill="#293939" font-size="16" font-family="serif"><tspan x="579">最</tspan><tspan x="579" dy="24">終</tspan><tspan x="579" dy="24">上</tspan><tspan x="579" dy="24">映</tspan></text>
    <path d="M668 275v310m-15-299h45" stroke="#83918a" stroke-width="5"/><path d="M658 286h31v12h-31z" fill="#e0c996"/>
    <path d="M653 299l-61 238h158l-61-238z" fill="url(#beam)"/>
    <g stroke="#9dafaf" stroke-width="1">${rain}</g>`;
  else if (kind === 'booth') scenery = `
    <path d="M0 0h800v680H0z" fill="#14262f"/><rect x="390" y="124" width="295" height="210" fill="#66736d"/><rect x="405" y="140" width="264" height="177" fill="#c5c5af"/>
    <path d="M290 313L667 140v177L290 343z" fill="url(#beam)"/>
    <rect x="97" y="326" width="220" height="183" rx="8" fill="#3b4b4b" stroke="#65726b"/>
    <circle cx="147" cy="254" r="78" fill="#253940" stroke="#7d877b" stroke-width="3"/><circle cx="309" cy="257" r="67" fill="#253940" stroke="#7d877b" stroke-width="3"/>
    ${[147,309].map(x=>`<g fill="#7b8172"><circle cx="${x}" cy="220" r="18"/><circle cx="${x-29}" cy="271" r="18"/><circle cx="${x+29}" cy="271" r="18"/></g>`).join('')}
    <rect x="291" y="348" width="77" height="47" fill="#7b8578"/><path d="M137 508v83m133-83v83M90 597h232" stroke="#7a8377" stroke-width="11"/>
    <path d="M440 510h215l55 107H385z" fill="#475850" stroke="#829082"/><path d="M467 550l12-43" stroke="#9e7064" stroke-width="11"/><circle cx="481" cy="500" r="13" fill="#a36d58"/>
    <rect x="530" y="543" width="80" height="25" fill="#d9cfb6"/><text x="570" y="561" text-anchor="middle" font-size="13" fill="#33463e">通路灯</text>`;
  else if (kind === 'screen') scenery = `
    <path d="M0 0h800v680H0z" fill="#162931"/><path d="M79 88h643v315H79z" fill="#40504c"/><rect x="111" y="115" width="579" height="254" fill="#dfdfc9"/>
    <path d="M112 369l-99 287h775l-98-287z" fill="url(#beam)"/>
    <path d="M68 70v341M731 70v341" stroke="#5a5b50" stroke-width="36"/>${seats}`;
  else scenery = `
    <path d="M0 0h800v680H0z" fill="#223740"/><path d="M0 0l162 87v442L0 680z" fill="#192b35"/><path d="M800 0L640 87v442l160 151z" fill="#192b35"/>
    <path d="M160 89h480v441H160z" fill="#41514f"/><rect x="285" y="157" width="230" height="373" fill="#182c33"/><path d="M299 174h94v356h-94zM407 174h94v356h-94z" fill="#827d63"/><path d="M310 185h72v272h-72zM419 185h71v272h-71z" fill="#30413f"/>
    <rect x="347" y="109" width="110" height="29" fill="#d6c99d"/><text x="402" y="130" fill="#47574a" text-anchor="middle" font-size="17" letter-spacing="6">映写室</text>
    <path d="M161 530h480l159 150H0z" fill="#253941"/><path d="M200 570h398M140 610h505M250 530l-90 150M550 530l99 150" stroke="#758178" opacity=".25"/>
    <path d="M192 279h67v123h-67z" fill="#bfb391"/><path d="M201 298h47M201 313h47M201 345h38M201 360h42" stroke="#6d7562"/>
    <circle cx="402" cy="43" r="9" fill="#d6c696"/><path d="M400 50L224 500h359z" fill="url(#beam)"/>
    <path d="M540 438h104v14H540zM553 451v79m79-79v79" stroke="#9b9474" stroke-width="7"/>
    <rect x="552" y="410" width="69" height="26" fill="#d7cbb1" transform="rotate(-7 550 410)"/>`;
  return `<svg viewBox="0 0 800 680" role="img" aria-label="${outside?'雨に濡れる小さな上映館':kind==='booth'?'映写機と赤い通路灯レバー':kind==='screen'?'白いスクリーンと空席':'静かな上映館の廊下'}" xmlns="http://www.w3.org/2000/svg">${base}${scenery}<rect width="800" height="680" fill="url(#grain)"/></svg>`;
};
