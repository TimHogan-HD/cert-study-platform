/* guided-subnetting.js — step-by-step subnetting practice (obj-1-7) */

export function initGuidedSubnetting() {
  const guide = document.getElementById('subnet-guide');
  if (!guide) return;

  // helpers
  function sgMask(p) {
    const b = '1'.repeat(p) + '0'.repeat(32 - p);
    return [0, 8, 16, 24].map(i => parseInt(b.slice(i, i + 8), 2));
  }
  function sgNet(ip, p)   { const oc = ip.split('.').map(Number), m = sgMask(p); return oc.map((x,i) => x & m[i]); }
  function sgBcast(ip, p) { const oc = ip.split('.').map(Number), m = sgMask(p); return oc.map((x,i) => (x & m[i]) | (~m[i] & 0xff)); }
  function sgAdd1(oc) { const r=[...oc]; let c=1; for(let i=3;i>=0&&c;i--){const s=r[i]+c;r[i]=s&0xff;c=s>>8;} return r; }
  function sgSub1(oc) { const r=[...oc]; let b=1; for(let i=3;i>=0&&b;i--){const s=r[i]-b;r[i]=s<0?s+256:s;b=s<0?1:0;} return r; }
  function sgStr(oc) { return oc.join('.'); }
  function sgBin8(n) { return n.toString(2).padStart(8, '0'); }
  function sgEsc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const POOLS = {
    magic: [
      {ip:'192.168.1.100',prefix:26},{ip:'10.0.0.200',prefix:27},
      {ip:'172.16.5.150',prefix:28},{ip:'192.168.50.75',prefix:25},
      {ip:'10.10.10.130',prefix:29},{ip:'172.31.100.200',prefix:30},
      {ip:'192.168.10.50',prefix:26},{ip:'10.1.2.85',prefix:27},
    ],
    powers: [
      {prefix:25},{prefix:26},{prefix:27},{prefix:28},
      {prefix:29},{prefix:30},{prefix:28},{prefix:25},
    ],
    and: [
      {ip:'10.0.5.200',prefix:27},{ip:'192.168.1.175',prefix:26},
      {ip:'172.16.20.100',prefix:28},{ip:'10.100.50.220',prefix:29},
      {ip:'192.168.200.50',prefix:25},{ip:'10.10.10.250',prefix:30},
      {ip:'172.20.35.66',prefix:27},{ip:'192.168.99.130',prefix:26},
    ],
  };

  function buildMagicSteps(p) {
    const {ip,prefix}=p, mask=sgMask(prefix), maskStr=sgStr(mask);
    const magic=256-mask[3], net=sgNet(ip,prefix), bcast=sgBcast(ip,prefix);
    const first=sgAdd1(net), last=sgSub1(bcast), ipOc=ip.split('.').map(Number);
    const bitsInLast=prefix-24;
    const bitVals=[128,64,32,16,8,4,2,1].slice(0,bitsInLast).join(' + ');
    return [
      {instruction:`What is the subnet mask for /${prefix}?`,
       hint:`/${prefix} → ${bitsInLast} bit(s) past /24 → add from the chart: ${bitVals}.`,
       placeholder:'255.255.255.___',answer:maskStr,type:'ip'},
      {instruction:`Your mask is ${maskStr}. Subtract the last active octet from 256. What is the magic number (block size)?`,
       hint:`256 − ${mask[3]} = ? This number is how far apart each subnet boundary is.`,
       placeholder:'Magic number',answer:String(magic),type:'number'},
      {instruction:`Block size is ${magic}, so subnets start at 0, ${magic}, ${magic*2}, ${magic*3}… The host's last octet is ${ipOc[3]}. Which block start is it in?`,
       hint:`Find the largest multiple of ${magic} that is ≤ ${ipOc[3]}.`,
       placeholder:'Last octet of network address',answer:String(net[3]),type:'number'},
      {instruction:`The block starting at ${net[3]} ends just before the next one. What is the last octet of the broadcast address?`,
       hint:`Next block starts at ${net[3] + magic}. Broadcast is one before that: ${net[3] + magic} − 1.`,
       placeholder:'Last octet of broadcast',answer:String(bcast[3]),type:'number'},
      {instruction:'Write the full network address:',
       hint:`The first three octets are the same as the host IP: ${ipOc[0]}.${ipOc[1]}.${ipOc[2]}.___`,
       placeholder:'x.x.x.x',answer:sgStr(net),type:'ip'},
      {instruction:'Write the full broadcast address:',
       hint:`Same first three octets: ${ipOc[0]}.${ipOc[1]}.${ipOc[2]}.___`,
       placeholder:'x.x.x.x',answer:sgStr(bcast),type:'ip'},
      {instruction:'What is the first usable host address?',
       hint:'First usable = network address + 1 (the network ID itself is not assignable)',
       placeholder:'x.x.x.x',answer:sgStr(first),type:'ip'},
      {instruction:'What is the last usable host address?',
       hint:'Last usable = broadcast address − 1 (the broadcast itself is not assignable)',
       placeholder:'x.x.x.x',answer:sgStr(last),type:'ip'},
    ];
  }

  function buildPowersSteps(p) {
    const {prefix}=p, hb=32-prefix, total=Math.pow(2,hb);
    const usable=prefix===31?2:prefix===32?1:total-2;
    const bitsInLast=prefix-24;
    const bitVals=[128,64,32,16,8,4,2,1].slice(0,bitsInLast).join(' + ');
    return [
      {instruction:`How many host bits are in a /${prefix} network?`,
       hint:`An IP address has 32 bits total. The prefix uses ${prefix} for the network — the rest are host bits.`,
       placeholder:'Host bits',answer:String(hb),type:'number'},
      {instruction:`How many total addresses does ${hb} host bit${hb===1?'':'s'} give you? (2^${hb})`,
       hint:`2^1=2, 2^2=4, 2^3=8, 2^4=16, 2^5=32, 2^6=64, 2^7=128, 2^8=256`,
       placeholder:`2^${hb} = ?`,answer:String(total),type:'number'},
      {instruction:'How many addresses are usable by hosts? (total minus the two reserved addresses)',
       hint:`One address is the network ID (all host bits 0), one is the broadcast (all host bits 1). Both are reserved. Exception: /31 = 2 usable, /32 = 1.`,
       placeholder:'Usable hosts',answer:String(usable),type:'number'},
      {instruction:`What is the subnet mask for /${prefix}?`,
       hint:`/${prefix} → ${bitsInLast} bit(s) past /24 → add from the chart: ${bitVals}.`,
       placeholder:'255.255.255.___',answer:sgStr(sgMask(prefix)),type:'ip'},
    ];
  }

  function buildAndSteps(p) {
    const {ip,prefix}=p, mask=sgMask(prefix), maskStr=sgStr(mask);
    const ipOc=ip.split('.').map(Number), net=sgNet(ip,prefix);
    const intOct=ipOc[3], maskOct=mask[3], netOct=net[3];
    const bitsInLast=prefix-24;
    const bitVals=[128,64,32,16,8,4,2,1].slice(0,bitsInLast).join(' + ');
    return [
      {instruction:`What is the subnet mask for /${prefix}?`,
       hint:`/${prefix} → ${bitsInLast} bit(s) past /24 → add from the chart: ${bitVals}.`,
       placeholder:'255.255.255.___',answer:maskStr,type:'ip'},
      {instruction:`Convert the last octet of the IP address (${intOct}) to 8-bit binary:`,
       hint:'Bit values left to right: 128, 64, 32, 16, 8, 4, 2, 1. Write all 8 digits, including leading zeros.',
       placeholder:'e.g. 11001000',answer:sgBin8(intOct),type:'binary'},
      {instruction:`Convert the last octet of the subnet mask (${maskOct}) to 8-bit binary:`,
       hint:'Mask octets are always 1s on the left, 0s on the right — never mixed.',
       placeholder:'e.g. 11100000',answer:sgBin8(maskOct),type:'binary'},
      {instruction:'AND the two binary values column by column. Write the 8-bit result.',
       hint:`Rule: 1 AND 1 = 1. Anything else = 0.\nIP:   ${sgBin8(intOct)}\nMask: ${sgBin8(maskOct)}`,
       placeholder:'8-bit result',answer:sgBin8(netOct),type:'binary'},
      {instruction:'Convert your binary result to decimal, then write the full network address:',
       hint:`Your result (${sgBin8(netOct)}) = ${netOct}. The first three octets stay the same: ${ipOc[0]}.${ipOc[1]}.${ipOc[2]}.___`,
       placeholder:'x.x.x.x',answer:sgStr(net),type:'ip'},
    ];
  }

  let method=null, problem=null, steps=null;
  const idxMap={};
  const body=document.getElementById('sg-body');
  const probEl=document.getElementById('sg-problem-text');
  const list=document.getElementById('sg-steps-list');
  const sumEl=document.getElementById('sg-summary');

  function render() {
    probEl.textContent = method==='powers' ? `Given: /${problem.prefix} subnet` : `Given: ${problem.ip} /${problem.prefix}`;
    sumEl.hidden=true; sumEl.innerHTML='';
    list.innerHTML=steps.map((s,i)=>`
      <div class="sg-step" data-step="${i}">
        <div class="sg-step-num">${i+1}</div>
        <div class="sg-step-content">
          <div class="sg-step-instruction">${sgEsc(s.instruction)}</div>
          <div class="sg-step-hint">${sgEsc(s.hint)}</div>
          <input class="sg-step-input" type="text" placeholder="${sgEsc(s.placeholder)}" autocomplete="off" spellcheck="false"/>
          <div class="sg-step-msg" hidden></div>
        </div>
      </div>`).join('');
  }

  function selectMethod(m) {
    method=m;
    guide.querySelectorAll('.sg-method-btn').forEach(b=>b.classList.toggle('active',b.dataset.method===m));
    const pool=POOLS[m];
    if(idxMap[m]==null) idxMap[m]=Math.floor(Math.random()*pool.length);
    problem=pool[idxMap[m]];
    steps=m==='magic'?buildMagicSteps(problem):m==='powers'?buildPowersSteps(problem):buildAndSteps(problem);
    body.hidden=false;
    render();
  }

  function newProblem() {
    const pool=POOLS[method];
    idxMap[method]=(idxMap[method]+1)%pool.length;
    problem=pool[idxMap[method]];
    steps=method==='magic'?buildMagicSteps(problem):method==='powers'?buildPowersSteps(problem):buildAndSteps(problem);
    render();
  }

  function normalize(val,type) {
    const s=val.trim().replace(/\s+/g,'');
    return type==='binary' ? s.replace(/[^01]/g,'') : s;
  }

  function checkAnswers() {
    let correct=0;
    list.querySelectorAll('.sg-step').forEach((el,i)=>{
      const s=steps[i];
      const inp=el.querySelector('.sg-step-input');
      const msg=el.querySelector('.sg-step-msg');
      const ok=normalize(inp.value,s.type)===normalize(s.answer,s.type);
      if(ok) correct++;
      inp.className='sg-step-input '+(ok?'sg-input-correct':'sg-input-incorrect');
      msg.hidden=false;
      msg.className='sg-step-msg '+(ok?'sg-correct':'sg-incorrect');
      msg.textContent=ok?'✓ Correct':`✗ Got "${inp.value||'(blank)'}"`;
    });
    sumEl.hidden=false;
    sumEl.className='sg-summary '+(correct===steps.length?'sg-summary-pass':'sg-summary-fail');
    sumEl.innerHTML=correct===steps.length
      ?`<strong>✓ All ${steps.length} correct!</strong> Hit "New ↻" to practice another problem.`
      :`<strong>${correct} / ${steps.length} correct.</strong> Fix the steps marked ✗ and check again — or hit Reveal to see all answers.`;
  }

  function revealAnswers() {
    steps.forEach((s,i)=>{
      const el=list.querySelector(`[data-step="${i}"]`);
      const inp=el.querySelector('.sg-step-input');
      const msg=el.querySelector('.sg-step-msg');
      inp.value=s.answer;
      inp.className='sg-step-input sg-input-revealed';
      msg.hidden=false;
      msg.className='sg-step-msg sg-revealed';
      msg.textContent='↑ Revealed';
    });
    sumEl.hidden=false;
    sumEl.className='sg-summary sg-summary-reveal';
    sumEl.innerHTML='Answers revealed. Try a <strong>New Problem ↻</strong> to practice on your own.';
  }

  guide.querySelectorAll('.sg-method-btn').forEach(btn=>{
    btn.addEventListener('click',()=>selectMethod(btn.dataset.method));
  });
  const checkBtn=document.getElementById('sg-check-btn');
  const revealBtn=document.getElementById('sg-reveal-btn');
  const newBtn=document.getElementById('sg-new-btn');
  checkBtn?.addEventListener('click',checkAnswers);
  revealBtn?.addEventListener('click',revealAnswers);
  newBtn?.addEventListener('click',newProblem);
}
