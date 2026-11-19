import type { CourseDocument } from './contracts';
/** Original fictional material; teachers must validate it before real classroom use. */
export const demoDocument: CourseDocument = {
  title: 'First Conversations', level: 'A1', audience: 'university',
  units: [{ id: 'first-meetings', title: 'Meeting people on campus', lessons: [
    { id: 'intro', title: 'Introducing yourself', objective: 'Introduce yourself with your name, hometown and field of study in three short sentences.',
      blocks: [{ id: 'intro-dialogue', type: 'text', text: 'Lina: Hi! I’m Lina. What’s your name?\nSam: Hello, Lina. I’m Sam. Are you new here?\nLina: Yes, I am. I’m from Yopal, and I study design.\nSam: Nice to meet you! I study engineering.\nLina: Nice to meet you too. Let’s find our classroom.' }],
      activities: [{ id: 'origin', type: 'choice', prompt: 'Where is Lina from?', required: true,
        options: [{ id: 'yopal', text: 'Yopal' }, { id: 'tunja', text: 'Tunja' }, { id: 'cali', text: 'Cali' }], correctOptionId: 'yopal',
        feedback: { correct: 'Lina says, “I’m from Yopal.” You identified her hometown.', incorrect: 'Listen to Lina’s introduction: “I’m from Yopal.” Use “I’m from” to say your hometown.' } }]
    },
    { id: 'classmate', title: 'Introducing a classmate', objective: 'Introduce a classmate using their name and field of study with “This is” and “studies”.',
      blocks: [{ id: 'classmate-dialogue', type: 'text', text: 'Lina: Sam, this is my classmate, Maya.\nSam: Hi, Maya! What do you study?\nMaya: I study biology. I love learning about plants.\nLina: Maya and I meet at the library on Tuesdays.\nSam: Great! Our study group meets there too.\nMaya: See you on Tuesday, then!' }],
      activities: [{ id: 'studies', type: 'choice', prompt: 'Which sentence introduces Maya correctly?', required: true,
        options: [{ id: 'biology', text: 'This is Maya. She studies biology.' }, { id: 'design', text: 'This is Maya. She studies design.' }, { id: 'engineering', text: 'This is Maya. She studies engineering.' }], correctOptionId: 'biology',
        feedback: { correct: 'Maya studies biology. “This is Maya” is a useful way to introduce a classmate.', incorrect: 'Maya says, “I study biology.” To introduce her, say: “This is Maya. She studies biology.”' } }]
    }
  ] }]
};
