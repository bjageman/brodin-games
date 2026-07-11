import type { Topic } from './types';

export const ROLE_REVEAL_DURATION_MS = 8000; // 8 seconds to show role & topic
export const TURN_DURATION_MS = 25000;        // 25 seconds per drawing turn
export const VOTE_DURATION_MS = 30000;        // 30 seconds to vote

// A client that missed the host's one-shot initial state broadcast (its message
// handler wasn't registered yet when the broadcast arrived) pulls the current
// state by asking the host, retrying until it lands or we give up.
export const STATE_REQUEST_RETRY_INTERVAL_MS = 1000;
export const STATE_REQUEST_MAX_ATTEMPTS = 10;

export const DRAWING_COLORS = [
  '#E11D48', // Rose
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#0D9488', // Teal
  '#EA580C', // Orange
  '#B45309', // Brown
  '#C026D3', // Fuchsia
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#16A34A', // Green
];

export const TOPICS: Topic[] = [
  // Animals
  { name: 'Frog', category: 'Animal' },
  { name: 'Elephant', category: 'Animal' },
  { name: 'Dolphin', category: 'Animal' },
  { name: 'Flamingo', category: 'Animal' },
  { name: 'Lion', category: 'Animal' },
  { name: 'Cat', category: 'Animal' },
  { name: 'Dog', category: 'Animal' },
  { name: 'Giraffe', category: 'Animal' },
  { name: 'Penguin', category: 'Animal' },
  { name: 'Monkey', category: 'Animal' },
  { name: 'Koala', category: 'Animal' },
  { name: 'Shark', category: 'Animal' },
  { name: 'Owl', category: 'Animal' },
  { name: 'Butterfly', category: 'Animal' },
  { name: 'Bear', category: 'Animal' },
  { name: 'Kangaroo', category: 'Animal' },
  { name: 'Octopus', category: 'Animal' },

  // Food
  { name: 'Pizza', category: 'Food' },
  { name: 'Hamburger', category: 'Food' },
  { name: 'Banana', category: 'Food' },
  { name: 'Ice Cream', category: 'Food' },
  { name: 'Coffee Cup', category: 'Food' },
  { name: 'Taco', category: 'Food' },
  { name: 'Sushi', category: 'Food' },
  { name: 'Watermelon', category: 'Food' },
  { name: 'Cake', category: 'Food' },
  { name: 'Donut', category: 'Food' },
  { name: 'Apple', category: 'Food' },
  { name: 'Carrot', category: 'Food' },

  // Landmarks & Nature
  { name: 'New York City', category: 'Landmark' },
  { name: 'Mountain', category: 'Landmark' },
  { name: 'Eiffel Tower', category: 'Landmark' },
  { name: 'Volcano', category: 'Landmark' },
  { name: 'Beach', category: 'Landmark' },
  { name: 'Pyramids', category: 'Landmark' },
  { name: 'Castle', category: 'Landmark' },
  { name: 'Rainbow', category: 'Landmark' },
  { name: 'Waterfall', category: 'Landmark' },
  { name: 'Forest', category: 'Landmark' },
  { name: 'Sun', category: 'Landmark' },
  { name: 'Island', category: 'Landmark' },

  // Objects
  { name: 'Bicycle', category: 'Object' },
  { name: 'Rocket', category: 'Object' },
  { name: 'Guitar', category: 'Object' },
  { name: 'Umbrella', category: 'Object' },
  { name: 'Clock', category: 'Object' },
  { name: 'Key', category: 'Object' },
  { name: 'Book', category: 'Object' },
  { name: 'Camera', category: 'Object' },
  { name: 'Backpack', category: 'Object' },
  { name: 'Telephone', category: 'Object' },
  { name: 'Lightbulb', category: 'Object' },

  // Vehicles
  { name: 'Airplane', category: 'Vehicle' },
  { name: 'Train', category: 'Vehicle' },
  { name: 'Submarine', category: 'Vehicle' },
  { name: 'Helicopter', category: 'Vehicle' },
  { name: 'Fire Truck', category: 'Vehicle' },
  { name: 'Sailboat', category: 'Vehicle' },
];
