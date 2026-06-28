export interface Question {
  id: string;
  text: string;
  jackieSays: string;
  type: 'dropdown' | 'number' | 'card' | 'multi-select' | 'dynamic-size';
  options?: string[];
  optional?: boolean;
}

// Generates height options from 4'10" to 6'2"
export const heightOptions = Array.from({ length: 17 }, (_, i) => {
  const inchesTotal = 58 + i;
  const feet = Math.floor(inchesTotal / 12);
  const inches = inchesTotal % 12;
  return `${feet}'${inches}"`;
});

// Generates waist options from 24" to 52"
export const waistOptions = Array.from({ length: 29 }, (_, i) => `${24 + i}"`);

// Generates hip options from 32" to 60"
export const hipOptions = Array.from({ length: 29 }, (_, i) => `${32 + i}"`);

// Generates brand size options from 23 to 34
export const brandSizeOptions = Array.from({ length: 12 }, (_, i) => `${23 + i}`);

export const questions: Question[] = [
  {
    id: 'height',
    text: 'What is your height?',
    jackieSays: "What's your height? For example, five foot six.",
    type: 'dropdown',
    options: heightOptions,
  },
  {
    id: 'weight',
    text: 'What is your weight?',
    jackieSays: "What's your weight? Feel free to say skip if you'd prefer.",
    type: 'number',
    optional: true,
  },
  {
    id: 'waist',
    text: 'Waist measurement in inches (narrowest point)',
    jackieSays: "What's your waist measurement in inches? For example, twenty eight inches.",
    type: 'dropdown',
    options: waistOptions,
  },
  {
    id: 'hip',
    text: 'Hip measurement in inches (fullest point)',
    jackieSays: "And what is your hip measurement in inches? For example, thirty eight inches.",
    type: 'dropdown',
    options: hipOptions,
  },
  {
    id: 'waistFit',
    text: 'How do you like denim to fit at the waist?',
    jackieSays: "How do you like your denim bottomwear to fit at the waist? Snug, slightly relaxed, or relaxed?",
    type: 'card',
    options: ['Snug', 'Slightly Relaxed', 'Relaxed'],
  },
  {
    id: 'rise',
    text: 'Where should the waistband sit?',
    jackieSays: "Where do you prefer the waistband to sit? High rise, mid rise, or low rise?",
    type: 'card',
    options: ['High Rise', 'Mid Rise', 'Low Rise'],
  },
  {
    id: 'thighFit',
    text: 'How should denim fit through the thighs?',
    jackieSays: "How should they fit through your thighs? Fitted, relaxed, or loose?",
    type: 'card',
    options: ['Fitted', 'Relaxed', 'Loose'],
  },
  {
    id: 'brands',
    text: 'Which denim brands have you bought before?',
    jackieSays: "Which denim brands have you bought before? Name as many as you like from: Levis, Wrangler, Gap, Zara, H and M, Mango, ASOS, Topshop, AG Jeans, Frame, Good American, Seven For All Mankind, Citizens of Humanity, Everlane, or Uniqlo.",
    type: 'multi-select',
    options: [
      "Levi's",
      'Wrangler',
      'Gap',
      'Zara',
      'H&M',
      'Mango',
      'ASOS',
      'Topshop',
      'AG Jeans',
      'Frame',
      'Good American',
      '7 For All Mankind',
      'Citizens of Humanity',
      'Everlane',
      'Uniqlo',
    ],
  },
  {
    id: 'brandSizes',
    text: 'What size did you buy in those brands?',
    jackieSays: "What size did you wear in [Brand]?",
    type: 'dynamic-size',
    options: brandSizeOptions,
  },
  {
    id: 'frustrations',
    text: 'Biggest fit frustration when buying denim?',
    jackieSays: "What is your biggest fit frustration when buying denim bottomwear? Select any from: Waist gap, Hip tightness, Wrong length, Thigh fit, Rise, or Other.",
    type: 'multi-select',
    options: ['Waist gap', 'Hip tightness', 'Wrong length', 'Thigh fit', 'Rise', 'Other'],
  },
];
