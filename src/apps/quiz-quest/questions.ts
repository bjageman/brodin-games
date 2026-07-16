export type QuestionCategory =
  | 'Science' | 'History' | 'Geography' | 'Mythology' | 'Animals' | 'Pop Culture' | 'Food' | 'Space';

export interface Question {
  id: string;
  category: QuestionCategory;
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

// Starter bank — 5 per category. Room pacing (which questions show up when,
// any per-room difficulty) is a follow-up once #79 settles the room loop.
export const QUESTIONS: Question[] = [
  // Science
  {
    id: 'sci-octopus',
    category: 'Science',
    question: 'Which of these is NOT an actual scientific fact about octopuses?',
    choices: ['They have three hearts', 'They can taste with their arms', 'They can change color', 'They can regenerate a lost eye'],
    correctIndex: 3,
  },
  {
    id: 'sci-hardest',
    category: 'Science',
    question: 'What is the hardest naturally occurring substance on Earth?',
    choices: ['Diamond', 'Quartz', 'Titanium', 'Graphite'],
    correctIndex: 0,
  },
  {
    id: 'sci-bones',
    category: 'Science',
    question: 'How many bones are in the adult human body?',
    choices: ['186', '206', '226', '246'],
    correctIndex: 1,
  },
  {
    id: 'sci-photosynthesis',
    category: 'Science',
    question: 'What gas do plants absorb from the atmosphere for photosynthesis?',
    choices: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    correctIndex: 2,
  },
  {
    id: 'sci-lightspeed',
    category: 'Science',
    question: 'The speed of light in a vacuum is approximately how fast?',
    choices: ['300,000 km/s', '150,000 km/s', '3,000 km/s', '30,000 km/s'],
    correctIndex: 0,
  },

  // History
  {
    id: 'hist-ww2-end',
    category: 'History',
    question: 'In what year did World War II end?',
    choices: ['1943', '1944', '1945', '1946'],
    correctIndex: 2,
  },
  {
    id: 'hist-first-president',
    category: 'History',
    question: 'Who was the first President of the United States?',
    choices: ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'],
    correctIndex: 2,
  },
  {
    id: 'hist-great-wall',
    category: 'History',
    question: 'The Great Wall of China was primarily built to defend against invasions from which direction?',
    choices: ['South', 'East', 'West', 'North'],
    correctIndex: 3,
  },
  {
    id: 'hist-pyramids',
    category: 'History',
    question: 'Which ancient civilization built the pyramids of Giza?',
    choices: ['Romans', 'Egyptians', 'Greeks', 'Mesopotamians'],
    correctIndex: 1,
  },
  {
    id: 'hist-titanic',
    category: 'History',
    question: 'The Titanic sank in which century?',
    choices: ['18th', '19th', '20th', '21st'],
    correctIndex: 2,
  },

  // Geography
  {
    id: 'geo-longest-river',
    category: 'Geography',
    question: 'What is traditionally cited as the longest river in the world?',
    choices: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'],
    correctIndex: 1,
  },
  {
    id: 'geo-time-zones',
    category: 'Geography',
    question: 'Which country has the most time zones, thanks to its overseas territories?',
    choices: ['United States', 'Russia', 'China', 'France'],
    correctIndex: 3,
  },
  {
    id: 'geo-smallest-country',
    category: 'Geography',
    question: 'What is the smallest country in the world by area?',
    choices: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'],
    correctIndex: 2,
  },
  {
    id: 'geo-everest',
    category: 'Geography',
    question: 'Mount Everest sits on the border of Nepal and which other territory?',
    choices: ['India', 'Tibet (China)', 'Bhutan', 'Pakistan'],
    correctIndex: 1,
  },
  {
    id: 'geo-largest-desert',
    category: 'Geography',
    question: 'What is the largest desert in the world by area?',
    choices: ['Sahara', 'Gobi', 'Antarctic Desert', 'Arabian Desert'],
    correctIndex: 2,
  },

  // Mythology
  {
    id: 'myth-zeus',
    category: 'Mythology',
    question: 'In Greek mythology, who is the king of the gods?',
    choices: ['Poseidon', 'Hades', 'Zeus', 'Apollo'],
    correctIndex: 2,
  },
  {
    id: 'myth-sphinx',
    category: 'Mythology',
    question: 'What creature has the body of a lion and the head of a human in Egyptian mythology?',
    choices: ['Griffin', 'Sphinx', 'Chimera', 'Minotaur'],
    correctIndex: 1,
  },
  {
    id: 'myth-mjolnir',
    category: 'Mythology',
    question: "In Norse mythology, what is the name of Thor's hammer?",
    choices: ['Gungnir', 'Mjolnir', 'Draupnir', 'Laevateinn'],
    correctIndex: 1,
  },
  {
    id: 'myth-athena',
    category: 'Mythology',
    question: 'Who is the Greek goddess of wisdom?',
    choices: ['Aphrodite', 'Athena', 'Hera', 'Artemis'],
    correctIndex: 1,
  },
  {
    id: 'myth-yggdrasil',
    category: 'Mythology',
    question: 'In Norse mythology, what is the name of the world tree?',
    choices: ['Yggdrasil', 'Valhalla', 'Bifrost', 'Asgard'],
    correctIndex: 0,
  },

  // Animals
  {
    id: 'ani-fastest',
    category: 'Animals',
    question: 'What is the fastest land animal?',
    choices: ['Lion', 'Cheetah', 'Pronghorn', 'Greyhound'],
    correctIndex: 1,
  },
  {
    id: 'ani-egg-laying-mammal',
    category: 'Animals',
    question: 'Which of these mammals lays eggs instead of giving live birth?',
    choices: ['Platypus', 'Koala', 'Kangaroo', 'Wombat'],
    correctIndex: 0,
  },
  {
    id: 'ani-lion-group',
    category: 'Animals',
    question: 'What is a group of lions called?',
    choices: ['Pack', 'Herd', 'Pride', 'Flock'],
    correctIndex: 2,
  },
  {
    id: 'ani-octopus-hearts',
    category: 'Animals',
    question: 'How many hearts does an octopus have?',
    choices: ['1', '2', '3', '4'],
    correctIndex: 2,
  },
  {
    id: 'ani-penguin',
    category: 'Animals',
    question: "Which bird can't fly but is an excellent swimmer?",
    choices: ['Ostrich', 'Penguin', 'Emu', 'Kiwi'],
    correctIndex: 1,
  },

  // Pop Culture
  {
    id: 'pop-force',
    category: 'Pop Culture',
    question: 'Which movie franchise features the line "May the Force be with you"?',
    choices: ['Star Trek', 'Star Wars', 'Guardians of the Galaxy', 'Dune'],
    correctIndex: 1,
  },
  {
    id: 'pop-jaws',
    category: 'Pop Culture',
    question: 'Who directed the movie "Jaws"?',
    choices: ['George Lucas', 'Steven Spielberg', 'James Cameron', 'Ridley Scott'],
    correctIndex: 1,
  },
  {
    id: 'pop-highest-grossing',
    category: 'Pop Culture',
    question: 'Which of these films has the highest unadjusted worldwide box office total?',
    choices: ['Titanic', 'Avatar', "Avengers: Endgame", 'Star Wars: The Force Awakens'],
    correctIndex: 1,
  },
  {
    id: 'pop-ruby-slippers',
    category: 'Pop Culture',
    question: "In The Wizard of Oz, what color are Dorothy's iconic shoes?",
    choices: ['Silver', 'Red', 'Gold', 'Blue'],
    correctIndex: 1,
  },
  {
    id: 'pop-hogwarts',
    category: 'Pop Culture',
    question: 'Which fictional wizarding school does Harry Potter attend?',
    choices: ['Beauxbatons', 'Durmstrang', 'Hogwarts', 'Ilvermorny'],
    correctIndex: 2,
  },

  // Food
  {
    id: 'food-guac',
    category: 'Food',
    question: 'What is the main ingredient in traditional guacamole?',
    choices: ['Tomato', 'Avocado', 'Lime', 'Onion'],
    correctIndex: 1,
  },
  {
    id: 'food-pizza',
    category: 'Food',
    question: 'Which country is credited with inventing pizza in its modern form?',
    choices: ['France', 'Greece', 'Italy', 'Spain'],
    correctIndex: 2,
  },
  {
    id: 'food-croissant',
    category: 'Food',
    question: 'What kind of dough is used to make a traditional croissant?',
    choices: ['Shortcrust', 'Choux pastry', 'Laminated dough', 'Filo pastry'],
    correctIndex: 2,
  },
  {
    id: 'food-saffron',
    category: 'Food',
    question: 'Which spice, derived from the crocus flower, is the most expensive by weight?',
    choices: ['Cinnamon', 'Saffron', 'Vanilla', 'Cardamom'],
    correctIndex: 1,
  },
  {
    id: 'food-sushi-rice',
    category: 'Food',
    question: 'What is sushi rice traditionally seasoned with?',
    choices: ['Soy sauce', 'Rice vinegar', 'Mirin', 'Wasabi'],
    correctIndex: 1,
  },

  // Space
  {
    id: 'space-closest-planet',
    category: 'Space',
    question: 'What is the closest planet to the Sun?',
    choices: ['Venus', 'Earth', 'Mercury', 'Mars'],
    correctIndex: 2,
  },
  {
    id: 'space-largest-planet',
    category: 'Space',
    question: 'What is the largest planet in our solar system?',
    choices: ['Saturn', 'Jupiter', 'Neptune', 'Uranus'],
    correctIndex: 1,
  },
  {
    id: 'space-galaxy',
    category: 'Space',
    question: 'Which galaxy is Earth located in?',
    choices: ['Andromeda', 'Triangulum', 'Milky Way', 'Whirlpool'],
    correctIndex: 2,
  },
  {
    id: 'space-mars-moons',
    category: 'Space',
    question: 'How many moons does Mars have?',
    choices: ['0', '1', '2', '4'],
    correctIndex: 2,
  },
  {
    id: 'space-moon-walk',
    category: 'Space',
    question: 'Who was the first person to walk on the Moon?',
    choices: ['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong', 'John Glenn'],
    correctIndex: 2,
  },
];
