// GCSE English Literature content: Macbeth. Server-only (never shipped to the browser in full).
// Shape is shared by every text: see api/_literature/index.js. Quotations are short and checked
// against the play; act/scene numbers follow the standard (e.g. Arden / Folger) numbering.

module.exports = {
  id: 'macbeth',
  title: 'Macbeth',
  author: 'William Shakespeare',
  form: 'Play (tragedy)',
  examBoards: ['AQA', 'Edexcel', 'OCR', 'Eduqas'],
  tagline: 'Ambition, prophecy and a kingdom drenched in blood.',
  accent: '#e0464e',

  characters: [
    { name: 'Macbeth', summary: 'Brave Scottish thane whose ambition, stirred by the witches and his wife, drives him to murder and tyranny.' },
    { name: 'Lady Macbeth', summary: 'Ambitious and controlling; persuades Macbeth to kill Duncan, then is destroyed by guilt.' },
    { name: 'Banquo', summary: 'Macbeth\'s fellow general; hears prophecies too but resists temptation. Ancestor of James I.' },
    { name: 'The Witches', summary: 'Supernatural "weird sisters" whose prophecies spark Macbeth\'s ambition.' },
    { name: 'Duncan', summary: 'The good, trusting King of Scotland murdered by Macbeth.' },
    { name: 'Macduff', summary: 'Loyal thane who suspects Macbeth, loses his family, and kills him.' },
    { name: 'Malcolm', summary: 'Duncan\'s son and heir; flees, returns with an army and is crowned at the end.' },
  ],
  themes: [
    { name: 'Ambition', summary: 'Unchecked ambition corrupts and destroys.' },
    { name: 'Kingship & power', summary: 'Good kings (Duncan, Malcolm) against the tyrant Macbeth.' },
    { name: 'The supernatural', summary: 'Witches, visions and ghosts blur reality and temptation.' },
    { name: 'Guilt', summary: 'Shown through blood, sleeplessness and madness.' },
    { name: 'Appearance vs reality', summary: '"Fair is foul": deception hides evil behind innocence.' },
    { name: 'Gender & masculinity', summary: 'Lady Macbeth links manhood to violence; Macduff shows another kind of man.' },
    { name: 'Order & disorder', summary: 'Regicide throws nature and the kingdom into chaos.' },
  ],
  events: [
    { where: 'Act 1 Scene 3', summary: 'The witches greet Macbeth as Thane of Cawdor and future king.' },
    { where: 'Act 1 Scene 7', summary: 'Lady Macbeth persuades a hesitating Macbeth to kill Duncan.' },
    { where: 'Act 2 Scene 2', summary: 'Duncan is murdered; Macbeth is horrified by the blood on his hands.' },
    { where: 'Act 3 Scene 4', summary: 'Banquo\'s ghost appears at the banquet.' },
    { where: 'Act 4 Scene 1', summary: 'The apparitions give Macbeth false security.' },
    { where: 'Act 4 Scene 2', summary: 'Macduff\'s wife and children are murdered.' },
    { where: 'Act 5 Scene 1', summary: 'Lady Macbeth sleepwalks, tormented by guilt.' },
    { where: 'Act 5 (final scene)', summary: 'Macduff kills Macbeth; Malcolm becomes king.' },
  ],
  quotations: [
    { text: 'Fair is foul, and foul is fair', speaker: 'The Witches', where: 'Act 1 Scene 1' },
    { text: 'Stars, hide your fires', speaker: 'Macbeth', where: 'Act 1 Scene 4' },
    { text: 'Look like th\' innocent flower, / But be the serpent under\'t', speaker: 'Lady Macbeth', where: 'Act 1 Scene 5' },
    { text: 'vaulting ambition, which o\'erleaps itself', speaker: 'Macbeth', where: 'Act 1 Scene 7' },
    { text: 'Is this a dagger which I see before me', speaker: 'Macbeth', where: 'Act 2 Scene 1' },
    { text: 'Will all great Neptune\'s ocean wash this blood / Clean from my hand?', speaker: 'Macbeth', where: 'Act 2 Scene 2' },
    { text: 'O, full of scorpions is my mind, dear wife!', speaker: 'Macbeth', where: 'Act 3 Scene 2' },
    { text: 'Out, damned spot!', speaker: 'Lady Macbeth', where: 'Act 5 Scene 1' },
    { text: 'this dead butcher and his fiend-like queen', speaker: 'Malcolm', where: 'final scene' },
  ],
  context: [
    'Written c.1606 for King James I, who wrote Daemonologie (1597) about witchcraft.',
    'The Gunpowder Plot (1605) made treason and regicide a live fear.',
    'The divine right of kings: monarchs were believed to be chosen by God.',
    'The Great Chain of Being: a God-given order that regicide disrupts.',
    'Jacobean women were expected to be obedient and nurturing.',
  ],
  techniques: ['Soliloquy', 'Aside', 'Dramatic irony', 'Pathetic fallacy', 'Imagery (blood, sleep, clothing, darkness)', 'Blank verse, prose and trochaic tetrameter', 'Tragic hero and hamartia', 'Comic relief (the Porter)'],

  // category: characters | themes | events | quotes | context | techniques. free: part of the free sample.
  flashcards: [
    // Characters
    { id: 'mac-c1', category: 'characters', free: true, q: 'How is Macbeth presented before he meets the witches?', a: 'As a heroic, loyal soldier. The Captain calls him "brave Macbeth" and describes him splitting a rebel "from the nave to th\' chops". His violence is praised because it serves the king, which makes his later violence against the king more shocking.' },
    { id: 'mac-c2', category: 'characters', q: 'What does Lady Macbeth fear about her husband in Act 1 Scene 5?', a: 'That he is "too full o\' th\' milk of human kindness" to seize the crown by murder. She resolves to "pour my spirits in thine ear", showing she means to manipulate him.' },
    { id: 'mac-c3', category: 'characters', q: 'How does Banquo act as a foil to Macbeth?', a: 'Both hear prophecies, but Banquo distrusts the witches, warning that "instruments of darkness tell us truths" to lead us to harm. He does not act on temptation, which highlights Macbeth\'s choice to act on his ambition.' },
    { id: 'mac-c4', category: 'characters', q: 'How does Lady Macbeth change between Act 1 and Act 5?', a: 'In Act 1 she is commanding, calling on spirits to "unsex me here" and dismissing guilt: "A little water clears us of this deed". By Act 5 she sleepwalks, washes imaginary blood ("Out, damned spot!"), speaks in broken prose and dies offstage. Guilt destroys her.' },
    { id: 'mac-c5', category: 'characters', q: 'What is Macduff\'s role in the play?', a: 'He discovers Duncan\'s body, suspects Macbeth and flees to England. After his family is murdered, he grieves openly ("I must also feel it as a man"), showing a different masculinity. As the man not "of woman born" in the usual way, he kills Macbeth and helps restore order.' },
    { id: 'mac-c6', category: 'characters', q: 'Why does it matter that Duncan is shown as a good king?', a: 'Duncan is generous and grateful ("O worthiest cousin!"), the ideal divinely appointed king. This makes regicide more monstrous. His trust is also a weakness: he admits there\'s "no art / To find the mind\'s construction in the face".' },
    // Themes
    { id: 'mac-t1', category: 'themes', free: true, q: 'What does Shakespeare suggest about ambition?', a: 'That unchecked ambition corrupts and destroys. Macbeth admits he has only "vaulting ambition, which o\'erleaps itself", like a rider leaping too far and falling. His rise leads to tyranny, isolation and death.' },
    { id: 'mac-t2', category: 'themes', q: 'How is guilt shown through the motif of sleep?', a: 'After the murder Macbeth hears a voice cry "Macbeth does murder sleep". He suffers "terrible dreams", and Lady Macbeth later sleepwalks. Sleep stands for innocence and peace, which guilt destroys.' },
    { id: 'mac-t3', category: 'themes', q: 'How does Shakespeare explore appearance versus reality?', a: 'The witches\' paradox "Fair is foul, and foul is fair" sets it up. Lady Macbeth tells Macbeth to "look like th\' innocent flower, / But be the serpent under\'t", and Duncan is fooled by both Cawdor and Macbeth. Evil hides behind honest faces.' },
    { id: 'mac-t4', category: 'themes', q: 'How are masculinity and gender explored?', a: 'Lady Macbeth ties manhood to violence: "When you durst do it, then you were a man". She rejects femininity ("unsex me here"). Macduff offers another model of manhood that includes feeling, and the bearded witches blur gender in an unnatural way.' },
    { id: 'mac-t5', category: 'themes', q: 'How does the play present good and bad kingship?', a: 'Duncan and Edward the Confessor (who heals the sick) model good kings; Malcolm lists the "king-becoming graces". Macbeth becomes a "tyrant", ruling by fear. Order returns only when the rightful king, Malcolm, is crowned.' },
    { id: 'mac-t6', category: 'themes', q: 'How does nature react to Duncan\'s murder, and why?', a: 'In Act 2 Scene 4 it is dark in daytime, an owl kills a falcon and Duncan\'s horses eat each other. Regicide breaks the natural, God-given order (the Great Chain of Being), so nature itself is thrown into chaos.' },
    // Key events
    { id: 'mac-e1', category: 'events', free: true, q: 'What happens when Macbeth and Banquo first meet the witches (Act 1 Scene 3)?', a: 'They hail Macbeth as Thane of Glamis, Thane of Cawdor and king hereafter, and tell Banquo he will father kings. Ross then brings news that Macbeth is Thane of Cawdor. The first prophecy coming true sets Macbeth thinking of murder.' },
    { id: 'mac-e2', category: 'events', q: 'Why is Duncan naming Malcolm Prince of Cumberland a turning point?', a: 'It blocks Macbeth\'s path to the throne. In an aside he says "Stars, hide your fires; / Let not light see my black and deep desires", showing he is now considering murder.' },
    { id: 'mac-e3', category: 'events', q: 'What happens straight after Duncan\'s murder (Act 2 Scenes 2–3)?', a: 'Macbeth returns still holding the daggers; Lady Macbeth takes them back and smears the guards with blood. Knocking is heard. Macduff discovers the body, Macbeth kills the guards, and Malcolm and Donalbain flee, which makes them look guilty.' },
    { id: 'mac-e4', category: 'events', q: 'Why does Macbeth have Banquo killed, and what goes wrong?', a: 'Banquo suspects him, and the prophecy means Banquo\'s sons, not Macbeth\'s, will be kings. The murderers kill Banquo but Fleance escapes, and Banquo\'s ghost appears at the banquet (Act 3 Scene 4), exposing Macbeth\'s guilt in public.' },
    { id: 'mac-e5', category: 'events', q: 'What do the three apparitions tell Macbeth in Act 4 Scene 1?', a: 'Beware Macduff; no man "of woman born" can harm him; he will not be defeated until Great Birnam Wood comes to Dunsinane. These give him false confidence. He is then shown a line of eight kings descended from Banquo.' },
    { id: 'mac-e6', category: 'events', q: 'How do the final prophecies come true?', a: 'Malcolm\'s soldiers carry branches from Birnam Wood as camouflage. Macduff reveals he was "from his mother\'s womb / Untimely ripped" (born by caesarean). He kills Macbeth, and Malcolm is crowned.' },
    // Quotes
    { id: 'mac-q1', category: 'quotes', free: true, q: '"Fair is foul, and foul is fair": who says it, and why is it important?', a: 'The witches, in Act 1 Scene 1. The paradox introduces appearance versus reality and a world where good and evil are confused. Macbeth\'s first line, "So foul and fair a day", echoes it, linking him to the witches before they meet.' },
    { id: 'mac-q2', category: 'quotes', q: '"Look like th\' innocent flower, / But be the serpent under\'t": who says it and what does it show?', a: 'Lady Macbeth to Macbeth, Act 1 Scene 5. The serpent recalls Satan in the Garden of Eden, so she is associated with evil and temptation. It shows her skill at deception.' },
    { id: 'mac-q3', category: 'quotes', q: '"Will all great Neptune\'s ocean wash this blood / Clean from my hand?": what does it reveal?', a: 'Macbeth just after the murder (Act 2 Scene 2). The hyperbole shows overwhelming guilt. It contrasts with Lady Macbeth\'s "A little water clears us of this deed", a contrast reversed when she sleepwalks in Act 5.' },
    { id: 'mac-q4', category: 'quotes', q: '"O, full of scorpions is my mind, dear wife!": what does the metaphor suggest?', a: 'Macbeth in Act 3 Scene 2. His thoughts are poisonous and painful: he is tormented by paranoia about Banquo. Although he still calls her "dear wife", he now keeps his plans from her, showing their partnership breaking down.' },
    { id: 'mac-q5', category: 'quotes', q: '"Out, damned spot!": what is the significance?', a: 'Lady Macbeth sleepwalking (Act 5 Scene 1). She tries to wash away imaginary blood, showing guilt she can no longer control. Her broken prose shows her mind collapsing.' },
    { id: 'mac-q6', category: 'quotes', q: '"this dead butcher and his fiend-like queen": who says it and why does it matter?', a: 'Malcolm in the final scene. It is how history will judge them: a "butcher" and a devilish queen. The contrast with "brave Macbeth" in Act 1 shows the scale of the tragic fall, though the audience has seen more complexity than Malcolm\'s verdict allows.' },
    // Context
    { id: 'mac-x1', category: 'context', free: true, q: 'Why did King James I\'s interest in witchcraft matter to Shakespeare\'s audience?', a: 'James wrote Daemonologie (1597) and believed witches had plotted against him in the North Berwick trials. For a Jacobean audience the witches were a real and frightening threat, and associating Macbeth with them condemns him.' },
    { id: 'mac-x2', category: 'context', q: 'What is the divine right of kings, and how does it relate to Duncan\'s murder?', a: 'The belief that monarchs are chosen by God. Killing a king was therefore a sin against God as well as a crime, which explains the unnatural events after the murder and Macbeth\'s damnation. It also flattered King James.' },
    { id: 'mac-x3', category: 'context', q: 'Why is the Gunpowder Plot (1605) relevant to Macbeth?', a: 'It was a recent attempt to kill James I. A play about treason and regicide (c.1606) would feel urgent. The Porter\'s joke about an "equivocator" is often linked to the Jesuit Henry Garnet, who defended equivocation at his trial for the Plot.' },
    { id: 'mac-x4', category: 'context', q: 'Why is Banquo presented so positively?', a: 'James I claimed descent from Banquo. In Shakespeare\'s source, Holinshed\'s Chronicles, Banquo helps kill Duncan; Shakespeare made him honourable instead, and the show of eight kings flatters James\'s Stuart line.' },
    { id: 'mac-x5', category: 'context', q: 'How does Lady Macbeth challenge Jacobean expectations of women?', a: 'Women were expected to be obedient, gentle and nurturing. Lady Macbeth takes control, calls on spirits to "unsex me here" and rejects motherly tenderness. An audience would see her as unnatural, even witch-like, and her downfall restores the expected order.' },
    { id: 'mac-x6', category: 'context', q: 'What is the Great Chain of Being, and how does it shape the play?', a: 'A God-given hierarchy: God, king, nobles, commoners, animals. Regicide breaks the chain, so nature rebels (darkness by day, horses eating each other). Order returns when the rightful king, Malcolm, takes the throne.' },
    // Language & techniques
    { id: 'mac-k1', category: 'techniques', q: 'What is a soliloquy, and how does Shakespeare use one in the dagger speech?', a: 'A speech alone on stage revealing a character\'s thoughts. In Act 2 Scene 1 ("Is this a dagger which I see before me") Macbeth hallucinates a dagger leading him to Duncan. It shows his disturbed mind and lets the audience share his inner conflict.' },
    { id: 'mac-k2', category: 'techniques', q: 'How is dramatic irony used when Duncan arrives at Inverness (Act 1 Scene 6)?', a: 'Duncan praises the castle\'s "pleasant seat" and greets Lady Macbeth warmly, while the audience knows she is planning his murder. The gap between his trust and our knowledge creates tension and horror.' },
    { id: 'mac-k3', category: 'techniques', q: 'Why do the witches speak differently from the other characters?', a: 'They use rhyming trochaic tetrameter ("Double, double toil and trouble") instead of blank verse. The chanting, spell-like rhythm marks them as unnatural and sets them apart from the human world.' },
    { id: 'mac-k4', category: 'techniques', q: 'Why does Lady Macbeth speak in prose in the sleepwalking scene?', a: 'Earlier she speaks in controlled blank verse. Fragmented prose in Act 5 Scene 1 shows her mental collapse, a structural reversal of the control she had in Act 1.' },
    { id: 'mac-k5', category: 'techniques', q: 'What role does the Porter scene (Act 2 Scene 3) play?', a: 'Comic relief straight after the murder, which heightens the tension. He pretends to be the porter of hell-gate, an irony because Macbeth\'s castle has become a kind of hell. The knocking continues the suspense.' },
    { id: 'mac-k6', category: 'techniques', q: 'How does Macbeth fit the pattern of a tragic hero?', a: 'He begins noble and admired, but has a fatal flaw (hamartia): ambition. His choices lead to his downfall, and in "Tomorrow, and tomorrow, and tomorrow" he sees life as meaningless. The audience feels pity and fear (catharsis).' },
  ],

  // Draw the Story / Exam Mode scenes. keyPoints and vocab are the marking guide (server-only).
  writingScenes: [
    {
      id: 'mac-s1', free: true, art: '🧙‍♀️⚡', title: 'Macbeth meets the witches', where: 'Act 1 Scene 3',
      drawPrompt: 'A blasted heath in thunder. Three bearded witches block the path of two soldiers returning from battle.',
      sketchIdeas: ['Draw the three witches and the two soldiers', 'Add arrows from each prophecy to the person it is for', 'Circle the moment Macbeth starts to think about murder'],
      keyPoints: ['Witches hail Macbeth as Thane of Glamis, Thane of Cawdor and future king', 'Banquo is "lesser than Macbeth, and greater" and will father kings', 'Macbeth is startled; Banquo is wary of the witches', 'Ross brings news that Macbeth is Thane of Cawdor, so the prophecy starts coming true', 'In an aside Macbeth imagines murder ("horrible imaginings")', 'Banquo warns that "instruments of darkness" tell truths to lead us to harm', 'Supernatural influence versus Macbeth\'s own ambition', 'Context: James I and witchcraft (Daemonologie)'],
      vocab: ['prophecy', 'supernatural', 'ambition', 'aside', 'foreshadowing', 'equivocation', 'dramatic irony'],
      examQuestion: 'How does Shakespeare present the witches\' influence on Macbeth in Act 1 Scene 3?',
    },
    {
      id: 'mac-s2', art: '👑🗡️', title: 'Lady Macbeth persuades Macbeth', where: 'Act 1 Scene 7',
      drawPrompt: 'A dark room away from the feast. Macbeth wants to back out; Lady Macbeth confronts him.',
      sketchIdeas: ['Draw Macbeth and Lady Macbeth facing each other', 'Write his reasons not to kill Duncan on one side', 'Add arrows showing how she changes his mind'],
      keyPoints: ['Macbeth\'s soliloquy lists reasons not to kill Duncan: kinsman, subject, host, a virtuous king', 'He admits he has only "vaulting ambition"', 'He tells her "We will proceed no further"', 'She attacks his manhood: "When you durst do it, then you were a man"', 'Her shocking image of dashing out a baby\'s brains', 'She plans to drug the guards and frame them', 'Macbeth is persuaded: "I am settled"', 'Power in their marriage; Jacobean expectations of women'],
      vocab: ['manipulation', 'soliloquy', 'masculinity', 'persuasion', 'regicide', 'hamartia'],
      examQuestion: 'How does Shakespeare present the relationship between Macbeth and Lady Macbeth in Act 1 Scene 7?',
    },
    {
      id: 'mac-s3', art: '🩸🗡️', title: 'The murder of Duncan', where: 'Act 2 Scene 2',
      drawPrompt: 'Night. Macbeth stumbles back with bloody hands and two daggers. Knocking at the gate.',
      sketchIdeas: ['Draw Macbeth\'s bloody hands and the daggers', 'Label the knocking at the gate', 'Draw Lady Macbeth taking the daggers back'],
      keyPoints: ['The murder happens offstage, so the audience imagines it', 'Macbeth brings back the daggers by mistake', 'He could not say "Amen" and heard "Macbeth does murder sleep"', 'His guilt: Neptune\'s ocean could not wash his hand clean', 'Lady Macbeth returns the daggers and smears the guards', 'Her dismissive "A little water clears us of this deed"', 'Knocking and short, broken lines create tension', 'Regicide and the divine right of kings'],
      vocab: ['guilt', 'regicide', 'hyperbole', 'imagery', 'tension', 'offstage'],
      examQuestion: 'How does Shakespeare present guilt in Act 2 Scene 2?',
    },
    {
      id: 'mac-s4', art: '👻🍷', title: 'Banquo\'s ghost at the banquet', where: 'Act 3 Scene 4',
      drawPrompt: 'A grand feast. Macbeth stares in horror at his own chair, where a bloody figure sits that no one else can see.',
      sketchIdeas: ['Draw the banquet table and Macbeth\'s empty-looking seat', 'Show what Macbeth sees compared with what the guests see', 'Draw Lady Macbeth trying to cover for him'],
      keyPoints: ['The murderer reports Banquo dead but Fleance escaped', 'Macbeth feels "cabined, cribbed, confined" by fear', 'Banquo\'s ghost sits in Macbeth\'s place; only he sees it', 'Lady Macbeth makes excuses and questions his manhood ("Are you a man?")', 'The feast, a symbol of order, collapses into disorder', 'Macbeth: "I am in blood / Stepped in so far" that turning back is as hard as going on', 'Guilt, paranoia and the supernatural', 'The banquet shows his kingship falling apart in public'],
      vocab: ['paranoia', 'hallucination', 'disorder', 'supernatural', 'tyranny', 'symbolism'],
      examQuestion: 'How does Shakespeare present Macbeth\'s state of mind in Act 3 Scene 4?',
    },
    {
      id: 'mac-s5', art: '🕯️🩸', title: 'Lady Macbeth sleepwalks', where: 'Act 5 Scene 1',
      drawPrompt: 'Night in Dunsinane castle. Lady Macbeth walks with a candle, rubbing her hands, watched by a doctor and a gentlewoman.',
      sketchIdeas: ['Draw Lady Macbeth with her candle', 'Label the two watchers and what they say', 'Add speech bubbles for the murders she relives'],
      keyPoints: ['A Doctor and Gentlewoman secretly watch her', 'She must have light by her continually (contrast with calling on "thick night" in Act 1)', 'She rubs her hands as if washing: "Out, damned spot!"', 'She relives Duncan\'s murder (so much blood) and Lady Macduff\'s ("The Thane of Fife had a wife")', 'She speaks in fragmented prose instead of verse', 'The Doctor says she needs a priest more than a physician', 'Guilt now controls her, a reversal of Act 2 Scene 2', 'Her loss of control restores the order she defied'],
      vocab: ['guilt', 'prose', 'reversal', 'motif', 'subconscious', 'downfall'],
      examQuestion: 'How does Shakespeare present Lady Macbeth\'s guilt in Act 5 Scene 1?',
    },
  ],

  examQuestions: [
    'Starting with Act 1 Scene 7, explore how Shakespeare presents ambition in Macbeth.',
    'Starting with Act 1 Scene 5, explore how Shakespeare presents Lady Macbeth as a powerful woman.',
    'Starting with Act 1 Scene 3, explore how Shakespeare presents the supernatural.',
    'Starting with Act 5 Scene 5, explore how Shakespeare presents Macbeth as a tragic hero.',
  ],
};
