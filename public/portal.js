/* =========================================================
   CONFIGURATION — edit these before publishing
   ========================================================= */
const CONFIG = {
  // Public Google Calendar ID of the school calendar (Google Calendar › Settings › Integrate calendar › Calendar ID).
  // While empty, the "Subscribe" buttons show as unavailable.
  googleCalendarId: 'c_f07a110ada3d1ed8b37e3b1ff883d525166b81bf6847a3cfa10d01eec228a92e@group.calendar.google.com', // 2026-2027 St. Mary Catholic Virtue School Calendar
  // Front office email. The previous page showed one address and linked to another (families@stmary.edu). Confirm which is correct.
  officeEmail: 'officemanager@stmarylittleton.com',
  // Days ahead to show the "No school" alert banner.
  alertDays: 14
};

/* =========================================================
   DOCUMENTS — "added" (YYYY-MM-DD) is optional: documents added
   in the last 30 days show a "New" badge.
   ========================================================= */
const DOCS = [
  { id:'forms', name:'Forms to return', desc:'Print, fill in and send back to the front office.', items:[
    { t:'Milk Order Form', h:'assets/documents/2026-27_Milk_Order_Form.pdf', m:'PDF · 1.8 MB', k:'milk lunch order' },
    { t:'Physical Exam Form', h:'assets/documents/Physical_Exam_Form.pdf', m:'PDF · 0.4 MB', k:'health physical exam doctor' },
    { t:'Authorization to Administer Medication', h:'assets/documents/Authorization to Administer Medication.pdf', m:'PDF · 0.2 MB', k:'medication medicine health nurse' },
    { t:'SMEED Form', h:'assets/documents/SMEED/SMEED Form.pdf', m:'PDF · 0.3 MB', k:'smeed extended day after school care' },
    { t:'Family Covenant Agreements', h:'assets/documents/2026-27_Family_Covenant_Agreements.pdf', m:'PDF · 0.2 MB', k:'covenant agreement' }
  ]},
  { id:'handbooks', name:'Handbooks & policies', desc:'Read online or download the PDF.', items:[
    { t:'Student Handbook 2026–27', h:'handbook_202627.html', m:'Web page', type:'web', k:'handbook rules policy conduct uniform' },
    { t:'Student Handbook 2026–27', h:'assets/documents/2026-2027_Parent_Handbook.pdf', m:'PDF · 0.8 MB', k:'handbook rules policy conduct uniform' },
    { t:'Preschool Handbook 2026–27', h:'preschool-handbook_202627.html', m:'Web page', type:'web', k:'preschool handbook' },
    { t:'Preschool Handbook 2026–27', h:'assets/documents/2026-2027_Parent_Handbook_Preschool.pdf', m:'PDF · 0.5 MB', k:'preschool handbook' },
    { t:'SMEED Handbook 2026–27', h:'assets/documents/SMEED/SMEED Handbook 26-27.pdf', m:'PDF · 0.4 MB', k:'smeed extended day handbook' },
    { t:'Cell Phone Policy (Middle School)', h:'assets/documents/Cell_Phone_Policy.pdf', m:'PDF · 0.3 MB', k:'phone policy middle school' }
  ]},
  { id:'health', name:'Health & safety', desc:'Medical information and emergency procedures.', items:[
    { t:'Health Information 2026–27', h:'assets/documents/Medical_Information_26-27.pdf', m:'PDF · 0.6 MB', k:'health medical immunization vaccine nurse' },
    { t:'SMEED Emergency Information', h:'assets/documents/SMEED/SMEED Emergency Information.pdf', m:'PDF · 0.1 MB', k:'emergency smeed' }
  ]},
  { id:'preschool', name:'Preschool', desc:'Uniform, vocabulary and the drop-off route.', items:[
    { t:'Preschool Uniform 2026–27', h:'assets/documents/Preschool Uniform 26-27.pdf', m:'PDF · 0.7 MB', k:'uniform preschool' },
    { t:'Preschool Dictionary', h:'assets/documents/Preschool Dictionary.pdf', m:'PDF · 4.7 MB', k:'preschool dictionary vocabulary' },
    { t:'Preschool Drop-Off Map', h:'assets/documents/Map Preschool Drop Off.pdf', m:'PDF · 2.8 MB', k:'map drop off pick up preschool' }
  ]},
  { id:'academics', name:'Academics', desc:'Calendar, standards, supplies and summer work.', items:[
    { t:'Academic Calendar 2026–27', h:'assets/documents/Calendar_2026-27.pdf', m:'PDF · 2.4 MB', k:'calendar dates schedule' },
    { t:'Curriculum Standards', h:'https://www.denvercatholicschools.com/why-catholic-education/curriculum', m:'External site', type:'ext', k:'curriculum standards archdiocese' },
    { t:'School Supply List by Grade', h:'supply-list_202627.html', m:'Web page', type:'web', k:'supplies supply list' },
    { t:'Summer Math, incoming 6th grade', h:'assets/documents/6th Grade.pdf', m:'PDF · 1.0 MB', k:'summer math 6th' },
    { t:'Summer Math, incoming 7th grade', h:'assets/documents/7th Grade.pdf', m:'PDF · 1.0 MB', k:'summer math 7th' },
    { t:'Summer Math, incoming 8th grade', h:'assets/documents/8th Grade.pdf', m:'PDF · 0.7 MB', k:'summer math 8th' }
  ]},
  { id:'flyers', name:'Flyers', desc:'Menus and school-wide announcements.', items:[
    { t:'School Eatery 2026–27', h:'assets/flyers/schooleatery.pdf', m:'PDF · 3.0 MB', k:'lunch menu eatery food' }
  ]}
];
const MOST_USED = [
  ['handbooks',1], ['health',0], ['forms',1], ['forms',0], ['academics',2]
];

