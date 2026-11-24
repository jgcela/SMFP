/*
  St. Mary School Messenger — issue manifest
  ────────────────────────────────────────────────────────────────
  Shared by messenger-archive.html (the list) and messenger.html
  (the reader). Add one entry per week when a new Messenger goes out.

  HOW TO ADD A NEW ISSUE
  1. Open the "St. Mary School Messenger MM.DD.YY" email, view source /
     export the HTML body, and save it as:
       assets/messenger/data/YYYY-MM-DD.html
  2. Strip the Flocknote email-service footer from that saved file: the
     block that starts at <div id="footer1_around" ...> and ends at the
     matching </div> right before the outer </td></tr></table>. It holds
     "Sent by School Communications", the admin-reply note, the
     safe-senders note, the Flocknote logo, and the my info/unsubscribe/
     mailing-address links — none of it applies on the website, so it
     must be removed from every issue, not just this first one.
  3. Before the closing </body> tag of that saved file, paste the resize
     script found at the bottom of assets/messenger/data/2026-08-16.html
     (it posts the page's real height to messenger.html so the reader
     never gets clipped — this step is required, not optional).
  4. Add a new object to the TOP of MESSENGER_ISSUES below (newest first).
  5. Fill in date, displayDate, file, excerpt, and highlights.
  6. Bump the ?v=YYYY-MM-DD on the manifest.js <script> tag in both
     messenger-archive.html and messenger.html to today's issue date.
     Without this, browsers that already cached the old manifest.js
     won't see the new issue until their cache happens to expire.
*/

