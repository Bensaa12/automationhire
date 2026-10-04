// GCSE English Literature content: An Inspector Calls. Server-only (never shipped to the browser in full).
// Shape is shared by every text: see api/_literature/registry.js. Quotations are short and checked
// against the play; stage directions are marked as such.

module.exports = {
  id: 'an-inspector-calls',
  title: 'An Inspector Calls',
  author: 'J. B. Priestley',
  form: 'Play (1945)',
  examBoards: ['AQA', 'Edexcel', 'OCR', 'Eduqas'],
  tagline: 'One family, one dinner, one death. Who is responsible?',
  accent: '#f5b83f',

  characters: [
    { name: 'Inspector Goole', summary: 'A mysterious inspector who exposes each family member\'s part in Eva Smith\'s death.' },
    { name: 'Arthur Birling', summary: 'Wealthy, self-important factory owner; a capitalist who refuses to change.' },
    { name: 'Sybil Birling', summary: 'Cold, snobbish wife; refused Eva help through her charity.' },
    { name: 'Sheila Birling', summary: 'The daughter; quickly accepts responsibility and changes.' },
    { name: 'Eric Birling', summary: 'The son; drinks, got Eva pregnant and stole money, then accepts blame.' },
    { name: 'Gerald Croft', summary: 'Sheila\'s upper-class fiancé, who had an affair with Eva (as Daisy Renton).' },
    { name: 'Eva Smith', summary: 'The working-class young woman who never appears; a symbol of the exploited poor.' },
  ],
  themes: [
    { name: 'Responsibility', summary: '"We are responsible for each other."' },
    { name: 'Class', summary: 'The privileged Birlings exploit or ignore working-class Eva.' },
    { name: 'Gender', summary: 'Women\'s vulnerability and men\'s power in 1912.' },
    { name: 'Capitalism vs socialism', summary: 'Birling\'s self-interest against the Inspector\'s collective responsibility.' },
    { name: 'Generational conflict', summary: 'The young learn; the old refuse to change.' },
  ],
  events: [
    { where: 'Act One', summary: 'The engagement dinner; Birling\'s speeches; the Inspector arrives; Birling and Sheila are questioned.' },
    { where: 'Act Two', summary: 'Gerald\'s affair is revealed; Mrs Birling admits refusing Eva charity and blames the father.' },
    { where: 'Act Three', summary: 'Eric confesses; the Inspector\'s final speech; the hoax theory; the final phone call.' },
  ],
  quotations: [
    { text: 'unsinkable, absolutely unsinkable', speaker: 'Mr Birling', where: 'Act One' },
    { text: 'community and all that nonsense', speaker: 'Mr Birling', where: 'Act One' },
    { text: 'But these girls aren\'t cheap labour—they\'re people.', speaker: 'Sheila', where: 'Act One' },
    { text: 'Girls of that class—', speaker: 'Mrs Birling', where: 'Act Two' },
    { text: 'We are members of one body. We are responsible for each other.', speaker: 'The Inspector', where: 'Act Three' },
    { text: 'fire and blood and anguish', speaker: 'The Inspector', where: 'Act Three' },
    { text: 'the famous younger generation who know it all', speaker: 'Mr Birling', where: 'Act Three' },
  ],
  context: [
    'Written in 1945; set in spring 1912 in the fictional industrial town of Brumley.',
    'First performed in 1945 in Moscow, then in London in 1946.',
    'Priestley was a socialist who co-founded the Common Wealth Party (1942).',
    'Labour won a landslide in 1945 and built the welfare state.',
    'In 1912 working women had few rights, low wages and no vote.',
  ],
  techniques: ['Dramatic irony', 'Stage directions and lighting', 'Entrances, exits and cliffhanger act endings', 'The Inspector as a dramatic device', 'Well-made play / detective structure', 'Cyclical structure', 'Symbolism (Eva Smith, the name "Goole")'],

  flashcards: [
    // Characters
    { id: 'aic-c1', category: 'characters', free: true, q: 'How does Priestley present Mr Birling at the start of Act One?', a: 'As pompous and self-satisfied. He calls himself "a hard-headed, practical man of business", talks about profit and his hoped-for knighthood, and mocks "community and all that nonsense". Dramatic irony (the "unsinkable" Titanic) makes him look foolish.' },
    { id: 'aic-c2', category: 'characters', q: 'What is the Inspector\'s role in the play?', a: 'He arrives just as Birling preaches selfishness, controls the pace, questions each character in turn and shows how they all contributed to Eva\'s death. He is Priestley\'s mouthpiece for socialist ideas, and his name ("Goole", like ghoul) hints he may be supernatural.' },
    { id: 'aic-c3', category: 'characters', q: 'How does Sheila change during the play?', a: 'At first she is "pleased with life" and a little spoilt. She quickly feels guilt ("I\'ll never, never do it again to anybody"), becomes perceptive, gives Gerald back the ring and challenges her parents. She represents hope in the younger generation.' },
    { id: 'aic-c4', category: 'characters', q: 'How is Mrs Birling presented?', a: 'The stage directions call her "a rather cold woman and her husband\'s social superior". She is prejudiced ("Girls of that class—"), used her charity committee to refuse Eva help, and blames the father, unaware it is her own son. She never accepts responsibility.' },
    { id: 'aic-c5', category: 'characters', q: 'How does Eric change during the play?', a: 'He starts "half shy, half assertive" and drinks too much. He is revealed to have got Eva pregnant and stolen money from his father\'s office. Ashamed, he turns on his parents and accepts that "we all helped to kill her".' },
    { id: 'aic-c6', category: 'characters', q: 'How is Gerald Croft presented?', a: 'An upper-class young man engaged to Sheila. He met Eva (as Daisy Renton) at the Palace bar, rescued her from Alderman Meggarty and made her his mistress, then ended it. He shows some feeling, but at the end he tries to prove the Inspector a hoax, siding with the older generation.' },
    // Themes
    { id: 'aic-t1', category: 'themes', free: true, q: 'What is Priestley\'s central message about responsibility?', a: 'That we are all responsible for each other: "We are members of one body. We are responsible for each other." Every Birling contributed to Eva\'s death. Those who accept it (Sheila, Eric) change; those who refuse (Mr and Mrs Birling, Gerald) learn nothing.' },
    { id: 'aic-t2', category: 'themes', q: 'How does Priestley present class?', a: 'The wealthy Birlings exploit or dismiss working-class Eva: Birling sacks her, Sheila has her fired, Mrs Birling refuses her help. Birling is obsessed with status. Priestley shows the class system as unjust and harmful.' },
    { id: 'aic-t3', category: 'themes', q: 'How does Priestley explore gender?', a: 'Eva is vulnerable to powerful men (Birling, Gerald, Eric, Alderman Meggarty). Sheila begins protected and treated like a child but becomes independent. Even Mrs Birling\'s power depends on class. Priestley exposes how women in 1912 depended on men.' },
    { id: 'aic-t4', category: 'themes', q: 'How does the play present capitalism against socialism?', a: 'Birling stands for capitalism: profit, low wages and every man for himself. The Inspector stands for socialism: collective responsibility and care for workers. Priestley clearly sides with the Inspector.' },
    { id: 'aic-t5', category: 'themes', q: 'How does Priestley present conflict between generations?', a: 'The older Birlings refuse to change, while Sheila and Eric learn and challenge them. Birling sneers at "the famous younger generation who know it all". For a 1945 audience the hope lies with the young.' },
    { id: 'aic-t6', category: 'themes', q: 'Why is Eva Smith important even though she never appears?', a: 'We only see her through how others treated her, so she becomes a symbol of all exploited working people: "millions and millions and millions of Eva Smiths and John Smiths". Her common surname makes her an everywoman.' },
    // Key events
    { id: 'aic-e1', category: 'events', free: true, q: 'How does Act One begin, and why is the Inspector\'s arrival so well timed?', a: 'The family celebrates Sheila\'s engagement to Gerald. Birling gives speeches about the "unsinkable" Titanic, how war won\'t happen and how a man must look after himself. The doorbell rings at exactly that moment: the Inspector arrives to challenge him.' },
    { id: 'aic-e2', category: 'events', q: 'What was Mr Birling\'s part in Eva Smith\'s story?', a: 'In 1910 she worked in his factory and was a ringleader in a strike for higher wages (twenty-five shillings a week instead of about twenty-two and six). He sacked her to keep labour costs down.' },
    { id: 'aic-e3', category: 'events', q: 'How did Sheila contribute to Eva\'s downfall?', a: 'At Milwards department store, in a bad temper, she thought Eva, a shop assistant, was laughing at her. Jealous because Eva was pretty, Sheila complained and threatened to close her account, so Eva was sacked.' },
    { id: 'aic-e4', category: 'events', q: 'What is revealed in Act Two?', a: 'Gerald admits his affair with Eva (as Daisy Renton) the previous spring; Sheila hands back the ring. Mrs Birling admits her charity committee refused the pregnant Eva help and insists the father is to blame, until she realises it is Eric.' },
    { id: 'aic-e5', category: 'events', q: 'What does Eric confess in Act Three?', a: 'He met Eva at the Palace bar, slept with her, and she became pregnant. He gave her money he had stolen from his father\'s office (about fifty pounds). She refused to take any more once she realised it was stolen.' },
    { id: 'aic-e6', category: 'events', q: 'What happens after the Inspector leaves?', a: 'Gerald learns there is no Inspector Goole on the police force, and Birling phones the Infirmary: no recent suicide. Birling, Mrs Birling and Gerald relax; Sheila and Eric do not. Then the phone rings: a girl has died, and a police inspector is on his way.' },
    // Quotes
    { id: 'aic-q1', category: 'quotes', free: true, q: '"We are members of one body. We are responsible for each other.": who says it and why is it central?', a: 'The Inspector in his final speech (Act Three). The image echoes the Christian "body of Christ": society is one body, so harming one part harms all. It sums up Priestley\'s socialist message.' },
    { id: 'aic-q2', category: 'quotes', q: '"unsinkable, absolutely unsinkable": what technique is used, and to what effect?', a: 'Dramatic irony. Birling says it about the Titanic in Act One; the audience knows it sank in April 1912. His confident judgement is shown to be wrong, so we distrust his other views too.' },
    { id: 'aic-q3', category: 'quotes', q: '"But these girls aren\'t cheap labour—they\'re people.": who says it and what does it reveal?', a: 'Sheila in Act One, reacting to her father\'s story. It shows her empathy and an early challenge to Birling\'s capitalist view of workers as costs rather than human beings.' },
    { id: 'aic-q4', category: 'quotes', q: '"Girls of that class—": what does this reveal about Mrs Birling?', a: 'Her class prejudice (Act Two). She sees working-class women as inferior and lumps them together. The dash shows her contempt and that she feels no need to finish the thought.' },
    { id: 'aic-q5', category: 'quotes', q: '"fire and blood and anguish": what is the Inspector warning about?', a: 'In his final speech he warns that if people will not learn responsibility, they will be taught it in "fire and blood and anguish". The 1945 audience would hear the two World Wars in these words.' },
    { id: 'aic-q6', category: 'quotes', q: '"the famous younger generation who know it all": who says it and what does it show?', a: 'Mr Birling in Act Three, sneering at Sheila and Eric. The sarcasm shows the gap between the generations and Birling\'s refusal to learn anything from the evening.' },
    // Context
    { id: 'aic-x1', category: 'context', free: true, q: 'Why did Priestley set the play in 1912 but write it in 1945?', a: 'In 1912, before the Titanic sank and before the First World War, the class system was rigid. The 1945 audience had lived through two world wars, so dramatic irony exposes Birling\'s confidence. Priestley urged them to build a fairer society after the war.' },
    { id: 'aic-x2', category: 'context', q: 'What were Priestley\'s political views?', a: 'He was a socialist. He co-founded the Common Wealth Party in 1942 and gave popular wartime radio talks about building a better Britain. The play promotes collective responsibility.' },
    { id: 'aic-x3', category: 'context', q: 'What was life like for working-class women like Eva in 1912?', a: 'Low wages, few rights, no vote and little support. They depended on employers and charity, unmarried pregnancy brought shame, and they were easily exploited.' },
    { id: 'aic-x4', category: 'context', q: 'What does the setting of Brumley tell us?', a: 'It is a fictional industrial town in the Midlands, where factory owners like Birling held great power over workers and the wealthy controlled local institutions, such as Mrs Birling\'s Brumley Women\'s Charity Organisation.' },
    { id: 'aic-x5', category: 'context', q: 'Why was 1945 a significant moment for the play?', a: 'Labour won a landslide election in 1945 and went on to build the welfare state and the NHS: society taking collective responsibility. The play was first performed in this mood of change (Moscow 1945, London 1946).' },
    { id: 'aic-x6', category: 'context', q: 'Why was the Titanic reference so powerful?', a: 'The play is set in spring 1912; the Titanic sank in April 1912. Audiences knew this, so Birling\'s praise of the "unsinkable" ship marks him as arrogant and wrong. The disaster is also often linked to class division.' },
    // Language & techniques
    { id: 'aic-k1', category: 'techniques', q: 'How does Priestley use dramatic irony?', a: 'Birling\'s predictions (the "unsinkable" Titanic, no war) are wrong, and the audience knows it. Mrs Birling demands the father be punished without realising it is Eric. Both make the older characters look foolish and untrustworthy.' },
    { id: 'aic-k2', category: 'techniques', q: 'Why does the lighting change when the Inspector arrives?', a: 'The stage directions say it should be "pink and intimate" until the Inspector arrives, then "brighter and harder". The rosy, comfortable view of the family is replaced by a harsh light of interrogation and truth.' },
    { id: 'aic-k3', category: 'techniques', q: 'How do entrances, exits and act endings build tension?', a: 'The doorbell interrupts Birling\'s speech. Acts end on cliffhangers: Act One on the Inspector\'s "Well?", Act Two as Eric walks in. The Inspector controls who is questioned and when.' },
    { id: 'aic-k4', category: 'techniques', q: 'How is the Inspector used as a dramatic device?', a: 'He is Priestley\'s mouthpiece and controls the structure, questioning one person at a time. He seems to know everything in advance, and his name (Goole/ghoul) and the twist ending suggest he may not be an ordinary policeman.' },
    { id: 'aic-k5', category: 'techniques', q: 'How is the play structured like a detective story or "well-made play"?', a: 'One setting (the dining room), continuous time, three acts, gradual revelations and a twist ending. The thriller structure keeps the audience gripped while delivering the moral message.' },
    { id: 'aic-k6', category: 'techniques', q: 'What is the effect of the cyclical ending?', a: 'The final phone call announces that a real inspector is coming, so the evening will repeat. Those who failed to learn will be tested again, suggesting the lesson must be learned by society as a whole.' },
  ],

  writingScenes: [
    {
      id: 'aic-s1', free: true, art: '🔔🕵️', title: 'The Inspector arrives', where: 'Act One',
      drawPrompt: 'A comfortable dining room after a celebration dinner. A man in evening dress mid-speech; the doorbell rings; a plain-clothes inspector stands in the doorway.',
      sketchIdeas: ['Draw the family around the table with their port', 'Draw the Inspector in the doorway', 'Show the lighting changing from soft to hard'],
      keyPoints: ['The family celebrates Sheila and Gerald\'s engagement', 'Birling says a man must "mind his own business and look after himself and his own"', 'The doorbell interrupts him: dramatic timing', 'The Inspector gives "an impression of massiveness, solidity and purposefulness"', 'Lighting changes from "pink and intimate" to "brighter and harder"', 'He reports that Eva Smith has died after swallowing disinfectant', 'Birling is dismissive and defensive', 'Capitalism against socialism; the 1945 audience'],
      vocab: ['dramatic irony', 'stage directions', 'capitalism', 'socialism', 'mouthpiece', 'tension'],
      examQuestion: 'How does Priestley use the Inspector\'s arrival to challenge Mr Birling\'s views?',
    },
    {
      id: 'aic-s2', art: '🖼️😢', title: 'Sheila sees the photograph', where: 'Act One',
      drawPrompt: 'The Inspector holds up a photograph for one young woman only. She looks at it, gives a half-stifled sob and runs from the room.',
      sketchIdeas: ['Draw Sheila\'s reaction to the photo', 'Draw a flashback box of the Milwards incident', 'Add arrows from cause to effect'],
      keyPoints: ['The Inspector shows the photo only to Sheila', 'She runs out, upset', 'At Milwards she had Eva sacked out of jealousy and temper', 'The power of a rich customer over a shop worker', 'She feels guilt at once: "I\'ll never, never do it again"', 'First sign that the young can change', 'Class and gender'],
      vocab: ['guilt', 'jealousy', 'power', 'class', 'responsibility'],
      examQuestion: 'How does Priestley present Sheila\'s response to her part in Eva\'s death?',
    },
    {
      id: 'aic-s3', art: '💍🍸', title: 'Gerald\'s confession', where: 'Act Two',
      drawPrompt: 'Gerald, uncomfortable, explains himself while Sheila listens coldly; an engagement ring lies on her open palm.',
      sketchIdeas: ['Draw Gerald and Sheila', 'Draw a flashback of the Palace bar', 'Label the ring and what it means'],
      keyPoints: ['Eva had changed her name to Daisy Renton', 'Gerald met her at the Palace bar and rescued her from Alderman Meggarty', 'He let her live in rooms belonging to a friend and kept her as his mistress', 'He ended the affair', 'Sheila hands back the ring', 'Gerald leaves to walk; men\'s power over women; class'],
      vocab: ['affair', 'exploitation', 'gender', 'class', 'honesty'],
      examQuestion: 'How does Priestley present Gerald\'s relationship with Eva (Daisy Renton)?',
    },
    {
      id: 'aic-s4', art: '⚖️🏛️', title: 'Mrs Birling blames the father', where: 'Act Two',
      drawPrompt: 'A stiff, proud woman insists someone must be made an example of, while her daughter desperately tries to stop her.',
      sketchIdeas: ['Draw Mrs Birling and Sheila', 'Add a speech bubble with who she blames', 'Draw the door where Eric is about to enter'],
      keyPoints: ['Eva came to the Brumley Women\'s Charity Organisation for help', 'She called herself "Mrs Birling", which offended Mrs Birling', 'Mrs Birling persuaded the committee to refuse her', '"Go and look for the father of the child. It\'s his responsibility."', 'Sheila tries to stop her; the audience realises before she does', 'The act ends as Eric enters', 'Dramatic irony; upper-class hypocrisy'],
      vocab: ['hypocrisy', 'dramatic irony', 'prejudice', 'cliffhanger', 'class'],
      examQuestion: 'How does Priestley use Mrs Birling to criticise the attitudes of the upper classes?',
    },
    {
      id: 'aic-s5', art: '🕵️📞', title: 'The Inspector\'s final speech', where: 'Act Three',
      drawPrompt: 'The Inspector stands at the centre of the room delivering his last words to a stunned family, then turns and leaves.',
      sketchIdeas: ['Draw the Inspector at the centre and the family around him', 'Show who looks ashamed and who looks relieved', 'Add the phone that will ring later'],
      keyPoints: ['"One Eva Smith has gone" but there are millions like her', '"We are members of one body. We are responsible for each other."', 'Warning of "fire and blood and anguish"', 'He leaves abruptly', 'Sheila and Eric accept responsibility; the parents do not', '1945 context: two world wars, the welfare state', 'Priestley\'s socialist message'],
      vocab: ['responsibility', 'socialism', 'warning', 'climax', 'mouthpiece', 'collective'],
      examQuestion: 'How does Priestley present responsibility in the Inspector\'s final speech?',
    },
  ],

  examQuestions: [
    'How does Priestley present the Inspector as a powerful figure in An Inspector Calls?',
    'How does Priestley explore responsibility in An Inspector Calls?',
    'How does Priestley use Sheila and Eric to present ideas about the younger generation?',
    'How does Priestley present ideas about class in An Inspector Calls?',
  ],
};