/* =========================================================
   EVENTS — [date, category, title, details, badges, link, alertEnd]
   alertEnd (optional): last day with no school, used only by the alert banner
   category: noclasses | faith | academic | community | health
   ========================================================= */
const EVENTS = [
["2026-06-30","health","Exemption certificates","Nonmedical: K-8 must renew annually after June 30 (see CDPHE)","Health|Important","https://cdphe.colorado.gov/exemptions-to-school-required-vaccines"],
["2026-08-03","health","Immunization records due","Up-to-date records or valid CO exemption certificate","Health|Important",""],
["2026-08-03","health","Health appraisal due","New, preschool & K students: new provider form (exam within 12 mo.)","Health|Important",""],
["2026-08-03","health","Medication forms drop off at office","Two-part authorization form per medication, incl. OTC","Health|Important",""],
["2026-08-05","community","New Family Orientation","6:30 pm","Community",""],
["2026-08-07","health","Tdap booster — 7th grade","Schedule appointment before Aug 7, 2026","Health|Important",""],
["2026-08-10","community","Teacher's Return","","Community",""],
["2026-08-13","community","Welcome Night","4:00-7:00 pm","Community",""],
["2026-08-14","noclasses","Teacher Retreat","Staff only","No School",""],
["2026-08-17","academic","First Day of School","Welcome back — school begins","Academic|Important",""],
["2026-08-21","faith","All School Mass K-8","Mass Uniform","Faith",""],
["2026-08-28","faith","All School Mass K-8","Mass Uniform","Faith",""],
["2026-08-28","community","Back to School Night","5:00 pm","Community|Important",""],
["2026-09-02","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2026-09-04","community","Bookends of Beauty at 7PM","Night Flight by Anthoine Saint-Exupery","Community","assets/events/Bookends of Beauty 26-27.pdf"],
["2026-09-04","faith","All School Mass K-8","Mass Uniform","Faith",""],
["2026-09-07","noclasses","Labor Day — No School","Observed Holiday","No School|Important",""],
["2026-09-08","faith","All School Mass K-8","Mass Uniform","Faith",""],
["2026-09-12","faith","Marian Festival","All-school celebration","Faith|Important",""],
["2026-09-13","community","Sapientia Sunday","9:30 am","Community",""],
["2026-09-15","academic","8th Grade FOCUS Field Trip","Sep 15-16","Academic",""],
["2026-09-16","academic","7th Grade FOCUS Field Trip","Sep 16-17","Academic",""],
["2026-09-18","community","Picture Day","Mass Uniform required","Community",""],
["2026-09-24","faith","All School Mass K-8","Mass Uniform","Faith",""],
["2026-09-25","noclasses","No School — Teacher In-Service","Staff only","No School",""],
["2026-09-29","faith","Sacraments Intro Parent Workshop","6:30 pm, Joachim Hall · Mandatory for parents of children receiving any sacrament this year","Faith",""],
["2026-09-30","academic","6th Grade FOCUS Field Trip","Sep 30-Oct 1","Academic",""],
["2026-10-02","faith","All School Mass","Preschool-8","Faith",""],
["2026-10-05","community","Last Day to Buy Gala Tickets","Click to buy tickets","Community","https://event.auctria.com/b5c3b286-c2e4-4fce-957e-265942a01e78/a809178051b511ea91bae14d12592328"],
["2026-10-07","faith","All School Mass","","Faith",""],
["2026-10-07","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2026-10-08","noclasses","Parent/Teacher Conferences — No School","Schedule your appointment through the portal","No School|Important",""],
["2026-10-09","noclasses","Parent/Teacher Conferences — No School","Schedule your appointment through the portal","No School|Important",""],
["2026-10-10","faith","125th Parish Celebration Mass","4:30 pm","Faith|Important",""],
["2026-10-11","community","Sapientia Sunday","9:30 am","Community",""],
["2026-10-12","noclasses","No School","","No School",""],
["2026-10-16","faith","All School Mass","Preschool-8","Faith",""],
["2026-10-18","community","Sapientia Sunday","9:30 am","Community",""],
["2026-10-22","faith","All School Mass — St. John Paul II Day","Preschool-8, Mass Uniform","Faith",""],
["2026-10-24","community","School Gala — Ken Caryl Ranch","Annual fundraising gala","Community|Important",""],
["2026-10-28","community","Last Day for Shorts","","Community",""],
["2026-10-29","faith","All Saints Day Celebration — All School Mass","9:30 am, Mass Uniform","Faith",""],
["2026-10-30","noclasses","No School — AoD Teacher Inservice","Staff only","No School",""],
["2026-10-31","community","Trunk-or-Treat","2:00 pm, Blacktop","Community",""],
["2026-11-04","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2026-11-06","faith","Picture Retakes","All School Mass","Faith",""],
["2026-11-06","community","Bookends of Beauty at 7PM","All The Lights We Cannot See by Anthony Doerr","Community","assets/events/Bookends of Beauty 26-27.pdf"],
["2026-11-08","community","Sapientia Sunday","9:30 am","Community",""],
["2026-11-13","faith","All School Mass","Preschool-8","Faith",""],
["2026-11-13","academic","End of Trimester","Report cards to follow","Academic|Important",""],
["2026-11-19","community","Preschool Nina Maria","8:30 am","Community",""],
["2026-11-20","faith","All School Mass","Preschool-8","Faith",""],
["2026-11-20","community","Spirit Night — Red Robin","All day · 63 Centennial Blvd., Highlands Ranch · 20% of sales supports St. Mary","Community",""],
["2026-11-24","faith","All School Mass","Preschool-8","Faith",""],
["2026-11-25","noclasses","Thanksgiving Break — No School","Nov 25-27. School resumes Monday, Nov 30","No School|Important","","2026-11-29"],
["2026-12-01","faith","Reconciliation Parent Workshop","6:30 pm, Joachim Hall · Mandatory for parents","Faith",""],
["2026-12-02","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2026-12-04","faith","All School Mass","Preschool-8","Faith",""],
["2026-12-08","faith","All School Mass","Preschool-8","Faith",""],
["2026-12-10","academic","Advent Production K-2","6:00 pm — Families welcome","Academic|Faith",""],
["2026-12-10","community","Spirit Night — Chick-fil-A","All day · Chick-fil-A Aspen Grove","Community",""],
["2026-12-13","community","Sapientia Sunday","9:30 am","Community",""],
["2026-12-18","community","Classroom Christmas Parties / Noon Dismissal","Pick-up at 12:00 pm","Community|Important",""],
["2026-12-21","noclasses","Christmas Break — No School","Dec 21-Jan 1. School resumes January 5","No School|Important","","2027-01-04"],
["2027-01-04","noclasses","No School — Teacher In-Service","Staff only","No School",""],
["2027-01-05","academic","School Resumes — Students Return","Regular schedule begins 7:45 am","Academic|Important",""],
["2027-01-06","academic","Spelling Bee","All grades","Academic|Important",""],
["2027-01-08","faith","All School Mass","Preschool-8","Faith",""],
["2027-01-09","community","Father/Daughter Dance","5:30 pm","Community",""],
["2027-01-13","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2027-01-15","faith","All School Mass","Preschool-8","Faith",""],
["2027-01-18","noclasses","Martin Luther King Jr. Day — No School","Observed Holiday","No School",""],
["2027-01-21","community","Spirit Night — Freddy's (Highlands Ranch)","11:00 am-9:00 pm · 900 Sgt Jon Stiles Dr., Highlands Ranch","Community",""],
["2027-01-21","community","Spirit Night — Freddy's (Littleton)","4:00-8:00 pm · 2660 W. Belleview Ave., Littleton","Community",""],
["2027-01-22","faith","All School Mass","Preschool-8","Faith",""],
["2027-01-29","faith","All School Mass","Preschool-8","Faith",""],
["2027-01-31","community","Catholic Schools Week","Jan 31 – Feb 5","Community",""],
["2027-01-31","community","Sapientia Sunday Open House","9:30 am — Prospective families welcome","Community",""],
["2027-02-02","faith","Presentation of the Lord — All School Mass","Noon Dismissal, 9:30 am Mass","Faith|Important",""],
["2027-02-02","faith","Confirmation Parent Workshop","6:30 pm, Joachim Hall · Mandatory · Sponsor attendance highly encouraged","Faith",""],
["2027-02-03","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2027-02-10","faith","Ash Wednesday — All School Mass","Preschool-8, Mass Uniform","Faith|Important",""],
["2027-02-11","noclasses","Parent/Teacher Conferences — No School","Feb 11-12. Schedule through the portal","No School|Important","","2027-02-15"],
["2027-02-15","noclasses","Presidents Day — No School","Observed Holiday","No School",""],
["2027-02-16","faith","1st Communion Parent Workshop","6:30 pm, Joachim Hall · Mandatory for parents","Faith",""],
["2027-02-19","community","Bookends of Beauty at 7PM","The Secret Diary of Elisabeth Leseur: The Woman whose Goodness Changed Her Husband from Atheist to Priest","Community","assets/events/Bookends of Beauty 26-27.pdf"],
["2027-02-19","faith","All School Mass","Preschool-8","Faith",""],
["2027-02-23","faith","1st Reconciliation — SMS","6:30 pm, in the church","Faith",""],
["2027-02-26","academic","End of Trimester","Report cards to follow","Academic|Important",""],
["2027-03-02","faith","1st Reconciliation — Bethlehem / Home School","6:30 pm, in the church","Faith",""],
["2027-03-03","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2027-03-03","faith","All School Mass","","Faith",""],
["2027-03-04","noclasses","No School — Teacher Retreat","Staff only","No School",""],
["2027-03-05","noclasses","No School — AoD In-Service","Staff only","No School",""],
["2027-03-06","faith","Reconciliation Celebration (Festival of Forgiveness)","6–9 pm","Faith",""],
["2027-03-09","community","Financial Aid Support Night","5:00 pm","Community",""],
["2027-03-12","faith","All School Mass","Preschool-8","Faith",""],
["2027-03-13","faith","Confirmation / 1st Communion Day Retreat","9 am–1 pm, in the church · Mandatory for children receiving First Communion & Confirmation","Faith",""],
["2027-03-14","community","Sapientia Sunday","9:30 am","Community",""],
["2027-03-15","academic","8th Grade Washington D.C. Trip","Mar 15-19","Academic",""],
["2027-03-19","faith","All School Mass","Preschool-8","Faith",""],
["2027-03-23","faith","Stations of the Cross","2:15 pm","Faith",""],
["2027-03-25","faith","Holy Thursday — Mass / Noon Dismissal","Mass Uniform, pick-up at 12:00 pm","Faith|Important",""],
["2027-03-26","noclasses","Good Friday — No School","Spring Break begins","No School|Important","","2027-04-04"],
["2027-03-29","noclasses","Spring Break — No School","Mar 29-Apr 2. School resumes April 5","No School|Important",""],
["2027-04-05","faith","All School Mass","Preschool-8","Faith",""],
["2027-04-06","community","Shorts Resume","","Community",""],
["2027-04-07","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2027-04-09","academic","5th Grade Play","6:00 pm, Ave Maria Hall","Academic",""],
["2027-04-11","community","Sapientia Sunday","9:30 am","Community",""],
["2027-04-16","faith","All School Mass","Preschool-8","Faith",""],
["2027-04-21","academic","JPII Outdoor Lab — 7th Grade Only","Apr 21-23, off campus","Academic",""],
["2027-04-23","academic","6th Grade Musical","6:00 pm, Ave Maria Hall","Academic",""],
["2027-04-27","faith","Confirmation & 1st Communion Rehearsal","6:30–8 pm, in the church · Mandatory · Sponsor attendance required","Faith",""],
["2027-04-28","academic","Taste Star — 4th Grade","10:00 am, Marian Hall","Academic|Community",""],
["2027-04-29","faith","All School Mass","Preschool-8","Faith",""],
["2027-04-30","noclasses","No School — Teacher In-Service","Staff only","No School",""],
["2027-04-30","community","Bookends of Beauty at 7PM","Theo of Golden by Allen Levi","Community","assets/events/Bookends of Beauty 26-27.pdf"],
["2027-05-01","faith","Confirmation & First Communion Mass","10 am: Homeschool & SMS Class 1 (arrive 9:30) · 2 pm: Bethlehem & SMS Class 2 (arrive 1:30)","Faith|Important",""],
["2027-05-03","faith","May Crowning","9:30 am, All School Mass · Wear 1st Communion gear","Faith",""],
["2027-05-04","community","SMPA Meeting","6:00 pm, Library","Community",""],
["2027-05-05","community","Step Into the Story","","Community",""],
["2027-05-09","community","Sapientia Sunday","9:30 am","Community",""],
["2027-05-12","community","New Parent & Kindergarten Welcome Night","","Community",""],
["2027-05-13","faith","All School Mass","Preschool-8","Faith",""],
["2027-05-14","noclasses","No School — School Golf Tournament","Faculty fundraising event","No School",""],
["2027-05-20","community","Lakeside Night — TBD","","Community",""],
["2027-05-21","faith","All School Mass","Preschool-8","Faith",""],
["2027-05-26","community","Preschool St. Sebastian Day","","Community",""],
["2027-05-27","community","8th Grade Graduation Dance","","Community",""],
["2027-05-28","faith","8th Grade Graduation Mass","Parish Church — invitations required","Faith|Academic|Important",""],
["2027-05-28","academic","Saints in Action & Last Day of School — Noon Dismissal","Pick-up at 12:00 pm. Final report cards available","Academic|Important",""]
];