const MESSENGER_ISSUES = [
  {
    date: '2026-11-09',
    displayDate: 'November 9, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-11-09.html',
    title: 'Are We Killing Our Children’s Dreams?',
    excerpt: 'Fr. James on imagination, the saints, and nurturing our children’s dreams, Fr. Juan Espino on Sapientiae Sunday and the first graders’ Vocations Chalice, the week’s calendar, and news on the Father Daughter Dance, Box Tops, Spirit Nights, the Yearbook, and the Thanksgiving Pie Sale.',
    highlights: [
      'Nov 13 — End of 1st Trimester, All School Mass',
      'Nov 19 — Preschool Niña Maria @ 8:30AM',
      'Nov 20 — All School Mass Preschool-8',
      'Nov 25-29 — Thanksgiving Break, No School'
    ]
  },
  {
    date: '2026-11-02',
    displayDate: 'November 2, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-11-02.html',
    title: 'Why We Should Speak to Our Children About Heaven',
    excerpt: 'Fr. James on talking with our children about death, holiness, and heaven, Fr. Juan Espino on hope, the All Saints celebration, and praying for the faithful departed, the week’s calendar, and news on Picture Retakes, the Pro-Life Symposium, Niña Maria Gathering, and the Yearbook.',
    highlights: [
      'Nov 2 — All Souls Day Mass @ 6:30PM',
      'Nov 4 — SMPA Meeting @ Library, 6PM',
      'Nov 6 — Picture Retakes (Mass Uniform)',
      'Nov 8 — Sapientia Sunday @ 9:30AM'
    ]
  },
  {
    date: '2026-10-26',
    displayDate: 'October 26, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-10-26.html',
    title: 'A Night of Virtue: Industriousness',
    excerpt: 'Fr. James on the success of the fourth annual Gala and the community behind it, Fr. Juan Espino on holiness, spousal love, and praying for the souls in purgatory, the week’s calendar, and news on the Thanksgiving Food Drive, Box Tops, Art Club, and Trunk or Treat.',
    highlights: [
      'Oct 29 — All Saints Day Celebration',
      'Oct 30 — No School, Teacher In-Service',
      'Nov 2 — All Souls Day Mass @ 6:30PM',
      'Nov 4 — SMPA Meeting @ Library, 6PM'
    ]
  },
  {
    date: '2026-10-19',
    displayDate: 'October 19, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-10-19.html',
    title: 'What Has Happened to Our Children’s Imagination?',
    excerpt: 'Fr. James on helping children imagine greatness and discover their vocation, Fr. Juan Espino on the saints of October and St. John Paul II Day, the week’s calendar, and news on the Gala Silent Auction, Thanksgiving Food Drive, Yearbook Cover Art Contest, and Trunk or Treat.',
    highlights: [
      'Oct 22 — St. John Paul II Day, All School Mass',
      'Oct 24 — “A Night of Virtue” Gala @ Ken Caryl Vista, 5-11PM',
      'Oct 29 — All Saints Day Celebration',
      'Oct 30 — No School, Teacher In-Service'
    ]
  },
  {
    date: '2026-10-12',
    displayDate: 'October 12, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-10-12.html',
    title: 'Do Children Really Need a Cell Phone?',
    excerpt: 'Fr. James on the right age for a child’s first cell phone, Fr. Juan Espino on keeping a spirit of thanksgiving after the parish’s 125th anniversary, the week’s calendar, and news on the Fall Open House, Trunk or Treat, Thanksgiving Pie Sale, and Soccer Stars.',
    highlights: [
      'Oct 18 — Open House / Sapientia Sunday @ 9:30AM',
      'Oct 22 — St. John Paul II Day, All School Mass',
      'Oct 24 — “A Night of Virtue” Gala @ Ken Caryl Vista, 5-11PM',
      'Oct 29 — Picture Retakes (Mass Uniform)'
    ]
  },
  {
    date: '2026-10-05',
    displayDate: 'October 5, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-10-05.html',
    title: 'Anniversary and Gratitude',
    excerpt: 'Fr. James on gratitude and the 125th anniversary of the parish and 75th of the school, Fr. Juan Espino on thanking our parent volunteers, St. Francis of Assisi, and praying the Rosary, the week’s calendar, the Fiscal Year 2026 Annual Report, and news on the School Gala, Basketball, Soccer Stars, and Art Club.',
    highlights: [
      'Oct 7 — SMPA Meeting @ Library, 6PM',
      'Oct 8-9 — Parent/Teacher Conferences, No School',
      'Oct 10 — 125th Parish Celebration Mass @ 4:30PM',
      'Oct 24 — “A Night of Virtue” Gala @ Ken Caryl Vista, 5-11PM'
    ]
  },
  {
    date: '2026-09-28',
    displayDate: 'September 28, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-09-28.html',
    title: 'Virtues You Need to Be Dependent',
    excerpt: 'Fr. James on accepting our dependence and the virtues it calls for, Fr. Juan Espino on the great saints of the week as October begins, the week’s calendar, and news on the School Gala, Basketball, Chicken Club, and Art Club.',
    highlights: [
      'Sep 29 — Sacrament Preparation Workshop @ Joachim Hall, 6:30PM',
      'Oct 2 — All School Mass Preschool-8',
      'Oct 5 — Last Day to Buy Gala Tickets',
      'Oct 7 — SMPA Meeting @ Library, 6PM'
    ]
  },
  {
    date: '2026-09-21',
    displayDate: 'September 21, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-09-21.html',
    title: 'Father Riley’s Ordination',
    excerpt: 'Fr. James reflects on Deacon Riley Blanchard’s ordination and the call to the priesthood, Fr. Juan Espino on the 7th/8th grade Focus retreat and the Feast of St. Matthew, the week’s calendar, and news on the School Gala, Chicken Club, Bookends of Beauty, and Chess Club.',
    highlights: [
      'Sep 24 — All School Mass K-8',
      'Sep 25 — No School, Teacher In-Service',
      'Oct 5 — Last Day to Buy Gala Tickets',
      'Oct 7 — SMPA Meeting @ Library, 6PM'
    ]
  },
  {
    date: '2026-09-14',
    displayDate: 'September 14, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-09-14.html',
    title: 'Does Suffering Have a Meaning?',
    excerpt: 'Fr. James on giving meaning to suffering for the Feast of the Exaltation of the Holy Cross, Fr. Juan Espino on the Marian Festival and Deacon Riley’s upcoming ordination, the week’s calendar, and news on the School Gala, Chicken Club, and Spirit Wear.',
    highlights: [
      'Sep 18 — Picture Day (Mass Uniform)',
      'Sep 24 — All School Mass K-8',
      'Sep 25 — No School, Teacher In-Service',
      'Oct 7 — SMPA Meeting @ Library, 6PM'
    ]
  },
  {
    date: '2026-09-07',
    displayDate: 'September 7, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-09-07.html',
    title: 'Mary’s Fiat: Virtue and the Art of Depending',
    excerpt: 'Fr. James on virtue, independence, and learning to depend on God like Mary’s Fiat, Fr. Juan Espino on the Marian Festival groundbreaking and Deacon Riley’s ordination, the week’s calendar, and news on the School Gala, Spirit Wear, and Chess Club.',
    highlights: [
      'Sep 12 — Marian Festival, Mass moved to 4PM',
      'Sep 13 — Sapientia Sunday @ 9:30AM',
      'Sep 18 — Picture Day (Mass Uniform)',
      'Sep 20 — Priestly Ordination @ 9:30 Mass'
    ]
  },
  {
    date: '2026-08-31',
    displayDate: 'August 31, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-08-31.html',
    title: 'The Grateful Approach',
    excerpt: 'Fr. James on beginning the school year with gratitude, Fr. Juan Espino introduces the new Memorare tradition, the week’s calendar, and news on the School Gala, Marian Festival volunteering, Spirit Wear, and Chess Club.',
    highlights: [
      'Sep 2 — SMPA Meeting @ Library, 6PM',
      'Sep 7 — Labor Day, No School',
      'Sep 12 — Marian Festival',
      'Sep 18 — All School Mass / Picture Day'
    ]
  },
  {
    date: '2026-08-24',
    displayDate: 'August 24, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-08-24.html',
    title: 'The Magnanimous Approach',
    excerpt: 'Fr. James on preparing our children for hardship rather than just promising them ease, a welcome from Fr. Juan Espino, the week’s calendar, and news on Marian Festival registration, Spirit Wear, Chess Club, and Watch D.O.G.S.',
    highlights: [
      'Aug 27 — Watch D.O.G.S. Kickoff @ Joachim Hall, 6:30PM',
      'Aug 28 — Back to School Night @ Blacktop, 5PM',
      'Sep 2 — SMPA Meeting @ Library, 6PM',
      'Sep 12 — Marian Festival'
    ]
  },
  {
    date: '2026-08-16',
    displayDate: 'August 16, 2026',
    schoolYear: '2026-2027',
    file: 'assets/messenger/data/2026-08-16.html',
    title: 'Welcome Back',
    excerpt: 'Fr. James reflects on starting the new school year, the first weeks’ calendar of Masses and events, and an introduction to the new Parent Portal.',
    highlights: [
      'Aug 17 — First Day of School',
      'Aug 21 — All School Mass K-8',
      'Aug 28 — Back to School Night @ Blacktop, 5PM',
      'Sep 2 — SMPA Meeting @ Library, 6PM'
    ]
  }
];