/* =========================================================
   APP
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/(\d)–(\d)/g, '$1–\u2060$2');

  // ---- Dates (AP style, as the St. Mary style guide asks) ----
  const MON_AP = ['Jan.','Feb.','March','April','May','June','July','Aug.','Sept.','Oct.','Nov.','Dec.'];
  const MON_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MON_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DOW_S = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmtLong = (d) => `${DOW[d.getDay()]}, ${MON_AP[d.getMonth()]} ${d.getDate()}`;
  const fmtShort = (d) => `${MON_AP[d.getMonth()]} ${d.getDate()}`;
  const cleanTime = (s) => s.replace(/(\d)\s?(am|pm)\b/gi, (m, n, ap) => `${n} ${ap.toLowerCase() === 'am' ? 'a.m.' : 'p.m.'}`);

  // "Today" — can be overridden for testing with ?today=2026-11-10
  const qsToday = new URLSearchParams(location.search).get('today');
  const now = new Date();
  const today = qsToday && /^\d{4}-\d{2}-\d{2}$/.test(qsToday) ? parse(qsToday) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ---- Event model ----
  const CAT_LABEL = { noschool:'No school', faith:'Faith', academic:'Academic', community:'Community', health:'Health' };
  const BADGE_CAT = { 'No School':'noschool', 'Faith':'faith', 'Academic':'academic', 'Community':'community', 'Health':'health' };
  const events = EVENTS.map((e, i) => {
    const [date, cat, title, detail, badges, url, end] = e;
    const b = badges ? badges.split('|') : [];
    const noon = /noon dismissal/i.test(title + ' ' + detail);
    const main = cat === 'noclasses' ? 'noschool' : cat;
    const cats = new Set([main, ...b.map(x => BADGE_CAT[x]).filter(Boolean)]);
    if (noon) cats.add('noschool');
    const tags = [...new Set(b.map(x => BADGE_CAT[x]).filter(Boolean))];
    if (!tags.length) tags.push(main);
    return { i, id:`ev-${i}`, d: parse(date), end: end ? parse(end) : null, date, cat: main, cats, title, detail: cleanTime(detail), url, important: b.includes('Important'), noon, tags };
  }).sort((a, b) => a.d - b.d || a.i - b.i);

  const tagHTML = (e) => {
    const t = e.tags.map(c => `<span class="tag tag--${c}">${c === 'noschool' ? 'No school' : CAT_LABEL[c]}</span>`);
    if (e.noon && !e.tags.includes('noschool')) t.unshift('<span class="tag tag--noschool">Noon dismissal</span>');
    if (e.important) t.push('<span class="tag tag--important">Important</span>');
    return `<span class="tags">${t.join('')}</span>`;
  };
  const isNoSchool = (e) => e.cats.has('noschool');

  // ---- Config-driven bits ----
  $$('.js-email').forEach(a => a.href = `mailto:${CONFIG.officeEmail}`);
  $$('.js-email-text').forEach(s => s.textContent = CONFIG.officeEmail);
  const calId = CONFIG.googleCalendarId.trim();
  $$('.js-sub-google').forEach(a => {
    if (calId) { a.href = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calId)}`; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.title = 'Coming soon'; }
  });
  $$('.js-sub-ics').forEach(a => {
    if (calId) a.href = `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`;
    else { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.title = 'Coming soon'; }
  });

  // ---- Mobile menu ----
  const menuBtn = $('.menu-btn'), menu = $('#mobile-menu');
  const setMenu = (open) => { menuBtn.setAttribute('aria-expanded', String(open)); menu.hidden = !open;
    menuBtn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu'); menuBtn.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Menu'; };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  // ---- Alert banner: next no-school day within CONFIG.alertDays ----
  const soon = events.find(e => isNoSchool(e) && e.d >= today && e.d <= addDays(today, CONFIG.alertDays));
  if (soon) {
    const ord = (n) => n + ([11,12,13].includes(n % 100) ? 'th' : ({1:'st',2:'nd',3:'rd'}[n % 10] || 'th'));
    const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const s0 = soon.d, s1 = soon.end;
    const when = s1 && key(s1) !== key(s0)
      ? `${MON3[s0.getMonth()]} ${ord(s0.getDate())}–${s1.getMonth() !== s0.getMonth() ? MON3[s1.getMonth()] + ' ' : ''}${ord(s1.getDate())}`
      : `${MON3[s0.getMonth()]} ${ord(s0.getDate())}`;
    $('#alert-text').innerHTML = `<strong>${when}: ${esc(soon.title.replace(/\s*—\s*/g, ' – '))}</strong>`;
    $('#alert-link').href = `#${soon.id}`;
    $('#alert').hidden = false;
  }

  // ---- This week / next week ----
  const weekStart = addDays(today, -today.getDay());
  const w1End = addDays(weekStart, 6), w2Start = addDays(weekStart, 7), w2End = addDays(weekStart, 13);
  $('#today-label').textContent = `Today is ${fmtLong(today)}`;
  $('#wk1-label').textContent = `This week · ${fmtShort(weekStart)}–${w1End.getMonth() === weekStart.getMonth() ? w1End.getDate() : fmtShort(w1End)}`;
  $('#wk2-label').textContent = `Next week · ${fmtShort(w2Start)}–${w2End.getMonth() === w2Start.getMonth() ? w2End.getDate() : fmtShort(w2End)}`;
  const weekItem = (e, isSoon) => `<li><a class="ev-card" href="#${e.id}">
      <span class="date-chip${isSoon ? ' is-soon' : ''}"><span class="m">${MON_SHORT[e.d.getMonth()]}</span><span class="d">${e.d.getDate()}</span></span>
      <span class="ev-body"><span class="ev-title">${esc(e.title)}</span><span class="ev-meta">${DOW[e.d.getDay()]}${e.detail ? ' · ' + esc(e.detail) : ''}</span></span>
      ${tagHTML(e)}</a></li>`;
  const w1 = events.filter(e => e.d >= today && e.d <= w1End);
  const w2 = events.filter(e => e.d >= w2Start && e.d <= w2End);
  $('#wk1').innerHTML = w1.length ? w1.map(e => weekItem(e, true)).join('') : '<li class="empty-note">Nothing else on the calendar this week.</li>';
  $('#wk2').innerHTML = w2.length ? w2.map(e => weekItem(e, false)).join('') : '<li class="empty-note">Nothing on the calendar next week.</li>';

  // ---- Documents ----
  const DAY_MS = 864e5;
  const isNew = (it) => it.added && (today - parse(it.added)) / DAY_MS <= 30;
  const icon = (it) => it.type === 'ext' ? 'i-ext' : it.type === 'web' ? 'i-arrow' : 'i-dl';
  const docTotal = DOCS.reduce((n, c) => n + c.items.length, 0);
  $('#docs-intro').textContent = `${docTotal} forms, handbooks and flyers for 2026–27, grouped by what you need to do.`;
  $('#most').innerHTML = MOST_USED.map(([c, i]) => { const it = DOCS.find(x => x.id === c).items[i];
    return `<li><a href="${esc(it.h)}"><svg class="icon" style="color:var(--navy);width:24px;height:24px" aria-hidden="true"><use href="#i-doc"/></svg><span class="t">${esc(it.t)}</span><span class="meta">${esc(it.m)}</span></a></li>`; }).join('');
  const renderDocs = (q = '') => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const match = (it) => !words.length || words.every(w => (it.t + ' ' + (it.k || '')).toLowerCase().includes(w));
    let shown = 0;
    $('#cats').innerHTML = DOCS.map(c => {
      const items = c.items.filter(match); shown += items.length;
      if (!items.length) return '';
      const noun = c.id === 'forms' ? 'form' : c.id === 'flyers' ? 'flyer' : 'document';
      return `<section class="cat" id="cat-${c.id}" aria-labelledby="cat-${c.id}-t">
        <div class="cat-top"><h3 class="h3" id="cat-${c.id}-t">${esc(c.name)}</h3><span class="caption">${items.length} ${noun}${items.length > 1 ? 's' : ''}</span></div>
        <p class="small">${esc(c.desc)}</p>
        <ul class="doc-list">${items.map(it => `<li><a href="${esc(it.h)}"${it.type === 'ext' ? ' target="_blank" rel="noopener"' : ''}>
          <span>${esc(it.t)}${isNew(it) ? '<span class="badge-new">New</span>' : ''}</span>
          <span class="doc-meta">${esc(it.m)}<svg class="icon" aria-hidden="true"><use href="#${icon(it)}"/></svg>${it.type === 'ext' ? '<span class="sr-only">(opens in a new tab)</span>' : ''}</span></a></li>`).join('')}</ul></section>`;
    }).join('');
    $('#most-wrap').hidden = words.length > 0;
    $('#docs-empty').hidden = shown > 0;
    $('#doc-status').textContent = words.length ? `${shown} document${shown === 1 ? '' : 's'} found` : '';
  };
  renderDocs();
  $('#doc-filter').addEventListener('input', (e) => renderDocs(e.target.value));

  // ---- Calendar ----
  const FILTERS = [['all','All events'],['noschool','No school & early dismissal'],['faith','Faith'],['academic','Academic'],['community','Community'],['health','Health']];
  let filter = 'all', showAll = false, view = 'list';
  $('#filters').innerHTML = FILTERS.map(([k, l]) => `<button type="button" class="fchip" data-f="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? '' : `<span class="sw sw--${k}" aria-hidden="true"></span>`}${l}</button>`).join('');
  $('#filters').addEventListener('click', (e) => { const b = e.target.closest('.fchip'); if (!b) return;
    filter = b.dataset.f; $$('.fchip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderList(); renderMonth(); });
  const passes = (e) => filter === 'all' || e.cats.has(filter);

  const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
  const rowHTML = (e, past) => `<li class="row${isNoSchool(e) ? ' is-noschool' : ''}${past ? ' is-past' : ''}" id="${e.id}">
      <span class="row-date"><span class="d">${e.d.getDate()}</span><span class="w">${DOW_S[e.d.getDay()]}</span></span>
      <span class="row-body">${e.url ? `<a class="row-title" href="${esc(e.url)}"${/^https?:/.test(e.url) ? ' target="_blank" rel="noopener"' : ''}>${esc(e.title)}</a>` : `<span class="row-title">${esc(e.title)}</span>`}
      ${e.detail ? `<span class="small">${esc(e.detail)}</span>` : ''}<span class="sr-only">${fmtLong(e.d)}</span></span>${tagHTML(e)}</li>`;
  const groupHTML = (list, past) => {
    const groups = new Map();
    list.forEach(e => { const k = monthKey(e.d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    return [...groups.values()].map(g => `<div class="month"><h3 class="h3">${MON_FULL[g[0].d.getMonth()]} ${g[0].d.getFullYear()}</h3><ul class="rows">${g.map(e => rowHTML(e, past)).join('')}</ul></div>`).join('');
  };
  const renderList = () => {
    const past = events.filter(e => e.d < today && passes(e));
    const up = events.filter(e => e.d >= today && passes(e));
    const months = [...new Set(up.map(e => monthKey(e.d)))];
    const limit = showAll ? Infinity : (months[1] ?? months[0] ?? 0);
    const visible = up.filter(e => monthKey(e.d) <= limit);
    $('#upcoming-months').innerHTML = visible.length ? groupHTML(visible, false) : '<p class="empty-note">No upcoming events of this type.</p>';
    $('#past-months').innerHTML = groupHTML(past, true);
    const tp = $('#toggle-past');
    tp.hidden = past.length === 0;
    const open = tp.getAttribute('aria-expanded') === 'true';
    tp.textContent = open ? `Hide ${past.length} past events` : `Show ${past.length} past events`;
    $('#cal-status-text').textContent = `Showing upcoming events from today, ${fmtLong(today)}.`;
    const rest = up.length - visible.length, more = $('#show-more');
    more.hidden = rest <= 0;
    if (rest > 0) { const lastM = up[up.length - 1].d; const nextM = up.find(e => monthKey(e.d) > limit).d;
      more.textContent = `Show ${MON_FULL[nextM.getMonth()]}–${MON_FULL[lastM.getMonth()]} ${lastM.getFullYear()} (${rest} more events)`; }
  };
  $('#toggle-past').addEventListener('click', (e) => { const b = e.currentTarget; const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open)); $('#past-months').hidden = !open; renderList(); });
  $('#show-more').addEventListener('click', () => { showAll = true; renderList(); });

  // Jump from "This week" / alert to a row, even if it is in a collapsed range
  const reveal = (id) => {
    const ev = events.find(e => e.id === id); if (!ev) return;
    if (view !== 'list') setView('list');
    if (!passes(ev)) { filter = 'all'; $$('.fchip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.f === 'all'))); }
    if (ev.d < today) { $('#toggle-past').setAttribute('aria-expanded', 'true'); $('#past-months').hidden = false; }
    else showAll = true;
    renderList();
    const row = document.getElementById(id); if (!row) return;
    $$('.row.is-target').forEach(r => r.classList.remove('is-target'));
    row.classList.add('is-target'); row.setAttribute('tabindex', '-1');
    row.scrollIntoView({ block: 'center' }); row.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#ev-"]'); if (!a) return; e.preventDefault(); reveal(a.getAttribute('href').slice(1)); });

  // Month view
  const first = events[0].d, last = events[events.length - 1].d;
  const minM = monthKey(first), maxM = monthKey(last);
  let curM = Math.min(Math.max(monthKey(today), minM), maxM);
  let selDay = null;
  const renderMonth = () => {
    const y = Math.floor(curM / 12), m = curM % 12;
    $('#m-title').textContent = `${MON_FULL[m]} ${y}`;
    $('#m-prev').disabled = curM <= minM; $('#m-next').disabled = curM >= maxM;
    const start = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    events.filter(e => e.d.getFullYear() === y && e.d.getMonth() === m && passes(e)).forEach(e => (byDay[e.d.getDate()] ||= []).push(e));
    let html = '<tr>', col = 0;
    for (let i = 0; i < start.getDay(); i++, col++) html += '<td class="out"></td>';
    for (let d = 1; d <= days; d++, col++) {
      if (col && col % 7 === 0) html += '</tr><tr>';
      const date = new Date(y, m, d), list = byDay[d] || [], isToday = key(date) === key(today);
      if (list.length) {
        const label = `${fmtLong(date)}${isToday ? ' (today)' : ''}: ${list.length} event${list.length > 1 ? 's' : ''}`;
        html += `<td class="${isToday ? 'is-today' : ''}"><button type="button" class="dbtn" data-day="${d}" aria-pressed="${selDay === key(date)}" aria-label="${label}">
          <span class="dnum">${d}</span><span class="dots">${list.slice(0, 4).map(e => `<i class="dot dot--${isNoSchool(e) ? 'noschool' : e.cat}"></i>`).join('')}</span>
          <span class="dcount">${list.length === 1 ? esc(list[0].title.length > 22 ? list[0].title.slice(0, 21) + '…' : list[0].title) : list.length + ' events'}</span></button></td>`;
      } else {
        html += `<td class="${isToday ? 'is-today' : ''}"><span class="dplain"><span class="dnum">${d}</span>${isToday ? '<span class="sr-only"> (today)</span>' : ''}</span></td>`;
      }
    }
    while (col % 7) { html += '<td class="out"></td>'; col++; }
    $('#m-grid tbody').innerHTML = html + '</tr>';
    const sel = selDay && parse(selDay);
    if (sel && sel.getFullYear() === y && sel.getMonth() === m && byDay[sel.getDate()]) {
      $('#m-day').innerHTML = `<h3 class="h3">${fmtLong(sel)}</h3><ul class="rows" style="list-style:none;margin:0;padding:0;border-top:1px solid var(--gray)">${byDay[sel.getDate()].map(e => rowHTML(e, e.d < today).replace(`id="${e.id}"`, '')).join('')}</ul>`;
    } else $('#m-day').innerHTML = '<p class="small">Select a highlighted day to see its events.</p>';
  };
  $('#m-grid').addEventListener('click', (e) => { const b = e.target.closest('.dbtn'); if (!b) return;
    const y = Math.floor(curM / 12), m = curM % 12; selDay = key(new Date(y, m, Number(b.dataset.day))); renderMonth();
    const again = $(`.dbtn[data-day="${b.dataset.day}"]`); again && again.focus(); });
  $('#m-prev').addEventListener('click', () => { if (curM > minM) { curM--; selDay = null; renderMonth(); } });
  $('#m-next').addEventListener('click', () => { if (curM < maxM) { curM++; selDay = null; renderMonth(); } });

  const setView = (v) => { view = v; $('#view-list').setAttribute('aria-pressed', String(v === 'list')); $('#view-month').setAttribute('aria-pressed', String(v === 'month'));
    $('#list-view').hidden = v !== 'list'; $('#month-view').hidden = v !== 'month'; if (v === 'month') renderMonth(); };
  $('#view-list').addEventListener('click', () => setView('list'));
  $('#view-month').addEventListener('click', () => setView('month'));
  renderList();

  // ---- Site search (documents + events) ----
  const index = [
    ...DOCS.flatMap(c => c.items.map(it => ({ title: it.t, kind: it.m, href: it.h, text: (it.t + ' ' + (it.k || '') + ' ' + c.name).toLowerCase(), ext: it.type === 'ext' }))),
    ...events.filter(e => e.d >= today).map(e => ({ title: e.title, kind: fmtShort(e.d), href: '#' + e.id, text: (e.title + ' ' + e.detail + ' ' + [...e.cats].map(c => CAT_LABEL[c]).join(' ')).toLowerCase() }))
  ];
  const q = $('#q'), res = $('#q-results'), status = $('#q-status');
  const runSearch = () => {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) { res.hidden = true; status.textContent = ''; return; }
    const hits = index.filter(r => words.every(w => r.text.includes(w))).slice(0, 8);
    res.hidden = false;
    res.innerHTML = hits.length
      ? `<ul>${hits.map(h => `<li><a href="${esc(h.href)}"${h.ext ? ' target="_blank" rel="noopener"' : ''}><span>${esc(h.title)}</span><span class="kind">${esc(h.kind)}</span></a></li>`).join('')}</ul>`
      : `<p class="empty">No results for “${esc(q.value)}”. Try another word or <a href="#contact">contact the front office</a>.</p>`;
    status.textContent = hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'No results';
  };
  q.addEventListener('input', runSearch);
  $('#site-search').addEventListener('submit', (e) => { e.preventDefault(); const firstLink = $('a', res); if (firstLink) firstLink.focus(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; runSearch(); } if (e.key === 'ArrowDown') { const a = $('a', res); if (a) { e.preventDefault(); a.focus(); } } });
  res.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) { res.hidden = true; } });
})();
